"""
CDN Service for Static Asset Management

Provides CDN integration for static assets like images, documents, and other files.
Supports multiple CDN providers and local fallback.
"""

import os
import hashlib
import mimetypes
from typing import Optional, Dict, Any, List
from urllib.parse import urljoin
import logging

from app.core.config import settings


logger = logging.getLogger(__name__)


class CDNService:
    """CDN service for static asset management"""

    def __init__(self):
        self.cdn_enabled = settings.STATIC_CDN_ENABLED
        self.cdn_base_url = settings.CDN_BASE_URL
        self.local_static_path = "/static/"

        # Asset type configurations
        self.asset_configs = {
            'images': {
                'path': 'images/',
                'allowed_extensions': ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'],
                'max_size_mb': 10,
                'cache_ttl': 86400 * 30  # 30 days
            },
            'documents': {
                'path': 'documents/',
                'allowed_extensions': ['.pdf', '.doc', '.docx', '.txt'],
                'max_size_mb': 50,
                'cache_ttl': 86400 * 7  # 7 days
            },
            'avatars': {
                'path': 'avatars/',
                'allowed_extensions': ['.jpg', '.jpeg', '.png'],
                'max_size_mb': 2,
                'cache_ttl': 86400 * 30  # 30 days
            },
            'exports': {
                'path': 'exports/',
                'allowed_extensions': ['.pdf', '.xlsx', '.csv', '.zip'],
                'max_size_mb': 100,
                'cache_ttl': 86400  # 1 day
            }
        }

    def get_asset_url(self, asset_path: str, asset_type: str = 'documents') -> str:
        """Get the full URL for an asset (CDN or local)"""
        if self.cdn_enabled and self.cdn_base_url:
            # Use CDN URL
            asset_config = self.asset_configs.get(asset_type, self.asset_configs['documents'])
            full_path = asset_config['path'] + asset_path
            cdn_url = urljoin(self.cdn_base_url.rstrip('/') + '/', full_path)

            logger.debug(f"Generated CDN URL: {cdn_url}")
            return cdn_url
        else:
            # Use local static URL
            local_url = self.local_static_path + asset_path
            logger.debug(f"Generated local URL: {local_url}")
            return local_url

    def generate_asset_path(self, filename: str, asset_type: str = 'documents') -> str:
        """Generate a unique asset path with hash-based naming"""
        # Create hash-based filename to prevent collisions
        file_hash = hashlib.md5(filename.encode()).hexdigest()[:8]
        name, ext = os.path.splitext(filename)

        # Sanitize filename
        safe_name = self._sanitize_filename(name)
        unique_filename = f"{safe_name}_{file_hash}{ext}"

        return unique_filename

    def validate_asset(self, filename: str, file_size: int, asset_type: str = 'documents') -> Dict[str, Any]:
        """Validate asset against type constraints"""
        asset_config = self.asset_configs.get(asset_type, self.asset_configs['documents'])

        validation_result = {
            'valid': True,
            'errors': [],
            'warnings': []
        }

        # Check file extension
        _, ext = os.path.splitext(filename.lower())
        if ext not in asset_config['allowed_extensions']:
            validation_result['valid'] = False
            validation_result['errors'].append(
                f"File extension {ext} not allowed for {asset_type}. "
                f"Allowed: {', '.join(asset_config['allowed_extensions'])}"
            )

        # Check file size
        max_size_bytes = asset_config['max_size_mb'] * 1024 * 1024
        if file_size > max_size_bytes:
            validation_result['valid'] = False
            validation_result['errors'].append(
                f"File size {file_size / (1024 * 1024):.1f}MB exceeds "
                f"maximum allowed {asset_config['max_size_mb']}MB for {asset_type}"
            )

        # Check filename length
        if len(filename) > 255:
            validation_result['valid'] = False
            validation_result['errors'].append("Filename too long (max 255 characters)")

        return validation_result

    def get_cache_headers(self, asset_type: str = 'documents') -> Dict[str, str]:
        """Get appropriate cache headers for asset type"""
        asset_config = self.asset_configs.get(asset_type, self.asset_configs['documents'])
        cache_ttl = asset_config['cache_ttl']

        return {
            'Cache-Control': f'public, max-age={cache_ttl}',
            'Expires': self._get_expires_header(cache_ttl),
            'ETag': None  # Will be set based on file content
        }

    def get_content_type(self, filename: str) -> str:
        """Get MIME type for filename"""
        content_type, _ = mimetypes.guess_type(filename)
        return content_type or 'application/octet-stream'

    def generate_etag(self, file_content: bytes) -> str:
        """Generate ETag for file content"""
        return f'"{hashlib.md5(file_content).hexdigest()}"'

    def get_asset_metadata(self, asset_path: str, asset_type: str = 'documents') -> Dict[str, Any]:
        """Get metadata for an asset"""
        return {
            'url': self.get_asset_url(asset_path, asset_type),
            'cache_headers': self.get_cache_headers(asset_type),
            'content_type': self.get_content_type(asset_path),
            'asset_type': asset_type,
            'cdn_enabled': self.cdn_enabled
        }

    def optimize_image_url(self, asset_path: str, width: Optional[int] = None, height: Optional[int] = None, format: Optional[str] = None) -> str:
        """Generate optimized image URL with transformations (if CDN supports it)"""
        base_url = self.get_asset_url(asset_path, 'images')

        if not self.cdn_enabled:
            # Local images can't be transformed
            return base_url

        # For CDNs that support image transformations (like CloudFront with Lambda@Edge)
        # This would need to be implemented based on your CDN provider
        params = []

        if width:
            params.append(f"w={width}")
        if height:
            params.append(f"h={height}")
        if format:
            params.append(f"f={format}")

        if params:
            # Example transformation URL structure
            # Real implementation depends on CDN provider
            transform_params = "&".join(params)
            return f"{base_url}?{transform_params}"

        return base_url

    def get_responsive_image_urls(self, asset_path: str) -> Dict[str, str]:
        """Generate responsive image URLs for different screen sizes"""
        if not self.cdn_enabled:
            # Return single URL for local assets
            base_url = self.get_asset_url(asset_path, 'images')
            return {
                'original': base_url,
                'large': base_url,
                'medium': base_url,
                'small': base_url,
                'thumbnail': base_url
            }

        # Generate different sizes
        return {
            'original': self.get_asset_url(asset_path, 'images'),
            'large': self.optimize_image_url(asset_path, width=1200),
            'medium': self.optimize_image_url(asset_path, width=800),
            'small': self.optimize_image_url(asset_path, width=400),
            'thumbnail': self.optimize_image_url(asset_path, width=150, height=150)
        }

    def purge_cache(self, asset_paths: List[str]) -> bool:
        """Purge CDN cache for specific assets"""
        if not self.cdn_enabled:
            logger.info("CDN not enabled, skipping cache purge")
            return True

        try:
            # This would integrate with your CDN provider's purge API
            # Example implementations for different providers:

            # CloudFront
            # self._purge_cloudfront(asset_paths)

            # CloudFlare
            # self._purge_cloudflare(asset_paths)

            # For now, just log the action
            logger.info(f"Would purge CDN cache for assets: {asset_paths}")
            return True

        except Exception as e:
            logger.error(f"Failed to purge CDN cache: {e}")
            return False

    def get_upload_signature(self, asset_type: str, filename: str) -> Dict[str, Any]:
        """Generate signed upload URL for direct-to-CDN uploads"""
        if not self.cdn_enabled:
            return {
                'upload_url': '/api/v1/assets/upload',
                'method': 'POST',
                'fields': {
                    'asset_type': asset_type,
                    'filename': filename
                }
            }

        # For CDNs that support direct uploads (like S3 with pre-signed URLs)
        # This would generate appropriate signed URLs
        asset_path = self.generate_asset_path(filename, asset_type)

        return {
            'upload_url': f"{self.cdn_base_url}/upload",
            'method': 'POST',
            'fields': {
                'key': asset_path,
                'content-type': self.get_content_type(filename),
                'cache-control': self.get_cache_headers(asset_type)['Cache-Control']
            },
            'expires': 3600  # 1 hour
        }

    # Private helper methods

    def _sanitize_filename(self, filename: str) -> str:
        """Sanitize filename for safe storage"""
        # Remove or replace unsafe characters
        unsafe_chars = '<>:"/\\|?*'
        for char in unsafe_chars:
            filename = filename.replace(char, '_')

        # Limit length and remove leading/trailing spaces
        return filename.strip()[:100]

    def _get_expires_header(self, cache_ttl: int) -> str:
        """Generate Expires header value"""
        from datetime import datetime, timedelta
        expires_time = datetime.utcnow() + timedelta(seconds=cache_ttl)
        return expires_time.strftime('%a, %d %b %Y %H:%M:%S GMT')

    def _purge_cloudfront(self, asset_paths: List[str]):
        """Purge CloudFront cache (example implementation)"""
        # Implementation would use boto3 CloudFront client
        pass

    def _purge_cloudflare(self, asset_paths: List[str]):
        """Purge CloudFlare cache (example implementation)"""
        # Implementation would use CloudFlare API
        pass


# Global CDN service instance
cdn_service = CDNService()


# Utility functions
def get_asset_url(asset_path: str, asset_type: str = 'documents') -> str:
    """Convenience function to get asset URL"""
    return cdn_service.get_asset_url(asset_path, asset_type)


def validate_upload(filename: str, file_size: int, asset_type: str = 'documents') -> Dict[str, Any]:
    """Convenience function to validate uploads"""
    return cdn_service.validate_asset(filename, file_size, asset_type)