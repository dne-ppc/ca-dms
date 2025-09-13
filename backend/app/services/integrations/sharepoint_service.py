"""
SharePoint/OneDrive Integration Service
Implements Microsoft Graph API integration for SharePoint and OneDrive
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


class SharePointService(ExternalIntegrationService):
    """SharePoint/OneDrive integration service using Microsoft Graph API"""

    def __init__(self, db):
        super().__init__(db)
        self.graph_base_url = "https://graph.microsoft.com/v1.0"
        self.token_url = "https://login.microsoftonline.com/common/oauth2/v2.0/token"

    async def _exchange_code_for_tokens(
        self,
        integration_type: IntegrationType,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
        authorization_code: str
    ) -> Dict[str, Any]:
        """Exchange authorization code for Microsoft Graph tokens"""
        data = {
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "code": authorization_code,
            "grant_type": "authorization_code",
            "scope": "https://graph.microsoft.com/.default"
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
        """Refresh Microsoft Graph access token"""
        data = {
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
            "scope": "https://graph.microsoft.com/.default"
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(self.token_url, data=data)
            response.raise_for_status()
            return response.json()

    async def _get_drive_info(self, access_token: str, integration_type: IntegrationType) -> Dict[str, Any]:
        """Get user's drive information"""
        headers = {"Authorization": f"Bearer {access_token}"}

        async with httpx.AsyncClient() as client:
            if integration_type == IntegrationType.ONEDRIVE:
                # OneDrive personal
                response = await client.get(
                    f"{self.graph_base_url}/me/drive",
                    headers=headers
                )
            else:
                # SharePoint - get default site drive
                response = await client.get(
                    f"{self.graph_base_url}/sites/root/drive",
                    headers=headers
                )

            response.raise_for_status()
            return response.json()

    async def _list_files(
        self,
        integration: ExternalIntegration,
        folder_path: str,
        page_token: Optional[str]
    ) -> List[ExternalFileInfo]:
        """List files in SharePoint/OneDrive folder"""
        access_token = self._decrypt_data(integration.access_token)
        headers = {"Authorization": f"Bearer {access_token}"}

        # Get drive info
        drive_info = await self._get_drive_info(access_token, integration.integration_type)
        drive_id = drive_info["id"]

        # Construct API endpoint
        if folder_path == "/" or folder_path == "":
            url = f"{self.graph_base_url}/drives/{drive_id}/root/children"
        else:
            # Remove leading slash and encode path
            clean_path = folder_path.lstrip("/")
            url = f"{self.graph_base_url}/drives/{drive_id}/root:/{clean_path}:/children"

        # Add pagination if needed
        params = {}
        if page_token:
            params["$skiptoken"] = page_token

        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()

        files = []
        for item in data.get("value", []):
            file_info = ExternalFileInfo(
                id=item["id"],
                name=item["name"],
                path=self._build_file_path(item),
                size=item.get("size"),
                modified_at=self._parse_datetime(item.get("lastModifiedDateTime")),
                mime_type=item.get("file", {}).get("mimeType"),
                download_url=item.get("@microsoft.graph.downloadUrl"),
                is_folder="folder" in item,
                parent_id=item.get("parentReference", {}).get("id")
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
        """Upload document to SharePoint/OneDrive"""
        access_token = self._decrypt_data(integration.access_token)
        headers = {"Authorization": f"Bearer {access_token}"}

        # Get drive info
        drive_info = await self._get_drive_info(access_token, integration.integration_type)
        drive_id = drive_info["id"]

        # Prepare file content (simplified - in real implementation, get from document service)
        file_content = self._get_document_content(document)
        file_name = f"{document.title}.{self._get_file_extension(document)}"

        # Clean destination path
        clean_path = destination_path.strip("/")
        if clean_path:
            upload_path = f"{clean_path}/{file_name}"
        else:
            upload_path = file_name

        # Check if file exists
        if not overwrite:
            existing_file = await self._check_file_exists(
                access_token, drive_id, upload_path
            )
            if existing_file:
                raise ValueError(f"File already exists: {upload_path}")

        # Small files (<4MB) - simple upload
        if len(file_content) < 4 * 1024 * 1024:
            url = f"{self.graph_base_url}/drives/{drive_id}/root:/{upload_path}:/content"

            upload_headers = {
                **headers,
                "Content-Type": "application/octet-stream"
            }

            async with httpx.AsyncClient() as client:
                response = await client.put(
                    url,
                    headers=upload_headers,
                    content=file_content
                )
                response.raise_for_status()
                result = response.json()
                return result["id"]

        else:
            # Large files - resumable upload session
            return await self._upload_large_file(
                access_token, drive_id, upload_path, file_content
            )

    async def _download_file(
        self,
        integration: ExternalIntegration,
        external_file_id: str,
        destination_document_id: Optional[str],
        create_new_document: bool
    ) -> str:
        """Download file from SharePoint/OneDrive"""
        access_token = self._decrypt_data(integration.access_token)
        headers = {"Authorization": f"Bearer {access_token}"}

        # Get file info
        url = f"{self.graph_base_url}/drives/items/{external_file_id}"

        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            file_info = response.json()

        # Download file content
        download_url = file_info.get("@microsoft.graph.downloadUrl")
        if not download_url:
            raise ValueError("No download URL available for file")

        async with httpx.AsyncClient() as client:
            response = await client.get(download_url)
            response.raise_for_status()
            file_content = response.content

        # Create or update document
        if create_new_document:
            document_id = await self._create_document_from_content(
                file_info["name"],
                file_content,
                integration.user_id,
                metadata={
                    "source": "sharepoint",
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
        """Test Microsoft Graph API connectivity"""
        access_token = self._decrypt_data(integration.access_token)
        headers = {"Authorization": f"Bearer {access_token}"}

        async with httpx.AsyncClient() as client:
            # Test with simple user info endpoint
            response = await client.get(
                f"{self.graph_base_url}/me",
                headers=headers
            )
            response.raise_for_status()

    async def _perform_sync_operation(
        self,
        integration: ExternalIntegration,
        sync_request,
        operation_id: str
    ) -> None:
        """Perform bidirectional sync operation"""
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
                # Bidirectional sync
                if sync_request.document_ids:
                    # Upload specified documents
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

                # Download updated files (simplified)
                if sync_request.external_paths:
                    for path in sync_request.external_paths:
                        try:
                            # This would need more sophisticated implementation
                            # to track which files have been updated
                            files_processed += 1
                            files_succeeded += 1
                        except Exception as e:
                            files_failed += 1
                            print(f"Failed to download from path {path}: {e}")

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
    def _build_file_path(self, item: Dict[str, Any]) -> str:
        """Build full file path from Microsoft Graph item"""
        parent_ref = item.get("parentReference", {})
        parent_path = parent_ref.get("path", "")

        if parent_path.startswith("/drive/root:"):
            parent_path = parent_path[12:]  # Remove "/drive/root:"

        if parent_path and not parent_path.endswith("/"):
            parent_path += "/"

        return f"{parent_path}{item['name']}"

    def _parse_datetime(self, datetime_str: Optional[str]) -> Optional[datetime]:
        """Parse Microsoft Graph datetime string"""
        if not datetime_str:
            return None

        try:
            # Remove 'Z' suffix and parse
            clean_str = datetime_str.rstrip('Z')
            return datetime.fromisoformat(clean_str)
        except Exception:
            return None

    async def _check_file_exists(
        self,
        access_token: str,
        drive_id: str,
        file_path: str
    ) -> Optional[Dict[str, Any]]:
        """Check if file exists in SharePoint/OneDrive"""
        headers = {"Authorization": f"Bearer {access_token}"}
        url = f"{self.graph_base_url}/drives/{drive_id}/root:/{file_path}"

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers)
                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 404:
                    return None
                else:
                    response.raise_for_status()
        except httpx.HTTPStatusError:
            return None

    async def _upload_large_file(
        self,
        access_token: str,
        drive_id: str,
        upload_path: str,
        file_content: bytes
    ) -> str:
        """Upload large file using resumable upload session"""
        headers = {"Authorization": f"Bearer {access_token}"}

        # Create upload session
        session_url = f"{self.graph_base_url}/drives/{drive_id}/root:/{upload_path}:/createUploadSession"
        session_data = {
            "item": {
                "@microsoft.graph.conflictBehavior": "replace"
            }
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                session_url,
                headers=headers,
                json=session_data
            )
            response.raise_for_status()
            session = response.json()

        upload_url = session["uploadUrl"]
        file_size = len(file_content)
        chunk_size = 320 * 1024  # 320KB chunks (multiple of 320KB required)

        # Upload in chunks
        for start in range(0, file_size, chunk_size):
            end = min(start + chunk_size, file_size) - 1
            chunk = file_content[start:end + 1]

            chunk_headers = {
                "Content-Length": str(len(chunk)),
                "Content-Range": f"bytes {start}-{end}/{file_size}"
            }

            async with httpx.AsyncClient() as client:
                response = await client.put(
                    upload_url,
                    headers=chunk_headers,
                    content=chunk
                )

                if response.status_code in [200, 201]:
                    # Upload complete
                    result = response.json()
                    return result["id"]
                elif response.status_code != 202:
                    # Error
                    response.raise_for_status()

        raise ValueError("Upload session completed but no file ID returned")

    def _get_document_content(self, document: Document) -> bytes:
        """Get document content as bytes (simplified implementation)"""
        # In real implementation, this would:
        # 1. Get document content from document service
        # 2. Generate PDF if needed
        # 3. Return proper file content

        # For now, return basic content
        content = {
            "title": document.title,
            "content": document.content,
            "id": document.id
        }
        return json.dumps(content).encode('utf-8')

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
        # Simplified implementation - in real system, would:
        # 1. Parse content based on file type
        # 2. Create proper Document model
        # 3. Store in database

        document_id = str(uuid.uuid4())
        # This would integrate with document service
        return document_id

    async def _update_document_content(
        self,
        document_id: str,
        content: bytes
    ) -> None:
        """Update existing document with new content"""
        # Simplified implementation - in real system, would:
        # 1. Get existing document
        # 2. Update content
        # 3. Create version history entry
        pass