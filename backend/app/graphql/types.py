"""
GraphQL types for CA-DMS API
"""
import strawberry
from typing import List, Optional, Dict, Any
from datetime import datetime


@strawberry.type
class User:
    """GraphQL User type"""
    id: str
    email: str
    name: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


@strawberry.type
class Document:
    """GraphQL Document type"""
    id: str
    title: str
    content: Dict[str, Any]
    status: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    version: int
    tags: Optional[List[str]] = None

    @strawberry.field
    def author(self) -> Optional[User]:
        """Get document author"""
        # This will be implemented in resolvers
        return None


@strawberry.type
class Template:
    """GraphQL Template type"""
    id: str
    name: str
    description: Optional[str] = None
    category: str
    content: Dict[str, Any]
    fields: List[Dict[str, Any]]
    is_active: bool
    created_by: str
    created_at: datetime
    updated_at: datetime
    usage_count: int

    @strawberry.field
    def author(self) -> Optional[User]:
        """Get template author"""
        return None


@strawberry.type
class Workflow:
    """GraphQL Workflow type"""
    id: str
    name: str
    description: Optional[str] = None
    steps: List[Dict[str, Any]]
    conditions: Optional[List[Dict[str, Any]]] = None
    is_active: bool
    created_by: str
    created_at: datetime
    updated_at: datetime


@strawberry.type
class WorkflowInstance:
    """GraphQL Workflow Instance type"""
    id: str
    workflow_id: str
    document_id: str
    status: str
    current_step: int
    assigned_to: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    @strawberry.field
    def workflow(self) -> Optional[Workflow]:
        """Get workflow definition"""
        return None

    @strawberry.field
    def document(self) -> Optional[Document]:
        """Get associated document"""
        return None


@strawberry.type
class Notification:
    """GraphQL Notification type"""
    id: str
    user_id: str
    type: str
    title: str
    message: str
    is_read: bool
    created_at: datetime

    @strawberry.field
    def user(self) -> Optional[User]:
        """Get notification recipient"""
        return None


@strawberry.type
class APIKey:
    """GraphQL API Key type"""
    id: str
    name: str
    key_prefix: str
    permissions: List[str]
    is_active: bool
    created_by: str
    created_at: datetime
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None


@strawberry.type
class Webhook:
    """GraphQL Webhook type"""
    id: str
    name: str
    url: str
    events: List[str]
    secret: Optional[str] = None
    is_active: bool
    created_by: str
    created_at: datetime
    updated_at: datetime
    last_triggered_at: Optional[datetime] = None
    success_count: int
    failure_count: int


@strawberry.type
class SearchResult:
    """GraphQL Search Result type"""
    total_count: int
    documents: List[Document]
    templates: List[Template]
    workflows: List[Workflow]


@strawberry.input
class DocumentFilter:
    """GraphQL Document filter input"""
    status: Optional[str] = None
    created_by: Optional[str] = None
    created_after: Optional[datetime] = None
    created_before: Optional[datetime] = None
    tags: Optional[List[str]] = None
    search_query: Optional[str] = None


@strawberry.input
class TemplateFilter:
    """GraphQL Template filter input"""
    category: Optional[str] = None
    is_active: Optional[bool] = None
    created_by: Optional[str] = None
    search_query: Optional[str] = None


@strawberry.input
class WorkflowFilter:
    """GraphQL Workflow filter input"""
    is_active: Optional[bool] = None
    created_by: Optional[str] = None
    search_query: Optional[str] = None


@strawberry.input
class PaginationInput:
    """GraphQL Pagination input"""
    limit: int = 10
    offset: int = 0
    order_by: Optional[str] = None
    order_direction: Optional[str] = "desc"


@strawberry.input
class CreateDocumentInput:
    """GraphQL Create Document input"""
    title: str
    content: Dict[str, Any]
    template_id: Optional[str] = None
    tags: Optional[List[str]] = None


@strawberry.input
class UpdateDocumentInput:
    """GraphQL Update Document input"""
    title: Optional[str] = None
    content: Optional[Dict[str, Any]] = None
    status: Optional[str] = None
    tags: Optional[List[str]] = None


@strawberry.input
class CreateWebhookInput:
    """GraphQL Create Webhook input"""
    name: str
    url: str
    events: List[str]
    secret: Optional[str] = None


@strawberry.input
class CreateAPIKeyInput:
    """GraphQL Create API Key input"""
    name: str
    permissions: List[str]
    expires_at: Optional[datetime] = None