"""
Asset Management API Endpoints

Handles file uploads, static asset serving, and CDN integration.
"""

import os
import aiofiles
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Response, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
import hashlib

from app.services.cdn_service import cdn_service
from app.core.config import settings


router = APIRouter()


class AssetUploadResponse(BaseModel):
    """Response model for asset uploads"""
    success: bool
    asset_path: str
    asset_url: str
    file_size: int
    content_type: str
    metadata: dict


class AssetMetadata(BaseModel):
    """Asset metadata model"""
    filename: str
    asset_type: str
    file_size: int
    content_type: str
    urls: dict
    cache_headers: dict


class CDNConfigResponse(BaseModel):
    """CDN configuration response"""
    cdn_enabled: bool
    cdn_base_url: Optional[str]
    supported_asset_types: List[str]
    asset_configs: dict


@router.post("/upload", response_model=AssetUploadResponse)
async def upload_asset(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    asset_type: str = "documents"
):
    """Upload an asset file"""
    try:
        # Read file content
        file_content = await file.read()
        file_size = len(file_content)

        # Validate asset
        validation_result = cdn_service.validate_asset(file.filename, file_size, asset_type)
        if not validation_result['valid']:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Asset validation failed",
                    "errors": validation_result['errors']
                }
            )

        # Generate unique asset path
        asset_path = cdn_service.generate_asset_path(file.filename, asset_type)

        # Determine storage location
        if cdn_service.cdn_enabled:
            # For CDN storage, this would upload to S3/CloudFront etc.
            # For now, store locally and serve via CDN
            storage_path = await _store_asset_locally(asset_path, file_content, asset_type)
        else:
            # Store locally
            storage_path = await _store_asset_locally(asset_path, file_content, asset_type)

        # Generate asset URL
        asset_url = cdn_service.get_asset_url(asset_path, asset_type)

        # Get metadata
        metadata = cdn_service.get_asset_metadata(asset_path, asset_type)

        # Background task: generate thumbnails for images
        if asset_type == 'images':
            background_tasks.add_task(_generate_image_thumbnails, storage_path, asset_path)

        return AssetUploadResponse(
            success=True,
            asset_path=asset_path,
            asset_url=asset_url,
            file_size=file_size,
            content_type=cdn_service.get_content_type(file.filename),
            metadata=metadata
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("/serve/{asset_type}/{asset_path:path}")
async def serve_asset(asset_type: str, asset_path: str):
    """Serve static assets with proper caching headers"""
    try:
        # Security: validate asset type and path
        if asset_type not in cdn_service.asset_configs:
            raise HTTPException(status_code=404, detail="Asset type not found")

        # Construct local file path
        local_storage = _get_local_storage_path()
        file_path = os.path.join(local_storage, asset_type, asset_path)

        # Security: ensure path is within allowed directory
        if not os.path.commonpath([local_storage, file_path]) == local_storage:
            raise HTTPException(status_code=403, detail="Access denied")

        # Check if file exists
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Asset not found")

        # Get cache headers
        cache_headers = cdn_service.get_cache_headers(asset_type)

        # Generate ETag
        with open(file_path, 'rb') as f:
            file_content = f.read()
            etag = cdn_service.generate_etag(file_content)

        # Get content type
        content_type = cdn_service.get_content_type(asset_path)

        # Return file with appropriate headers
        return FileResponse(
            file_path,
            media_type=content_type,
            headers={
                **cache_headers,
                'ETag': etag
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to serve asset: {str(e)}")


@router.get("/metadata/{asset_type}/{asset_path:path}", response_model=AssetMetadata)
async def get_asset_metadata(asset_type: str, asset_path: str):
    """Get metadata for an asset"""
    try:
        if asset_type not in cdn_service.asset_configs:
            raise HTTPException(status_code=404, detail="Asset type not found")

        # Check if asset exists
        local_storage = _get_local_storage_path()
        file_path = os.path.join(local_storage, asset_type, asset_path)

        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Asset not found")

        # Get file info
        file_stats = os.stat(file_path)
        file_size = file_stats.st_size

        # Generate URLs
        if asset_type == 'images':
            urls = cdn_service.get_responsive_image_urls(asset_path)
        else:
            urls = {'original': cdn_service.get_asset_url(asset_path, asset_type)}

        return AssetMetadata(
            filename=os.path.basename(asset_path),
            asset_type=asset_type,
            file_size=file_size,
            content_type=cdn_service.get_content_type(asset_path),
            urls=urls,
            cache_headers=cdn_service.get_cache_headers(asset_type)
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get metadata: {str(e)}")


@router.post("/images/{asset_path:path}/responsive")
async def generate_responsive_images(asset_path: str):
    """Generate responsive image sizes"""
    try:
        # This would integrate with image processing service
        # For now, return the responsive URLs
        urls = cdn_service.get_responsive_image_urls(asset_path)

        return {
            "success": True,
            "asset_path": asset_path,
            "responsive_urls": urls
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate responsive images: {str(e)}")


@router.delete("/purge")
async def purge_cdn_cache(asset_paths: List[str]):
    """Purge CDN cache for specific assets"""
    try:
        success = cdn_service.purge_cache(asset_paths)

        return {
            "success": success,
            "message": f"Cache purge {'completed' if success else 'failed'} for {len(asset_paths)} assets",
            "asset_paths": asset_paths
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cache purge failed: {str(e)}")


@router.get("/upload-signature")
async def get_upload_signature(asset_type: str, filename: str):
    """Get signed upload URL for direct-to-CDN uploads"""
    try:
        signature = cdn_service.get_upload_signature(asset_type, filename)

        return {
            "success": True,
            "signature": signature,
            "asset_type": asset_type,
            "filename": filename
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate upload signature: {str(e)}")


@router.get("/config", response_model=CDNConfigResponse)
async def get_cdn_config():
    """Get CDN configuration and supported asset types"""
    return CDNConfigResponse(
        cdn_enabled=cdn_service.cdn_enabled,
        cdn_base_url=cdn_service.cdn_base_url,
        supported_asset_types=list(cdn_service.asset_configs.keys()),
        asset_configs=cdn_service.asset_configs
    )


@router.get("/health")
async def asset_service_health():
    """Check asset service health"""
    try:
        local_storage = _get_local_storage_path()
        storage_writable = os.access(local_storage, os.W_OK)

        return {
            "success": True,
            "local_storage_path": local_storage,
            "storage_writable": storage_writable,
            "cdn_enabled": cdn_service.cdn_enabled,
            "cdn_url": cdn_service.cdn_base_url
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


# Helper functions

def _get_local_storage_path() -> str:
    """Get local storage path for assets"""
    storage_path = os.path.join(os.getcwd(), 'static', 'assets')
    os.makedirs(storage_path, exist_ok=True)
    return storage_path


async def _store_asset_locally(asset_path: str, file_content: bytes, asset_type: str) -> str:
    """Store asset in local filesystem"""
    local_storage = _get_local_storage_path()
    asset_dir = os.path.join(local_storage, asset_type)
    os.makedirs(asset_dir, exist_ok=True)

    file_path = os.path.join(asset_dir, asset_path)

    # Ensure directory exists
    os.makedirs(os.path.dirname(file_path), exist_ok=True)

    # Write file
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(file_content)

    return file_path


async def _generate_image_thumbnails(storage_path: str, asset_path: str):
    """Background task to generate image thumbnails"""
    try:
        # This would integrate with image processing library (Pillow, etc.)
        # For now, just log the action
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Would generate thumbnails for image: {asset_path}")

    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Thumbnail generation failed for {asset_path}: {e}")