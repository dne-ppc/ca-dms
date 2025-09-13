"""
Cached Document Service with Redis Integration

Extends the base DocumentService with Redis caching for improved performance.
Implements cache-aside pattern with intelligent cache invalidation.
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
import json
import logging

from app.services.document_service import DocumentService
from app.services.cache_service import cache_service, cached
from app.models.document import Document
from app.schemas.document import DocumentCreate, DocumentUpdate, DocumentResponse


logger = logging.getLogger(__name__)


class CachedDocumentService(DocumentService):
    """Enhanced document service with Redis caching"""

    def __init__(self, db: Session):
        super().__init__(db)
        self.cache_type = "document"

    async def get_document_cached(self, document_id: str) -> Optional[Document]:
        """Get document with caching support"""
        # Try cache first
        cached_doc = await cache_service.get(self.cache_type, f"doc:{document_id}")
        if cached_doc:
            logger.debug(f"Cache hit for document {document_id}")
            # Convert cached dict back to Document object
            return self._dict_to_document(cached_doc)

        # Cache miss - fetch from database
        logger.debug(f"Cache miss for document {document_id}")
        db_document = self.get_document(document_id)

        if db_document:
            # Cache the document
            doc_dict = self._document_to_dict(db_document)
            await cache_service.set(self.cache_type, f"doc:{document_id}", doc_dict)

        return db_document

    async def get_documents_cached(
        self,
        skip: int = 0,
        limit: int = 100,
        document_type: Optional[str] = None
    ) -> List[Document]:
        """Get documents list with caching"""
        # Create cache key based on parameters
        cache_key = f"docs:skip:{skip}:limit:{limit}:type:{document_type or 'all'}"

        # Try cache first
        cached_docs = await cache_service.get(self.cache_type, cache_key)
        if cached_docs:
            logger.debug(f"Cache hit for document list {cache_key}")
            return [self._dict_to_document(doc_dict) for doc_dict in cached_docs]

        # Cache miss - fetch from database
        logger.debug(f"Cache miss for document list {cache_key}")
        db_documents = self.get_documents(skip, limit, document_type)

        if db_documents:
            # Cache the document list
            docs_dict_list = [self._document_to_dict(doc) for doc in db_documents]
            await cache_service.set(self.cache_type, cache_key, docs_dict_list, ttl=600)  # 10 minutes for lists

        return db_documents

    async def create_document_cached(self, document_data: DocumentCreate, created_by: Optional[str] = None) -> Document:
        """Create document and manage cache invalidation"""
        # Create document using parent method
        db_document = self.create_document(document_data, created_by)

        # Cache the new document
        doc_dict = self._document_to_dict(db_document)
        await cache_service.set(self.cache_type, f"doc:{db_document.id}", doc_dict)

        # Invalidate document lists cache (they now contain stale data)
        await self._invalidate_document_lists()

        # Warm cache with commonly accessed data
        await self._warm_related_caches(db_document)

        logger.info(f"Created and cached document {db_document.id}")
        return db_document

    async def update_document_cached(self, document_id: str, document_data: DocumentUpdate, updated_by: Optional[str] = None) -> Optional[Document]:
        """Update document and manage cache invalidation"""
        # Update document using parent method
        db_document = self.update_document(document_id, document_data, updated_by)

        if db_document:
            # Update cache with new document data
            doc_dict = self._document_to_dict(db_document)
            await cache_service.set(self.cache_type, f"doc:{document_id}", doc_dict)

            # Invalidate related caches
            await self._invalidate_related_caches(db_document)

            logger.info(f"Updated and cached document {document_id}")

        return db_document

    async def delete_document_cached(self, document_id: str) -> bool:
        """Delete document and clean up cache"""
        # Get document before deletion for cache cleanup
        document = await self.get_document_cached(document_id)

        # Delete document using parent method
        deleted = self.delete_document(document_id)

        if deleted:
            # Remove from cache
            await cache_service.delete(self.cache_type, f"doc:{document_id}")

            # Invalidate related caches
            if document:
                await self._invalidate_related_caches(document)

            # Invalidate document lists
            await self._invalidate_document_lists()

            logger.info(f"Deleted and removed from cache document {document_id}")

        return deleted

    async def search_documents_cached(self, query: str) -> List[Document]:
        """Search documents with caching"""
        cache_key = f"search:{hash(query)}"

        # Try cache first (shorter TTL for search results)
        cached_results = await cache_service.get("search", cache_key)
        if cached_results:
            logger.debug(f"Cache hit for search query: {query}")
            return [self._dict_to_document(doc_dict) for doc_dict in cached_results]

        # Cache miss - search database
        logger.debug(f"Cache miss for search query: {query}")
        db_documents = self.search_documents(query)

        if db_documents:
            # Cache search results with shorter TTL
            docs_dict_list = [self._document_to_dict(doc) for doc in db_documents]
            await cache_service.set("search", cache_key, docs_dict_list, ttl=300)  # 5 minutes for search

        return db_documents

    async def get_documents_by_type_cached(self, document_type: str) -> List[Document]:
        """Get documents by type with caching"""
        cache_key = f"type:{document_type}"

        # Try cache first
        cached_docs = await cache_service.get(self.cache_type, cache_key)
        if cached_docs:
            logger.debug(f"Cache hit for document type: {document_type}")
            return [self._dict_to_document(doc_dict) for doc_dict in cached_docs]

        # Cache miss - fetch from database
        logger.debug(f"Cache miss for document type: {document_type}")
        db_documents = self.get_documents_by_type(document_type)

        if db_documents:
            # Cache documents by type
            docs_dict_list = [self._document_to_dict(doc) for doc in db_documents]
            await cache_service.set(self.cache_type, cache_key, docs_dict_list, ttl=1800)  # 30 minutes

        return db_documents

    async def get_popular_documents(self, limit: int = 10) -> List[Document]:
        """Get most accessed documents from cache statistics"""
        cache_key = f"popular:limit:{limit}"

        # Try cache first
        cached_popular = await cache_service.get(self.cache_type, cache_key)
        if cached_popular:
            return [self._dict_to_document(doc_dict) for doc_dict in cached_popular]

        # This would require tracking access counts in Redis
        # For now, return recent documents as a fallback
        recent_docs = await self.get_documents_cached(skip=0, limit=limit)

        if recent_docs:
            docs_dict_list = [self._document_to_dict(doc) for doc in recent_docs]
            await cache_service.set(self.cache_type, cache_key, docs_dict_list, ttl=1800)

        return recent_docs

    async def warm_document_cache(self, document_ids: List[str]):
        """Warm cache with specific documents"""
        logger.info(f"Warming cache for {len(document_ids)} documents")

        # Batch fetch documents that aren't cached
        uncached_ids = []
        for doc_id in document_ids:
            if not await cache_service.exists(self.cache_type, f"doc:{doc_id}"):
                uncached_ids.append(doc_id)

        if uncached_ids:
            # Fetch uncached documents in batches
            for doc_id in uncached_ids:
                document = self.get_document(doc_id)
                if document:
                    doc_dict = self._document_to_dict(document)
                    await cache_service.set(self.cache_type, f"doc:{doc_id}", doc_dict)

    async def get_cache_stats(self) -> Optional[Dict[str, Any]]:
        """Get caching statistics"""
        stats = await cache_service.get_stats()
        if stats:
            return {
                "redis_stats": stats.dict(),
                "document_cache_keys": len(await self._get_document_cache_keys()),
            }
        return None

    # Helper methods

    def _document_to_dict(self, document: Document) -> Dict[str, Any]:
        """Convert Document object to dictionary for caching"""
        return {
            "id": document.id,
            "title": document.title,
            "content": document.content,
            "document_type": document.document_type,
            "placeholders": document.placeholders,
            "version": document.version,
            "created_by": document.created_by,
            "created_at": document.created_at.isoformat() if document.created_at else None,
            "updated_at": document.updated_at.isoformat() if document.updated_at else None,
            "status": document.status
        }

    def _dict_to_document(self, doc_dict: Dict[str, Any]) -> Document:
        """Convert dictionary back to Document object"""
        document = Document()
        document.id = doc_dict["id"]
        document.title = doc_dict["title"]
        document.content = doc_dict["content"]
        document.document_type = doc_dict["document_type"]
        document.placeholders = doc_dict["placeholders"]
        document.version = doc_dict["version"]
        document.created_by = doc_dict["created_by"]
        document.status = doc_dict.get("status", "draft")

        # Parse datetime fields if they exist
        if doc_dict.get("created_at"):
            from datetime import datetime
            document.created_at = datetime.fromisoformat(doc_dict["created_at"])
        if doc_dict.get("updated_at"):
            from datetime import datetime
            document.updated_at = datetime.fromisoformat(doc_dict["updated_at"])

        return document

    async def _invalidate_document_lists(self):
        """Invalidate all document list caches"""
        patterns = [
            "docs:*",
            "type:*",
            "popular:*"
        ]

        for pattern in patterns:
            await cache_service.delete_pattern(self.cache_type, pattern)

        logger.debug("Invalidated document list caches")

    async def _invalidate_related_caches(self, document: Document):
        """Invalidate caches related to a specific document"""
        # Invalidate document-specific caches
        await cache_service.delete(self.cache_type, f"doc:{document.id}")

        # Invalidate type-specific caches
        await cache_service.delete_pattern(self.cache_type, f"type:{document.document_type}")

        # Invalidate search caches (could be more intelligent)
        await cache_service.delete_pattern("search", "*")

        # Invalidate document lists
        await self._invalidate_document_lists()

    async def _warm_related_caches(self, document: Document):
        """Warm up related caches for a new document"""
        # This could include preloading related documents, templates, etc.
        # For now, just ensure the document itself is cached
        doc_dict = self._document_to_dict(document)
        await cache_service.set(self.cache_type, f"doc:{document.id}", doc_dict)

    async def _get_document_cache_keys(self) -> List[str]:
        """Get all document-related cache keys"""
        try:
            # This would require Redis KEYS command (use carefully in production)
            # In production, consider maintaining a separate index
            return []  # Placeholder implementation
        except Exception as e:
            logger.error(f"Error getting cache keys: {e}")
            return []


# Utility functions for use with dependency injection

async def get_cached_document_service(db: Session) -> CachedDocumentService:
    """Dependency to get cached document service instance"""
    return CachedDocumentService(db)


# Cache warming utility
async def warm_document_cache_batch(service: CachedDocumentService, batch_size: int = 50):
    """Warm cache with most recently accessed documents"""
    try:
        # Get recent document IDs
        documents = service.get_documents(skip=0, limit=batch_size)
        document_ids = [doc.id for doc in documents]

        if document_ids:
            await service.warm_document_cache(document_ids)
            logger.info(f"Warmed cache with {len(document_ids)} documents")
    except Exception as e:
        logger.error(f"Cache warming failed: {e}")