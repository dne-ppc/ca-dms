"""
Advanced search service for full-text search and filtering
Task EXTRA.4: Advanced Search and Filtering implementation
"""
import re
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, or_, func
from datetime import datetime
from app.models.document import Document
from app.schemas.document import DocumentResponse


class SearchResult:
    """Container for search result with metadata"""
    
    def __init__(self, document: Document, relevance_score: float = 0.0, 
                 highlights: List[str] = None, preview: str = None):
        self.document = document
        self.relevance_score = relevance_score
        self.highlights = highlights or []
        self.preview = preview


class AdvancedSearchService:
    """Service for advanced document search functionality"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def extract_searchable_text(self, content: Dict[str, Any]) -> str:
        """Extract all searchable text from Quill Delta content including placeholders"""
        if not isinstance(content, dict) or "ops" not in content:
            return ""
        
        text_parts = []
        
        for op in content["ops"]:
            # Handle regular text
            if isinstance(op.get("insert"), str):
                text_parts.append(op["insert"])
            
            # Handle placeholder objects and extract their searchable content
            elif isinstance(op.get("insert"), dict):
                placeholder = op["insert"]
                
                # Extract text from signature placeholders
                if "signature" in placeholder:
                    sig_data = placeholder["signature"]
                    if "label" in sig_data:
                        text_parts.append(f" {sig_data['label']} ")
                
                # Extract text from version table placeholders
                elif "version-table" in placeholder:
                    version_data = placeholder["version-table"].get("data", {})
                    text_parts.extend([
                        f" Version {version_data.get('version', '')} ",
                        f" {version_data.get('author', '')} ",
                        f" {version_data.get('date', '')} "
                    ])
                
                # Extract text from long response placeholders
                elif "long-response" in placeholder:
                    resp_data = placeholder["long-response"]
                    if "label" in resp_data:
                        text_parts.append(f" {resp_data['label']} ")
                
                # Extract text from line segment placeholders
                elif "line-segment" in placeholder:
                    line_data = placeholder["line-segment"]
                    if "label" in line_data:
                        text_parts.append(f" {line_data['label']} ")
        
        return " ".join(text_parts).strip()
    
    def highlight_matches(self, text: str, query: str, 
                         start_tag: str = "<mark>", end_tag: str = "</mark>") -> str:
        """Highlight search term matches in text"""
        if not query or not text:
            return text
        
        # Escape special regex characters in query
        escaped_query = re.escape(query)
        
        # Case-insensitive highlighting
        pattern = re.compile(f"({escaped_query})", re.IGNORECASE)
        return pattern.sub(f"{start_tag}\\1{end_tag}", text)
    
    def generate_context_preview(self, text: str, query: str, 
                               context_length: int = 50) -> str:
        """Generate a context preview showing text around search matches"""
        if not query or not text:
            return text[:100] + "..." if len(text) > 100 else text
        
        # Find the first match
        query_lower = query.lower()
        text_lower = text.lower()
        match_index = text_lower.find(query_lower)
        
        if match_index == -1:
            # No match found, return beginning of text
            return text[:100] + "..." if len(text) > 100 else text
        
        # Calculate start and end positions for context
        start = max(0, match_index - context_length)
        end = min(len(text), match_index + len(query) + context_length)
        
        # Extract context and add ellipsis if truncated
        context = text[start:end]
        if start > 0:
            context = "..." + context
        if end < len(text):
            context = context + "..."
        
        return context
    
    def calculate_relevance_score(self, title: str, content_text: str, 
                                query: str) -> float:
        """Calculate relevance score for search results"""
        score = 0.0
        query_lower = query.lower()
        title_lower = title.lower()
        content_lower = content_text.lower()
        
        # Title matches have highest weight
        title_matches = title_lower.count(query_lower)
        score += title_matches * 10.0
        
        # Content matches have medium weight
        content_matches = content_lower.count(query_lower)
        score += content_matches * 1.0
        
        # Boost score for exact phrase matches
        if query_lower in title_lower:
            score += 20.0
        if query_lower in content_lower:
            score += 5.0
        
        # Boost score based on match position (earlier matches score higher)
        title_pos = title_lower.find(query_lower)
        if title_pos != -1:
            score += max(0, 5.0 - (title_pos / 10.0))
        
        content_pos = content_lower.find(query_lower)
        if content_pos != -1:
            score += max(0, 2.0 - (content_pos / 100.0))
        
        return score
    
    def build_filtered_query(self, filters: Dict[str, Any]):
        """Build SQLAlchemy query with filters applied"""
        query = self.db.query(Document)
        
        # Apply document type filter
        if filters.get("document_type"):
            query = query.filter(Document.document_type == filters["document_type"])
        
        # Apply author filter
        if filters.get("created_by"):
            query = query.filter(Document.created_by == filters["created_by"])
        
        # Apply date range filters
        if filters.get("created_after"):
            try:
                created_after = datetime.fromisoformat(filters["created_after"].replace('Z', '+00:00'))
                query = query.filter(Document.created_at >= created_after)
            except ValueError:
                pass  # Invalid date format, skip filter
        
        if filters.get("created_before"):
            try:
                created_before = datetime.fromisoformat(filters["created_before"].replace('Z', '+00:00'))
                query = query.filter(Document.created_at <= created_before)
            except ValueError:
                pass  # Invalid date format, skip filter
        
        return query
    
    def search_documents(
        self,
        query: Optional[str] = None,
        filters: Optional[Dict[str, Any]] = None,
        sort_by: str = "relevance",
        sort_order: str = "desc",
        limit: int = 50,
        offset: int = 0,
        include_highlights: bool = False,
        context_length: int = 50,
        search_placeholders: bool = True,
        fuzzy: bool = False
    ) -> Tuple[List[SearchResult], int, Dict[str, Any]]:
        """
        Perform advanced document search
        
        Returns:
            Tuple of (search_results, total_count, search_statistics)
        """
        start_time = datetime.now()
        filters = filters or {}
        
        # Start with filtered base query
        base_query = self.build_filtered_query(filters)
        
        # If no search query, just return filtered results
        if not query or query.strip() == "*":
            if sort_by == "created_at":
                base_query = base_query.order_by(
                    desc(Document.created_at) if sort_order == "desc" 
                    else Document.created_at
                )
            elif sort_by == "title":
                base_query = base_query.order_by(
                    desc(Document.title) if sort_order == "desc" 
                    else Document.title
                )
            else:
                base_query = base_query.order_by(desc(Document.updated_at))
            
            # Get paginated results
            documents = base_query.offset(offset).limit(limit).all()
            total = base_query.count()
            results = [SearchResult(doc) for doc in documents]
            
            # Generate statistics efficiently using database queries (not loading all docs)
            stats = self._generate_efficient_search_statistics(
                base_query, total, start_time, query
            )
            
            return results, total, stats
        
        # Get all potentially matching documents
        all_documents = base_query.all()
        
        # Perform text search and scoring
        search_results = []
        query_terms = query.lower().split() if query else []
        
        for doc in all_documents:
            # Extract searchable text
            content_text = self.extract_searchable_text(doc.content)
            searchable_text = f"{doc.title} {content_text}"
            
            # Check if document matches query
            matches_query = False
            
            if fuzzy:
                # Simple fuzzy matching - allow 1 character difference
                for term in query_terms:
                    if self._fuzzy_match(searchable_text.lower(), term):
                        matches_query = True
                        break
            else:
                # Exact term matching
                searchable_lower = searchable_text.lower()
                for term in query_terms:
                    if term in searchable_lower:
                        matches_query = True
                        break
            
            if matches_query:
                # Calculate relevance score
                score = self.calculate_relevance_score(doc.title, content_text, query)
                
                # Generate highlights and preview
                highlights = []
                preview = None
                
                if include_highlights:
                    highlighted_title = self.highlight_matches(doc.title, query)
                    highlighted_content = self.highlight_matches(content_text, query)
                    highlights = [highlighted_title, highlighted_content]
                
                if context_length > 0:
                    preview = self.generate_context_preview(
                        searchable_text, query, context_length
                    )
                
                search_results.append(SearchResult(
                    document=doc,
                    relevance_score=score,
                    highlights=highlights,
                    preview=preview
                ))
        
        # Sort results
        if sort_by == "relevance":
            search_results.sort(key=lambda x: x.relevance_score, reverse=(sort_order == "desc"))
        elif sort_by == "created_at":
            search_results.sort(
                key=lambda x: x.document.created_at, 
                reverse=(sort_order == "desc")
            )
        elif sort_by == "title":
            search_results.sort(
                key=lambda x: x.document.title.lower(),
                reverse=(sort_order == "desc")
            )
        
        # Apply pagination
        total_results = len(search_results)
        paginated_results = search_results[offset:offset + limit]
        
        # Generate statistics from all search results (not just current page)
        stats = self._generate_search_statistics(search_results, start_time, query)
        
        return paginated_results, total_results, stats
    
    def _fuzzy_match(self, text: str, term: str, max_distance: int = 1) -> bool:
        """Simple fuzzy matching using edit distance"""
        # For simplicity, check if term is in text or if similar terms exist
        if term in text:
            return True
        
        # Check for terms with 1 character difference
        words = text.split()
        for word in words:
            if abs(len(word) - len(term)) <= max_distance:
                if self._edit_distance(word, term) <= max_distance:
                    return True
        
        return False
    
    def _edit_distance(self, s1: str, s2: str) -> int:
        """Calculate simple edit distance between two strings"""
        if len(s1) < len(s2):
            return self._edit_distance(s2, s1)
        
        if len(s2) == 0:
            return len(s1)
        
        previous_row = list(range(len(s2) + 1))
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row
        
        return previous_row[-1]
    
    def _generate_efficient_search_statistics(
        self,
        base_query,
        total_count: int,
        start_time: datetime,
        query: Optional[str]
    ) -> Dict[str, Any]:
        """Generate search statistics efficiently using database queries"""
        from sqlalchemy import func
        from app.models.document import Document
        
        end_time = datetime.now()
        search_time_ms = (end_time - start_time).total_seconds() * 1000
        
        # Get document type breakdown using efficient SQL query
        type_breakdown_query = base_query.with_entities(
            Document.document_type,
            func.count(Document.document_type).label('count')
        ).group_by(Document.document_type)
        
        type_breakdown = {}
        for doc_type, count in type_breakdown_query:
            type_breakdown[doc_type] = count
        
        return {
            "total_matches": total_count,
            "search_time_ms": round(search_time_ms, 2),
            "document_type_breakdown": type_breakdown,
            "query": query,
            "timestamp": datetime.now().isoformat()
        }
    
    def _generate_search_statistics(
        self, 
        results: List[SearchResult], 
        start_time: datetime,
        query: Optional[str]
    ) -> Dict[str, Any]:
        """Generate search statistics"""
        end_time = datetime.now()
        search_time_ms = (end_time - start_time).total_seconds() * 1000
        
        # Document type breakdown
        type_breakdown = {}
        for result in results:
            doc_type = result.document.document_type
            type_breakdown[doc_type] = type_breakdown.get(doc_type, 0) + 1
        
        return {
            "total_matches": len(results),
            "search_time_ms": round(search_time_ms, 2),
            "document_type_breakdown": type_breakdown,
            "query": query,
            "timestamp": datetime.now().isoformat()
        }