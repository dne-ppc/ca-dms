"""
GraphQL resolvers for CA-DMS API
"""
import strawberry
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.document import Document as DocumentModel
from app.models.document_template import DocumentTemplate as TemplateModel
from app.models.workflow import Workflow as WorkflowModel, WorkflowInstance as WorkflowInstanceModel
from app.models.notification import Notification as NotificationModel
from app.models.external_integration import APIKey as APIKeyModel, Webhook as WebhookModel
from app.graphql.types import (
    Document, Template, Workflow, WorkflowInstance, Notification, APIKey, Webhook,
    SearchResult, DocumentFilter, TemplateFilter, WorkflowFilter, PaginationInput,
    CreateDocumentInput, UpdateDocumentInput, CreateWebhookInput, CreateAPIKeyInput
)


def get_context() -> dict:
    """Get GraphQL context with database and user"""
    return {"db": get_db(), "user": get_current_user}


@strawberry.type
class Query:
    """GraphQL Query root"""

    @strawberry.field
    def documents(
        self,
        info: strawberry.Info,
        filter: Optional[DocumentFilter] = None,
        pagination: Optional[PaginationInput] = None
    ) -> List[Document]:
        """Get documents with filtering and pagination"""
        db: Session = info.context["db"]

        query = db.query(DocumentModel)

        if filter:
            if filter.status:
                query = query.filter(DocumentModel.status == filter.status)
            if filter.created_by:
                query = query.filter(DocumentModel.created_by == filter.created_by)
            if filter.created_after:
                query = query.filter(DocumentModel.created_at >= filter.created_after)
            if filter.created_before:
                query = query.filter(DocumentModel.created_at <= filter.created_before)
            if filter.search_query:
                query = query.filter(DocumentModel.title.ilike(f"%{filter.search_query}%"))

        if pagination:
            if pagination.order_by:
                order_field = getattr(DocumentModel, pagination.order_by, DocumentModel.created_at)
                if pagination.order_direction == "asc":
                    query = query.order_by(order_field.asc())
                else:
                    query = query.order_by(order_field.desc())

            query = query.offset(pagination.offset).limit(pagination.limit)

        documents = query.all()
        return [
            Document(
                id=str(doc.id),
                title=doc.title,
                content=doc.content,
                status=doc.status,
                created_by=str(doc.created_by),
                created_at=doc.created_at,
                updated_at=doc.updated_at,
                version=doc.version,
                tags=doc.tags or []
            )
            for doc in documents
        ]

    @strawberry.field
    def document(self, info: strawberry.Info, id: str) -> Optional[Document]:
        """Get document by ID"""
        db: Session = info.context["db"]
        doc = db.query(DocumentModel).filter(DocumentModel.id == id).first()

        if not doc:
            return None

        return Document(
            id=str(doc.id),
            title=doc.title,
            content=doc.content,
            status=doc.status,
            created_by=str(doc.created_by),
            created_at=doc.created_at,
            updated_at=doc.updated_at,
            version=doc.version,
            tags=doc.tags or []
        )

    @strawberry.field
    def templates(
        self,
        info: strawberry.Info,
        filter: Optional[TemplateFilter] = None,
        pagination: Optional[PaginationInput] = None
    ) -> List[Template]:
        """Get templates with filtering and pagination"""
        db: Session = info.context["db"]

        query = db.query(TemplateModel)

        if filter:
            if filter.category:
                query = query.filter(TemplateModel.category == filter.category)
            if filter.is_active is not None:
                query = query.filter(TemplateModel.is_active == filter.is_active)
            if filter.created_by:
                query = query.filter(TemplateModel.created_by == filter.created_by)
            if filter.search_query:
                query = query.filter(TemplateModel.name.ilike(f"%{filter.search_query}%"))

        if pagination:
            if pagination.order_by:
                order_field = getattr(TemplateModel, pagination.order_by, TemplateModel.created_at)
                if pagination.order_direction == "asc":
                    query = query.order_by(order_field.asc())
                else:
                    query = query.order_by(order_field.desc())

            query = query.offset(pagination.offset).limit(pagination.limit)

        templates = query.all()
        return [
            Template(
                id=str(template.id),
                name=template.name,
                description=template.description,
                category=template.category,
                content=template.content,
                fields=template.fields or [],
                is_active=template.is_active,
                created_by=str(template.created_by),
                created_at=template.created_at,
                updated_at=template.updated_at,
                usage_count=template.usage_count or 0
            )
            for template in templates
        ]

    @strawberry.field
    def workflows(
        self,
        info: strawberry.Info,
        filter: Optional[WorkflowFilter] = None,
        pagination: Optional[PaginationInput] = None
    ) -> List[Workflow]:
        """Get workflows with filtering and pagination"""
        db: Session = info.context["db"]

        query = db.query(WorkflowModel)

        if filter:
            if filter.is_active is not None:
                query = query.filter(WorkflowModel.is_active == filter.is_active)
            if filter.created_by:
                query = query.filter(WorkflowModel.created_by == filter.created_by)
            if filter.search_query:
                query = query.filter(WorkflowModel.name.ilike(f"%{filter.search_query}%"))

        if pagination:
            if pagination.order_by:
                order_field = getattr(WorkflowModel, pagination.order_by, WorkflowModel.created_at)
                if pagination.order_direction == "asc":
                    query = query.order_by(order_field.asc())
                else:
                    query = query.order_by(order_field.desc())

            query = query.offset(pagination.offset).limit(pagination.limit)

        workflows = query.all()
        return [
            Workflow(
                id=str(workflow.id),
                name=workflow.name,
                description=workflow.description,
                steps=workflow.steps or [],
                conditions=workflow.conditions or [],
                is_active=workflow.is_active,
                created_by=str(workflow.created_by),
                created_at=workflow.created_at,
                updated_at=workflow.updated_at
            )
            for workflow in workflows
        ]

    @strawberry.field
    def search(
        self,
        info: strawberry.Info,
        query: str,
        types: Optional[List[str]] = None,
        pagination: Optional[PaginationInput] = None
    ) -> SearchResult:
        """Universal search across documents, templates, and workflows"""
        db: Session = info.context["db"]

        documents = []
        templates = []
        workflows = []
        total_count = 0

        search_types = types or ["documents", "templates", "workflows"]

        if "documents" in search_types:
            doc_query = db.query(DocumentModel).filter(
                DocumentModel.title.ilike(f"%{query}%")
            )
            if pagination:
                doc_query = doc_query.offset(pagination.offset).limit(pagination.limit)
            docs = doc_query.all()
            documents = [
                Document(
                    id=str(doc.id),
                    title=doc.title,
                    content=doc.content,
                    status=doc.status,
                    created_by=str(doc.created_by),
                    created_at=doc.created_at,
                    updated_at=doc.updated_at,
                    version=doc.version,
                    tags=doc.tags or []
                )
                for doc in docs
            ]
            total_count += len(documents)

        if "templates" in search_types:
            template_query = db.query(TemplateModel).filter(
                TemplateModel.name.ilike(f"%{query}%")
            )
            if pagination:
                template_query = template_query.offset(pagination.offset).limit(pagination.limit)
            temps = template_query.all()
            templates = [
                Template(
                    id=str(template.id),
                    name=template.name,
                    description=template.description,
                    category=template.category,
                    content=template.content,
                    fields=template.fields or [],
                    is_active=template.is_active,
                    created_by=str(template.created_by),
                    created_at=template.created_at,
                    updated_at=template.updated_at,
                    usage_count=template.usage_count or 0
                )
                for template in temps
            ]
            total_count += len(templates)

        if "workflows" in search_types:
            workflow_query = db.query(WorkflowModel).filter(
                WorkflowModel.name.ilike(f"%{query}%")
            )
            if pagination:
                workflow_query = workflow_query.offset(pagination.offset).limit(pagination.limit)
            flows = workflow_query.all()
            workflows = [
                Workflow(
                    id=str(workflow.id),
                    name=workflow.name,
                    description=workflow.description,
                    steps=workflow.steps or [],
                    conditions=workflow.conditions or [],
                    is_active=workflow.is_active,
                    created_by=str(workflow.created_by),
                    created_at=workflow.created_at,
                    updated_at=workflow.updated_at
                )
                for workflow in flows
            ]
            total_count += len(workflows)

        return SearchResult(
            total_count=total_count,
            documents=documents,
            templates=templates,
            workflows=workflows
        )

    @strawberry.field
    def webhooks(self, info: strawberry.Info) -> List[Webhook]:
        """Get all webhooks"""
        db: Session = info.context["db"]
        webhooks = db.query(WebhookModel).all()

        return [
            Webhook(
                id=str(webhook.id),
                name=webhook.name,
                url=webhook.url,
                events=webhook.events or [],
                is_active=webhook.is_active,
                created_by=str(webhook.created_by),
                created_at=webhook.created_at,
                updated_at=webhook.updated_at,
                last_triggered_at=webhook.last_triggered_at,
                success_count=webhook.success_count or 0,
                failure_count=webhook.failure_count or 0
            )
            for webhook in webhooks
        ]

    @strawberry.field
    def api_keys(self, info: strawberry.Info) -> List[APIKey]:
        """Get all API keys"""
        db: Session = info.context["db"]
        api_keys = db.query(APIKeyModel).all()

        return [
            APIKey(
                id=str(key.id),
                name=key.name,
                key_prefix=key.key_prefix,
                permissions=key.permissions or [],
                is_active=key.is_active,
                created_by=str(key.created_by),
                created_at=key.created_at,
                expires_at=key.expires_at,
                last_used_at=key.last_used_at
            )
            for key in api_keys
        ]


@strawberry.type
class Mutation:
    """GraphQL Mutation root"""

    @strawberry.mutation
    def create_document(
        self,
        info: strawberry.Info,
        input: CreateDocumentInput
    ) -> Document:
        """Create a new document"""
        db: Session = info.context["db"]
        current_user = info.context["user"]

        document = DocumentModel(
            title=input.title,
            content=input.content,
            created_by=current_user.id,
            status="draft",
            version=1,
            tags=input.tags
        )

        db.add(document)
        db.commit()
        db.refresh(document)

        return Document(
            id=str(document.id),
            title=document.title,
            content=document.content,
            status=document.status,
            created_by=str(document.created_by),
            created_at=document.created_at,
            updated_at=document.updated_at,
            version=document.version,
            tags=document.tags or []
        )

    @strawberry.mutation
    def update_document(
        self,
        info: strawberry.Info,
        id: str,
        input: UpdateDocumentInput
    ) -> Optional[Document]:
        """Update an existing document"""
        db: Session = info.context["db"]

        document = db.query(DocumentModel).filter(DocumentModel.id == id).first()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        if input.title is not None:
            document.title = input.title
        if input.content is not None:
            document.content = input.content
            document.version += 1
        if input.status is not None:
            document.status = input.status
        if input.tags is not None:
            document.tags = input.tags

        db.commit()
        db.refresh(document)

        return Document(
            id=str(document.id),
            title=document.title,
            content=document.content,
            status=document.status,
            created_by=str(document.created_by),
            created_at=document.created_at,
            updated_at=document.updated_at,
            version=document.version,
            tags=document.tags or []
        )

    @strawberry.mutation
    def create_webhook(
        self,
        info: strawberry.Info,
        input: CreateWebhookInput
    ) -> Webhook:
        """Create a new webhook"""
        db: Session = info.context["db"]
        current_user = info.context["user"]

        webhook = WebhookModel(
            name=input.name,
            url=input.url,
            events=input.events,
            secret=input.secret,
            is_active=True,
            created_by=current_user.id,
            success_count=0,
            failure_count=0
        )

        db.add(webhook)
        db.commit()
        db.refresh(webhook)

        return Webhook(
            id=str(webhook.id),
            name=webhook.name,
            url=webhook.url,
            events=webhook.events or [],
            is_active=webhook.is_active,
            created_by=str(webhook.created_by),
            created_at=webhook.created_at,
            updated_at=webhook.updated_at,
            last_triggered_at=webhook.last_triggered_at,
            success_count=webhook.success_count or 0,
            failure_count=webhook.failure_count or 0
        )

    @strawberry.mutation
    def create_api_key(
        self,
        info: strawberry.Info,
        input: CreateAPIKeyInput
    ) -> APIKey:
        """Create a new API key"""
        db: Session = info.context["db"]
        current_user = info.context["user"]

        import secrets
        key_value = secrets.token_urlsafe(32)
        key_prefix = key_value[:8]

        api_key = APIKeyModel(
            name=input.name,
            key_value=key_value,
            key_prefix=key_prefix,
            permissions=input.permissions,
            is_active=True,
            created_by=current_user.id,
            expires_at=input.expires_at
        )

        db.add(api_key)
        db.commit()
        db.refresh(api_key)

        return APIKey(
            id=str(api_key.id),
            name=api_key.name,
            key_prefix=api_key.key_prefix,
            permissions=api_key.permissions or [],
            is_active=api_key.is_active,
            created_by=str(api_key.created_by),
            created_at=api_key.created_at,
            expires_at=api_key.expires_at,
            last_used_at=api_key.last_used_at
        )