"""
Dropbox Integration Service
Implements Dropbox API integration for cloud storage
"""
import json
import uuid
import httpx
import base64
from typing import List, Dict, Any, Optional
from datetime import datetime
from app.services.external_integration_service import ExternalIntegrationService
from app.models.external_integration import ExternalIntegration, IntegrationType
from app.models.document import Document
from app.schemas.external_integration import ExternalFileInfo


class DropboxService(ExternalIntegrationService):
    """Dropbox integration service using Dropbox API v2"""

    def __init__(self, db):
        super().__init__(db)
        self.api_base_url = "https://api.dropboxapi.com/2"
        self.content_base_url = "https://content.dropboxapi.com/2"
        self.token_url = "https://api.dropbox.com/oauth2/token"

    async def _exchange_code_for_tokens(
        self,
        integration_type: IntegrationType,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
        authorization_code: str
    ) -> Dict[str, Any]:
        """Exchange authorization code for Dropbox OAuth tokens"""
        auth_header = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
        headers = {"Authorization": f"Basic {auth_header}"}

        data = {
            "code": authorization_code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(self.token_url, headers=headers, data=data)
            response.raise_for_status()
            return response.json()

    async def _refresh_access_token(
        self,
        integration_type: IntegrationType,
        client_id: str,
        client_secret: str,
        refresh_token: str
    ) -> Dict[str, Any]:
        """Refresh Dropbox OAuth access token"""
        auth_header = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
        headers = {"Authorization": f"Basic {auth_header}"}

        data = {
            "refresh_token": refresh_token,
            "grant_type": "refresh_token"
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(self.token_url, headers=headers, data=data)
            response.raise_for_status()
            return response.json()

    async def _list_files(
        self,
        integration: ExternalIntegration,
        folder_path: str,
        page_token: Optional[str]
    ) -> List[ExternalFileInfo]:
        """List files in Dropbox folder"""
        access_token = self._decrypt_data(integration.access_token)
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }

        # Prepare request data
        path = folder_path if folder_path != "/" else ""
        request_data = {
            "path": path,
            "recursive": False,
            "include_media_info": False,
            "include_deleted": False,
            "include_has_explicit_shared_members": False
        }

        if page_token:
            # Use continue endpoint for pagination
            url = f"{self.api_base_url}/files/list_folder/continue"
            request_data = {"cursor": page_token}
        else:
            url = f"{self.api_base_url}/files/list_folder"

        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=request_data)
            response.raise_for_status()
            data = response.json()

        files = []
        for entry in data.get("entries", []):
            # Determine file type
            is_folder = entry[".tag"] == "folder"

            file_info = ExternalFileInfo(
                id=entry.get("id", entry["path_lower"]),  # Use path if no ID
                name=entry["name"],
                path=entry["path_display"],
                size=entry.get("size"),
                modified_at=self._parse_dropbox_datetime(entry.get("server_modified")),
                mime_type=self._get_mime_type_from_name(entry["name"]) if not is_folder else None,
                download_url=None,  # Dropbox requires separate API call for download
                is_folder=is_folder,
                parent_id=None  # Dropbox doesn't use parent IDs
            )
            files.append(file_info)

        return files

    async def _upload_file(
        self,
        integration: ExternalIntegration,
        document: Document,
        destination_path: str,
        overwrite: bool,
        metadata: Dict[str, Any]
    ) -> str:
        """Upload document to Dropbox"""
        access_token = self._decrypt_data(integration.access_token)

        # Prepare file content
        file_content = self._get_document_content(document)
        file_name = f"{document.title}.{self._get_file_extension(document)}"

        # Build destination path
        if destination_path and destination_path != "/":
            full_path = f"{destination_path.rstrip('/')}/{file_name}"
        else:
            full_path = f"/{file_name}"

        # Check if file exists
        if not overwrite:
            existing_file = await self._check_file_exists(access_token, full_path)
            if existing_file:
                raise ValueError(f"File already exists: {full_path}")

        # Prepare headers
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/octet-stream",
            "Dropbox-API-Arg": json.dumps({
                "path": full_path,
                "mode": "overwrite" if overwrite else "add",
                "autorename": False
            })
        }

        # Upload file
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.content_base_url}/files/upload",
                headers=headers,
                content=file_content
            )
            response.raise_for_status()
            result = response.json()
            return result["id"]

    async def _download_file(
        self,
        integration: ExternalIntegration,
        external_file_id: str,
        destination_document_id: Optional[str],
        create_new_document: bool
    ) -> str:
        """Download file from Dropbox"""
        access_token = self._decrypt_data(integration.access_token)

        # Get file metadata first
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_base_url}/files/get_metadata",
                headers=headers,
                json={"path": external_file_id}
            )
            response.raise_for_status()
            file_info = response.json()

        # Download file content
        download_headers = {
            "Authorization": f"Bearer {access_token}",
            "Dropbox-API-Arg": json.dumps({"path": external_file_id})
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.content_base_url}/files/download",
                headers=download_headers
            )
            response.raise_for_status()
            file_content = response.content

        # Create or update document
        if create_new_document:
            document_id = await self._create_document_from_content(
                file_info["name"],
                file_content,
                integration.user_id,
                metadata={
                    "source": "dropbox",
                    "external_id": external_file_id,
                    "original_name": file_info["name"],
                    "path": file_info["path_display"]
                }
            )
        else:
            if not destination_document_id:
                raise ValueError("Destination document ID required when not creating new document")

            await self._update_document_content(
                destination_document_id,
                file_content
            )
            document_id = destination_document_id

        return document_id

    async def _test_api_connectivity(self, integration: ExternalIntegration) -> None:
        """Test Dropbox API connectivity"""
        access_token = self._decrypt_data(integration.access_token)
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient() as client:
            # Test with current account endpoint
            response = await client.post(
                f"{self.api_base_url}/users/get_current_account",
                headers=headers,
                json={}
            )
            response.raise_for_status()

    async def _perform_sync_operation(
        self,
        integration: ExternalIntegration,
        sync_request,
        operation_id: str
    ) -> None:
        """Perform bidirectional sync operation with Dropbox"""
        # Create sync log
        sync_log = await self._create_sync_log(
            integration.id,
            sync_request.operation,
            "bidirectional"
        )

        try:
            files_processed = 0
            files_succeeded = 0
            files_failed = 0

            if sync_request.operation == "sync":
                # Upload documents to Dropbox
                if sync_request.document_ids:
                    for doc_id in sync_request.document_ids:
                        try:
                            document = self.db.query(Document).filter(
                                Document.id == doc_id
                            ).first()

                            if document:
                                destination_path = sync_request.options.get("destination_path", "/")
                                await self._upload_file(
                                    integration,
                                    document,
                                    destination_path,
                                    overwrite=True,
                                    metadata={}
                                )
                                files_succeeded += 1
                            files_processed += 1
                        except Exception as e:
                            files_failed += 1
                            print(f"Failed to upload document {doc_id}: {e}")

                # Download files from Dropbox
                if sync_request.external_paths:
                    for path in sync_request.external_paths:
                        try:
                            files = await self._list_files(integration, path, None)
                            for file_info in files:
                                if not file_info.is_folder:
                                    await self._download_file(
                                        integration,
                                        file_info.path,  # Dropbox uses path as ID
                                        None,
                                        create_new_document=True
                                    )
                            files_processed += len([f for f in files if not f.is_folder])
                            files_succeeded += len([f for f in files if not f.is_folder])
                        except Exception as e:
                            files_failed += 1
                            print(f"Failed to sync from path {path}: {e}")

            # Complete sync log
            await self._complete_sync_log(
                sync_log.id,
                "success" if files_failed == 0 else "partial",
                files_processed=files_processed,
                files_succeeded=files_succeeded,
                files_failed=files_failed
            )

        except Exception as e:
            await self._complete_sync_log(
                sync_log.id,
                "error",
                error_message=str(e)
            )

    # Helper methods
    async def _check_file_exists(self, access_token: str, file_path: str) -> Optional[Dict[str, Any]]:
        """Check if file exists in Dropbox"""
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.api_base_url}/files/get_metadata",
                    headers=headers,
                    json={"path": file_path}
                )
                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 409:
                    # File not found
                    return None
                else:
                    response.raise_for_status()
        except httpx.HTTPStatusError:
            return None

    async def _create_folder(self, access_token: str, folder_path: str) -> Dict[str, Any]:
        """Create folder in Dropbox"""
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_base_url}/files/create_folder_v2",
                headers=headers,
                json={"path": folder_path, "autorename": False}
            )
            response.raise_for_status()
            return response.json()

    def _parse_dropbox_datetime(self, datetime_str: Optional[str]) -> Optional[datetime]:
        """Parse Dropbox API datetime string"""
        if not datetime_str:
            return None

        try:
            # Dropbox uses RFC 3339 format
            if datetime_str.endswith('Z'):
                datetime_str = datetime_str[:-1] + '+00:00'
            return datetime.fromisoformat(datetime_str)
        except Exception:
            return None

    def _get_mime_type_from_name(self, filename: str) -> str:
        """Get MIME type from filename extension"""
        extension = filename.lower().split('.')[-1] if '.' in filename else ''
        mime_types = {
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'txt': 'text/plain',
            'json': 'application/json',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg'
        }
        return mime_types.get(extension, 'application/octet-stream')

    def _get_document_content(self, document: Document) -> bytes:
        """Get document content as bytes"""
        content = {
            "title": document.title,
            "content": document.content,
            "id": document.id,
            "created_at": document.created_at.isoformat() if document.created_at else None
        }
        return json.dumps(content, indent=2).encode('utf-8')

    def _get_file_extension(self, document: Document) -> str:
        """Get appropriate file extension for document"""
        return "pdf"

    async def _create_document_from_content(
        self,
        filename: str,
        content: bytes,
        user_id: str,
        metadata: Dict[str, Any]
    ) -> str:
        """Create new document from downloaded content"""
        document_id = str(uuid.uuid4())
        return document_id

    async def _update_document_content(
        self,
        document_id: str,
        content: bytes
    ) -> None:
        """Update existing document with new content"""
        pass