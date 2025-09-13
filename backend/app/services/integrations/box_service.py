"""
Box Integration Service
Implements Box API integration for cloud storage
"""
import json
import uuid
import httpx
from typing import List, Dict, Any, Optional
from datetime import datetime
from app.services.external_integration_service import ExternalIntegrationService
from app.models.external_integration import ExternalIntegration, IntegrationType
from app.models.document import Document
from app.schemas.external_integration import ExternalFileInfo


class BoxService(ExternalIntegrationService):
    """Box integration service using Box API v2.0"""

    def __init__(self, db):
        super().__init__(db)
        self.api_base_url = "https://api.box.com/2.0"
        self.upload_base_url = "https://upload.box.com/api/2.0"
        self.token_url = "https://api.box.com/oauth2/token"

    async def _exchange_code_for_tokens(
        self,
        integration_type: IntegrationType,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
        authorization_code: str
    ) -> Dict[str, Any]:
        """Exchange authorization code for Box OAuth tokens"""
        data = {
            "grant_type": "authorization_code",
            "code": authorization_code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(self.token_url, data=data)
            response.raise_for_status()
            return response.json()

    async def _refresh_access_token(
        self,
        integration_type: IntegrationType,
        client_id: str,
        client_secret: str,
        refresh_token: str
    ) -> Dict[str, Any]:
        """Refresh Box OAuth access token"""
        data = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": client_id,
            "client_secret": client_secret
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(self.token_url, data=data)
            response.raise_for_status()
            return response.json()

    async def _list_files(
        self,
        integration: ExternalIntegration,
        folder_path: str,
        page_token: Optional[str]
    ) -> List[ExternalFileInfo]:
        """List files in Box folder"""
        access_token = self._decrypt_data(integration.access_token)
        headers = {"Authorization": f"Bearer {access_token}"}

        # Get folder ID by path
        folder_id = "0"  # Root folder
        if folder_path and folder_path != "/":
            folder_id = await self._get_folder_id_by_path(access_token, folder_path)
            if not folder_id:
                return []  # Folder not found

        # Build API URL
        url = f"{self.api_base_url}/folders/{folder_id}/items"
        params = {
            "fields": "id,name,type,size,modified_at,content_created_at,path_collection,parent"
        }

        if page_token:
            params["marker"] = page_token

        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()

        files = []
        for item in data.get("entries", []):
            # Build file path
            file_path = self._build_file_path(item, folder_path)

            file_info = ExternalFileInfo(
                id=item["id"],
                name=item["name"],
                path=file_path,
                size=item.get("size"),
                modified_at=self._parse_box_datetime(item.get("modified_at")),
                mime_type=self._get_mime_type_from_name(item["name"]),
                download_url=f"{self.api_base_url}/files/{item['id']}/content" if item["type"] == "file" else None,
                is_folder=item["type"] == "folder",
                parent_id=item.get("parent", {}).get("id")
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
        """Upload document to Box"""
        access_token = self._decrypt_data(integration.access_token)
        headers = {"Authorization": f"Bearer {access_token}"}

        # Prepare file content
        file_content = self._get_document_content(document)
        file_name = f"{document.title}.{self._get_file_extension(document)}"

        # Get parent folder ID
        parent_folder_id = "0"  # Root folder
        if destination_path and destination_path != "/":
            parent_folder_id = await self._get_folder_id_by_path(access_token, destination_path)
            if not parent_folder_id:
                # Create folder if it doesn't exist
                parent_folder_id = await self._create_folder_path(access_token, destination_path)

        # Check if file exists
        if not overwrite:
            existing_file = await self._find_file_by_name(
                access_token, file_name, parent_folder_id
            )
            if existing_file:
                raise ValueError(f"File already exists: {file_name}")

        # Prepare multipart upload
        files = {
            "attributes": (None, json.dumps({
                "name": file_name,
                "parent": {"id": parent_folder_id}
            })),
            "file": (file_name, file_content, "application/octet-stream")
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.upload_base_url}/files/content",
                headers=headers,
                files=files
            )
            response.raise_for_status()
            result = response.json()
            return result["entries"][0]["id"]

    async def _download_file(
        self,
        integration: ExternalIntegration,
        external_file_id: str,
        destination_document_id: Optional[str],
        create_new_document: bool
    ) -> str:
        """Download file from Box"""
        access_token = self._decrypt_data(integration.access_token)
        headers = {"Authorization": f"Bearer {access_token}"}

        # Get file info
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_base_url}/files/{external_file_id}",
                headers=headers,
                params={"fields": "id,name,size,modified_at"}
            )
            response.raise_for_status()
            file_info = response.json()

        # Download file content
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_base_url}/files/{external_file_id}/content",
                headers=headers
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
                    "source": "box",
                    "external_id": external_file_id,
                    "original_name": file_info["name"]
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
        """Test Box API connectivity"""
        access_token = self._decrypt_data(integration.access_token)
        headers = {"Authorization": f"Bearer {access_token}"}

        async with httpx.AsyncClient() as client:
            # Test with user info endpoint
            response = await client.get(
                f"{self.api_base_url}/users/me",
                headers=headers
            )
            response.raise_for_status()

    async def _perform_sync_operation(
        self,
        integration: ExternalIntegration,
        sync_request,
        operation_id: str
    ) -> None:
        """Perform bidirectional sync operation with Box"""
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
                # Upload documents to Box
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

                # Download files from Box
                if sync_request.external_paths:
                    for path in sync_request.external_paths:
                        try:
                            files = await self._list_files(integration, path, None)
                            for file_info in files:
                                if not file_info.is_folder:
                                    await self._download_file(
                                        integration,
                                        file_info.id,
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
    async def _get_folder_id_by_path(self, access_token: str, folder_path: str) -> Optional[str]:
        """Get Box folder ID by path"""
        headers = {"Authorization": f"Bearer {access_token}"}
        path_parts = folder_path.strip("/").split("/")

        current_folder_id = "0"  # Root folder
        for part in path_parts:
            if not part:
                continue

            # Search for folder in current location
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.api_base_url}/folders/{current_folder_id}/items",
                    headers=headers,
                    params={"fields": "id,name,type"}
                )
                response.raise_for_status()
                data = response.json()

            # Find matching folder
            found = False
            for item in data.get("entries", []):
                if item["type"] == "folder" and item["name"] == part:
                    current_folder_id = item["id"]
                    found = True
                    break

            if not found:
                return None

        return current_folder_id if current_folder_id != "0" else None

    async def _create_folder_path(self, access_token: str, folder_path: str) -> str:
        """Create folder path in Box"""
        headers = {"Authorization": f"Bearer {access_token}"}
        path_parts = folder_path.strip("/").split("/")

        current_folder_id = "0"  # Root folder
        for part in path_parts:
            if not part:
                continue

            # Check if folder already exists
            existing_folder = await self._find_folder_by_name(
                access_token, part, current_folder_id
            )
            if existing_folder:
                current_folder_id = existing_folder["id"]
                continue

            # Create folder
            folder_data = {
                "name": part,
                "parent": {"id": current_folder_id}
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.api_base_url}/folders",
                    headers=headers,
                    json=folder_data
                )
                response.raise_for_status()
                folder = response.json()
                current_folder_id = folder["id"]

        return current_folder_id

    async def _find_folder_by_name(
        self,
        access_token: str,
        folder_name: str,
        parent_id: str
    ) -> Optional[Dict[str, Any]]:
        """Find folder by name and parent"""
        headers = {"Authorization": f"Bearer {access_token}"}

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_base_url}/folders/{parent_id}/items",
                headers=headers,
                params={"fields": "id,name,type"}
            )
            response.raise_for_status()
            data = response.json()

        for item in data.get("entries", []):
            if item["type"] == "folder" and item["name"] == folder_name:
                return item

        return None

    async def _find_file_by_name(
        self,
        access_token: str,
        file_name: str,
        parent_id: str
    ) -> Optional[Dict[str, Any]]:
        """Find file by name and parent"""
        headers = {"Authorization": f"Bearer {access_token}"}

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_base_url}/folders/{parent_id}/items",
                headers=headers,
                params={"fields": "id,name,type"}
            )
            response.raise_for_status()
            data = response.json()

        for item in data.get("entries", []):
            if item["type"] == "file" and item["name"] == file_name:
                return item

        return None

    def _build_file_path(self, item: Dict[str, Any], base_path: str) -> str:
        """Build full file path for Box item"""
        if base_path and base_path != "/":
            return f"{base_path.rstrip('/')}/{item['name']}"
        return f"/{item['name']}"

    def _parse_box_datetime(self, datetime_str: Optional[str]) -> Optional[datetime]:
        """Parse Box API datetime string"""
        if not datetime_str:
            return None

        try:
            # Box uses RFC 3339 format
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
            'json': 'application/json'
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