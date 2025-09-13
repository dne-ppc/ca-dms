"""
Google Workspace/Drive Integration Service
Implements Google APIs for Drive and Workspace integration
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


class GoogleService(ExternalIntegrationService):
    """Google Workspace/Drive integration service using Google APIs"""

    def __init__(self, db):
        super().__init__(db)
        self.drive_base_url = "https://www.googleapis.com/drive/v3"
        self.upload_base_url = "https://www.googleapis.com/upload/drive/v3"
        self.token_url = "https://oauth2.googleapis.com/token"

    async def _exchange_code_for_tokens(
        self,
        integration_type: IntegrationType,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
        authorization_code: str
    ) -> Dict[str, Any]:
        """Exchange authorization code for Google OAuth tokens"""
        data = {
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "code": authorization_code,
            "grant_type": "authorization_code"
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
        """Refresh Google OAuth access token"""
        data = {
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token"
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
        """List files in Google Drive folder"""
        access_token = self._decrypt_data(integration.access_token)
        headers = {"Authorization": f"Bearer {access_token}"}

        # Build query parameters
        params = {
            "fields": "nextPageToken,files(id,name,parents,mimeType,size,modifiedTime,webContentLink,webViewLink)"
        }

        # Handle folder path
        if folder_path and folder_path != "/":
            # Get folder ID by path (simplified - in real implementation, would handle nested paths)
            folder_id = await self._get_folder_id_by_path(access_token, folder_path)
            if folder_id:
                params["q"] = f"'{folder_id}' in parents and trashed=false"
            else:
                # Folder not found, return empty list
                return []
        else:
            # Root folder - get files without specific parent
            params["q"] = "trashed=false"

        if page_token:
            params["pageToken"] = page_token

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.drive_base_url}/files",
                headers=headers,
                params=params
            )
            response.raise_for_status()
            data = response.json()

        files = []
        for item in data.get("files", []):
            # Determine if it's a folder
            is_folder = item["mimeType"] == "application/vnd.google-apps.folder"

            # Build file path
            file_path = await self._build_file_path(access_token, item, folder_path)

            file_info = ExternalFileInfo(
                id=item["id"],
                name=item["name"],
                path=file_path,
                size=int(item.get("size", 0)) if item.get("size") else None,
                modified_at=self._parse_google_datetime(item.get("modifiedTime")),
                mime_type=item["mimeType"],
                download_url=item.get("webContentLink"),
                is_folder=is_folder,
                parent_id=item.get("parents", [None])[0] if item.get("parents") else None
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
        """Upload document to Google Drive"""
        access_token = self._decrypt_data(integration.access_token)
        headers = {"Authorization": f"Bearer {access_token}"}

        # Prepare file content and metadata
        file_content = self._get_document_content(document)
        file_name = f"{document.title}.{self._get_file_extension(document)}"

        # Get parent folder ID
        parent_folder_id = None
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

        # Prepare metadata
        file_metadata = {
            "name": file_name,
            "description": f"Uploaded from CA-DMS: {document.title}"
        }

        if parent_folder_id:
            file_metadata["parents"] = [parent_folder_id]

        # Upload file using multipart upload
        boundary = f"boundary_{uuid.uuid4().hex}"

        multipart_body = (
            f"--{boundary}\r\n"
            f"Content-Type: application/json; charset=UTF-8\r\n\r\n"
            f"{json.dumps(file_metadata)}\r\n"
            f"--{boundary}\r\n"
            f"Content-Type: application/octet-stream\r\n\r\n"
        ).encode('utf-8') + file_content + f"\r\n--{boundary}--\r\n".encode('utf-8')

        upload_headers = {
            **headers,
            "Content-Type": f"multipart/related; boundary={boundary}",
            "Content-Length": str(len(multipart_body))
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.upload_base_url}/files",
                headers=upload_headers,
                content=multipart_body,
                params={"uploadType": "multipart"}
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
        """Download file from Google Drive"""
        access_token = self._decrypt_data(integration.access_token)
        headers = {"Authorization": f"Bearer {access_token}"}

        # Get file metadata
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.drive_base_url}/files/{external_file_id}",
                headers=headers,
                params={"fields": "id,name,mimeType,size,webContentLink"}
            )
            response.raise_for_status()
            file_info = response.json()

        # Download file content
        download_url = None
        if file_info["mimeType"].startswith("application/vnd.google-apps."):
            # Google Workspace document - export as appropriate format
            export_format = self._get_export_format(file_info["mimeType"])
            download_url = f"{self.drive_base_url}/files/{external_file_id}/export?mimeType={export_format}"
        else:
            # Regular file - direct download
            download_url = f"{self.drive_base_url}/files/{external_file_id}?alt=media"

        async with httpx.AsyncClient() as client:
            response = await client.get(download_url, headers=headers)
            response.raise_for_status()
            file_content = response.content

        # Create or update document
        if create_new_document:
            document_id = await self._create_document_from_content(
                file_info["name"],
                file_content,
                integration.user_id,
                metadata={
                    "source": "google_drive",
                    "external_id": external_file_id,
                    "original_name": file_info["name"],
                    "mime_type": file_info["mimeType"]
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
        """Test Google Drive API connectivity"""
        access_token = self._decrypt_data(integration.access_token)
        headers = {"Authorization": f"Bearer {access_token}"}

        async with httpx.AsyncClient() as client:
            # Test with about endpoint
            response = await client.get(
                f"{self.drive_base_url}/about",
                headers=headers,
                params={"fields": "user"}
            )
            response.raise_for_status()

    async def _perform_sync_operation(
        self,
        integration: ExternalIntegration,
        sync_request,
        operation_id: str
    ) -> None:
        """Perform bidirectional sync operation with Google Drive"""
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
                # Upload documents to Google Drive
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

                # Download files from Google Drive
                if sync_request.external_paths:
                    for path in sync_request.external_paths:
                        try:
                            # Get files in path and sync them
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
        """Get Google Drive folder ID by path"""
        headers = {"Authorization": f"Bearer {access_token}"}
        path_parts = folder_path.strip("/").split("/")

        current_parent = "root"
        for part in path_parts:
            if not part:
                continue

            params = {
                "q": f"name='{part}' and '{current_parent}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
                "fields": "files(id)"
            }

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.drive_base_url}/files",
                    headers=headers,
                    params=params
                )
                response.raise_for_status()
                data = response.json()

            files = data.get("files", [])
            if not files:
                return None

            current_parent = files[0]["id"]

        return current_parent if current_parent != "root" else None

    async def _create_folder_path(self, access_token: str, folder_path: str) -> str:
        """Create folder path in Google Drive"""
        headers = {"Authorization": f"Bearer {access_token}"}
        path_parts = folder_path.strip("/").split("/")

        current_parent = "root"
        for part in path_parts:
            if not part:
                continue

            # Check if folder already exists
            existing_folder = await self._find_folder_by_name(access_token, part, current_parent)
            if existing_folder:
                current_parent = existing_folder["id"]
                continue

            # Create folder
            folder_metadata = {
                "name": part,
                "mimeType": "application/vnd.google-apps.folder",
                "parents": [current_parent]
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.drive_base_url}/files",
                    headers=headers,
                    json=folder_metadata
                )
                response.raise_for_status()
                folder = response.json()
                current_parent = folder["id"]

        return current_parent

    async def _find_folder_by_name(
        self,
        access_token: str,
        folder_name: str,
        parent_id: str
    ) -> Optional[Dict[str, Any]]:
        """Find folder by name and parent"""
        headers = {"Authorization": f"Bearer {access_token}"}

        params = {
            "q": f"name='{folder_name}' and '{parent_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
            "fields": "files(id,name)"
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.drive_base_url}/files",
                headers=headers,
                params=params
            )
            response.raise_for_status()
            data = response.json()

        files = data.get("files", [])
        return files[0] if files else None

    async def _find_file_by_name(
        self,
        access_token: str,
        file_name: str,
        parent_id: Optional[str]
    ) -> Optional[Dict[str, Any]]:
        """Find file by name and parent"""
        headers = {"Authorization": f"Bearer {access_token}"}

        query = f"name='{file_name}' and trashed=false"
        if parent_id:
            query += f" and '{parent_id}' in parents"

        params = {
            "q": query,
            "fields": "files(id,name)"
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.drive_base_url}/files",
                headers=headers,
                params=params
            )
            response.raise_for_status()
            data = response.json()

        files = data.get("files", [])
        return files[0] if files else None

    async def _build_file_path(
        self,
        access_token: str,
        item: Dict[str, Any],
        base_path: str
    ) -> str:
        """Build full file path for Google Drive item"""
        # Simplified implementation - in real system would build complete path
        if base_path and base_path != "/":
            return f"{base_path.rstrip('/')}/{item['name']}"
        return f"/{item['name']}"

    def _parse_google_datetime(self, datetime_str: Optional[str]) -> Optional[datetime]:
        """Parse Google API datetime string"""
        if not datetime_str:
            return None

        try:
            # Google uses RFC 3339 format
            if datetime_str.endswith('Z'):
                datetime_str = datetime_str[:-1] + '+00:00'
            return datetime.fromisoformat(datetime_str)
        except Exception:
            return None

    def _get_export_format(self, google_mime_type: str) -> str:
        """Get appropriate export format for Google Workspace documents"""
        export_formats = {
            "application/vnd.google-apps.document": "application/pdf",
            "application/vnd.google-apps.spreadsheet": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.google-apps.presentation": "application/pdf",
            "application/vnd.google-apps.drawing": "application/pdf"
        }
        return export_formats.get(google_mime_type, "application/pdf")

    def _get_document_content(self, document: Document) -> bytes:
        """Get document content as bytes"""
        # In real implementation, this would:
        # 1. Get document content from document service
        # 2. Generate PDF for governance documents
        # 3. Return proper file content

        content = {
            "title": document.title,
            "content": document.content,
            "id": document.id,
            "created_at": document.created_at.isoformat() if document.created_at else None
        }
        return json.dumps(content, indent=2).encode('utf-8')

    def _get_file_extension(self, document: Document) -> str:
        """Get appropriate file extension for document"""
        # In real implementation, determine based on document type
        return "pdf"  # Default to PDF for governance documents

    async def _create_document_from_content(
        self,
        filename: str,
        content: bytes,
        user_id: str,
        metadata: Dict[str, Any]
    ) -> str:
        """Create new document from downloaded content"""
        # Simplified implementation - in real system would integrate with document service
        document_id = str(uuid.uuid4())
        return document_id

    async def _update_document_content(
        self,
        document_id: str,
        content: bytes
    ) -> None:
        """Update existing document with new content"""
        # Simplified implementation - in real system would integrate with document service
        pass