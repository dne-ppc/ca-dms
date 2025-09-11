# CA-DMS Implementation Guidelines

## Code Quality and Standards Documentation

Based on the comprehensive specification, implementation plan, and task breakdown for the Community Association Document Management System (CA-DMS), this document provides specific coding standards, quality guidelines, and implementation best practices to ensure consistent, maintainable, and high-quality code delivery.

---

## 1. General Development Standards

### 1.1 Core Development Principles

**Test-Driven Development (TDD) - Non-Negotiable**
- **Red-Green-Refactor Cycle**: Every feature begins with a failing test
- **Commit Structure**: Follow atomic commit pattern:
  1. `test: add failing test for [feature]` 
  2. `feat: implement [feature] - passes test`
  3. `refactor: improve [aspect] of [feature]` (optional)
- **Coverage Requirements**: 
  - Business logic: 95%+ coverage
  - Overall codebase: 90%+ coverage
  - Critical paths (E2E): 100% coverage

**Code Quality Metrics**
- **Cyclomatic Complexity**: ≤ 10 per function/method
- **Maintainability Index**: > 65/100
- **Code Duplication**: < 5%
- **API Response Times**: < 200ms (95th percentile)
- **PDF Generation**: < 3s (95th percentile)

### 1.2 Version Control Standards

**Branch Strategy**
- **Main Branch**: Production-ready code only
- **Develop Branch**: Integration branch for features
- **Feature Branches**: `feature/task-number-description`
- **Hotfix Branches**: `hotfix/issue-description`

**Commit Message Format**
```
type(scope): description

[optional body]

[optional footer(s)]
```

**Types**: `feat`, `fix`, `test`, `refactor`, `docs`, `style`, `chore`
**Scopes**: `frontend`, `backend`, `editor`, `pdf`, `workflow`, `auth`

**Examples**:
- `test(editor): add failing test for VersionTableBlot immutability`
- `feat(editor): implement VersionTableBlot with deletion prevention`
- `refactor(api): improve document service error handling`

---

## 2. Frontend Standards (React + TypeScript)

### 2.1 TypeScript Configuration

**Required tsconfig.json Settings**
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true
  }
}
```

**Type Safety Requirements**
- **No `any` types**: Use proper interfaces or generic types
- **Explicit return types**: For all functions and methods
- **Props interfaces**: All React components must have typed props
- **State typing**: Zustand stores must have complete type definitions

### 2.2 React Component Standards

**Component Structure**
```typescript
// ✅ Correct structure
interface ComponentProps {
  readonly prop1: string;
  readonly prop2?: number;
  readonly onAction: (data: ActionData) => void;
}

export const Component: React.FC<ComponentProps> = ({ 
  prop1, 
  prop2 = 0, 
  onAction 
}) => {
  // Component implementation
};

// ✅ Export types for external use
export type { ComponentProps };
```

**Naming Conventions**
- **Components**: PascalCase (`QuillEditor`, `SignatureBlot`)
- **Props interfaces**: ComponentName + `Props` (`QuillEditorProps`)
- **Custom hooks**: `use` prefix (`useDocumentStore`, `usePlaceholder`)
- **Event handlers**: `handle` prefix (`handleContentChange`, `handleSave`)
- **Boolean variables**: `is/has/can/should` prefix (`isDirty`, `hasPermission`)

**File Organization**
```
src/
├── components/
│   ├── editor/
│   │   ├── QuillEditor.tsx
│   │   ├── QuillEditor.test.tsx
│   │   ├── CustomToolbar.tsx
│   │   └── index.ts (re-exports)
│   └── common/
├── hooks/
├── stores/
├── types/
│   ├── document.ts
│   ├── placeholder.ts
│   └── index.ts
├── utils/
└── constants/
```

### 2.3 Quill Editor Custom Implementation

**Custom Blot Standards**
```typescript
// ✅ Blot implementation template
import { BlockEmbed, Inline } from 'parchment';

export interface BlotConfig {
  readonly id: string;
  readonly [key: string]: unknown;
}

export class CustomBlot extends BlockEmbed {
  static readonly blotName = 'custom-blot';
  static readonly tagName = 'div';
  static readonly className = 'custom-blot';

  static create(config: BlotConfig): HTMLElement {
    const node = super.create() as HTMLElement;
    node.setAttribute('data-id', config.id);
    node.setAttribute('contenteditable', 'false');
    return node;
  }

  static value(node: HTMLElement): BlotConfig {
    return {
      id: node.getAttribute('data-id') || ''
    };
  }

  // Prevent unwanted operations
  deleteAt(): void { return; }
  formatAt(): void { return; }
}
```

**Blot Registration**
```typescript
// ✅ Centralized registration
import Quill from 'quill';

export const registerCustomBlots = (): void => {
  Quill.register('formats/version-table', VersionTableBlot);
  Quill.register('formats/signature', SignatureBlot);
  Quill.register('formats/long-response', LongResponseBlot);
  Quill.register('formats/line-segment', LineSegmentBlot);
};
```

### 2.4 State Management (Zustand)

**Store Structure Template**
```typescript
interface DocumentState {
  // State
  readonly currentDocument: Document | null;
  readonly placeholders: readonly PlaceholderObject[];
  readonly isLoading: boolean;
  readonly error: string | null;
  
  // Actions (not readonly)
  setDocument: (doc: Document) => void;
  addPlaceholder: (placeholder: PlaceholderObject) => void;
  clearError: () => void;
}

export const useDocumentStore = create<DocumentState>()((set, get) => ({
  // Initial state
  currentDocument: null,
  placeholders: [],
  isLoading: false,
  error: null,
  
  // Actions
  setDocument: (doc) => set({ currentDocument: doc }),
  addPlaceholder: (placeholder) => set(state => ({
    placeholders: [...state.placeholders, placeholder]
  })),
  clearError: () => set({ error: null })
}));
```

### 2.5 Testing Standards

**Unit Test Structure (Vitest)**
```typescript
// ✅ Test structure template
import { describe, test, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('ComponentName', () => {
  beforeEach(() => {
    // Setup for each test
  });

  test('should render with required props', () => {
    // Arrange
    const props = { /* test props */ };
    
    // Act
    render(<Component {...props} />);
    
    // Assert
    expect(screen.getByRole('...')).toBeInTheDocument();
  });

  test('should handle user interactions correctly', async () => {
    // Test user interactions
  });
});
```

**Custom Blot Testing**
```typescript
describe('VersionTableBlot', () => {
  test('should create immutable version table', () => {
    const config = { version: '1.0', author: 'Test User' };
    const blot = VersionTableBlot.create(config);
    
    expect(blot.getAttribute('contenteditable')).toBe('false');
    expect(blot.getAttribute('data-immutable')).toBe('true');
  });

  test('should prevent deletion attempts', () => {
    const blot = VersionTableBlot.create(mockData);
    const result = blot.deleteAt(0, 1);
    
    expect(result).toBeUndefined();
    expect(blot.domNode.parentNode).toBeTruthy();
  });
});
```

---

## 3. Backend Standards (FastAPI + Python)

### 3.1 Python Code Standards

**PEP 8 Compliance**
- **Line length**: 88 characters (Black formatter standard)
- **Indentation**: 4 spaces (no tabs)
- **Naming conventions**:
  - Functions/variables: `snake_case`
  - Classes: `PascalCase`
  - Constants: `UPPER_SNAKE_CASE`
  - Private attributes: `_leading_underscore`

**Type Hints (Required)**
```python
# ✅ Proper type annotations
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

def process_document(
    document_id: str,
    placeholders: List[PlaceholderObject],
    options: Optional[Dict[str, Any]] = None
) -> DocumentResult:
    """Process document with placeholders."""
    # Implementation
```

### 3.2 FastAPI Project Structure

**Required Directory Organization**
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── database.py
│   │   └── security.py
│   ├── api/
│   │   ├── __init__.py
│   │   ├── v1/
│   │   │   ├── __init__.py
│   │   │   ├── documents.py
│   │   │   ├── workflow.py
│   │   │   └── auth.py
│   │   └── dependencies.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── document.py
│   │   └── user.py
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── document.py
│   │   └── user.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── document_service.py
│   │   └── pdf_service.py
│   └── tests/
├── requirements/
│   ├── base.txt
│   ├── dev.txt
│   └── prod.txt
└── migrations/
```

### 3.3 Pydantic Models and Validation

**Schema Design Standards**
```python
# ✅ Proper Pydantic schema
from pydantic import BaseModel, Field, validator
from typing import List, Optional
from datetime import datetime

class DocumentCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content_delta: Dict[str, Any] = Field(..., description="Quill Delta format")
    object_placeholders: List[PlaceholderObject] = Field(default_factory=list)
    category_id: Optional[str] = Field(None, regex=r'^[a-fA-F0-9-]{36}$')
    
    @validator('title')
    def validate_title(cls, v):
        if not v.strip():
            raise ValueError('Title cannot be empty')
        return v.strip()
    
    class Config:
        schema_extra = {
            "example": {
                "title": "Board Resolution 2024-01",
                "content_delta": {"ops": [{"insert": "Content here"}]},
                "object_placeholders": []
            }
        }

class DocumentResponse(BaseModel):
    id: str
    title: str
    status: DocumentStatus
    version: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True
```

### 3.4 Service Layer Standards

**Service Class Template**
```python
# ✅ Service implementation template
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.document import Document
from app.schemas.document import DocumentCreate, DocumentUpdate

class DocumentService:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_document(
        self, 
        document_data: DocumentCreate, 
        author_id: str
    ) -> Document:
        """Create a new document with version table."""
        # Implementation with proper error handling
        try:
            document = Document(**document_data.dict(), author_id=author_id)
            # Generate version table data
            document.version_table_data = self._generate_version_table(document)
            
            self.db.add(document)
            await self.db.commit()
            await self.db.refresh(document)
            
            return document
        except Exception as e:
            await self.db.rollback()
            raise DocumentCreationError(f"Failed to create document: {str(e)}")
    
    def _generate_version_table(self, document: Document) -> Dict[str, Any]:
        """Generate immutable version table data."""
        return {
            "version": document.version,
            "created_at": document.created_at.isoformat(),
            "author": self._get_author_name(document.author_id),
            "description": "Initial version"
        }
```

### 3.5 API Endpoint Standards

**Route Handler Template**
```python
# ✅ API endpoint template
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/documents", tags=["documents"])

@router.post(
    "/",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create new document",
    description="Create a new document with version table and placeholders"
)
async def create_document(
    document_data: DocumentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> DocumentResponse:
    """Create a new document with automatic version table generation."""
    try:
        service = DocumentService(db)
        document = await service.create_document(document_data, current_user.id)
        return DocumentResponse.from_orm(document)
    
    except DocumentCreationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )
```

### 3.6 Testing Standards (Pytest)

**Test Structure Template**
```python
# ✅ Backend test template
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

class TestDocumentEndpoints:
    @pytest.mark.asyncio
    async def test_create_document_success(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: Dict[str, str]
    ):
        """Test successful document creation."""
        # Arrange
        document_data = {
            "title": "Test Document",
            "content_delta": {"ops": [{"insert": "Test content"}]},
            "object_placeholders": []
        }
        
        # Act
        response = await async_client.post(
            "/api/v1/documents",
            json=document_data,
            headers=auth_headers
        )
        
        # Assert
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Test Document"
        assert "version_table_data" in data
        assert data["version_table_data"]["version"] == "1.0"

    @pytest.mark.asyncio
    async def test_create_document_with_placeholders(
        self,
        async_client: AsyncClient,
        auth_headers: Dict[str, str]
    ):
        """Test document creation with placeholder objects."""
        # Test implementation
```

---

## 4. PDF Generation Standards

### 4.1 ReportLab Implementation

**PDF Service Standards**
```python
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen.canvas import Canvas
from reportlab.pdfbase.pdfform import textFieldRelative

class PDFService:
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self.page_width, self.page_height = letter
    
    async def generate_fillable_pdf(
        self, 
        document: Document
    ) -> bytes:
        """Generate PDF with form fields from placeholders."""
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        story = []
        
        # Add immutable version table
        story.append(self._create_version_table(document))
        
        # Process Delta content
        story.extend(self._process_delta_content(document.content_delta))
        
        # Build PDF
        doc.build(story, onFirstPage=self._add_form_fields)
        
        return buffer.getvalue()
    
    def _add_form_fields(self, canvas: Canvas, doc):
        """Add form fields based on placeholder positions."""
        for placeholder in self.placeholders:
            field_type = placeholder.get('type')
            position = placeholder.get('position', {})
            
            if field_type == 'signature':
                self._add_signature_field(canvas, placeholder, position)
            elif field_type == 'long-response':
                self._add_text_area(canvas, placeholder, position)
            elif field_type == 'line-segment':
                self._add_text_field(canvas, placeholder, position)
```

### 4.2 Form Field Generation Standards

**Placeholder to PDF Field Mapping**
```python
FIELD_TYPE_MAPPING = {
    'signature': {
        'signature_line': 'textFieldRelative',
        'date_field': 'textFieldRelative',
        'title_field': 'textFieldRelative'
    },
    'long-response': {
        'response_area': 'textFieldRelative'  # with multiline=True
    },
    'line-segment': {
        'text_field': 'textFieldRelative'
    }
}

def _create_form_field(
    self, 
    canvas: Canvas, 
    field_type: str, 
    field_id: str, 
    position: Dict[str, float],
    dimensions: Dict[str, float]
) -> None:
    """Create form field with proper positioning."""
    if field_type == 'textFieldRelative':
        canvas.acroForm.textfield(
            name=field_id,
            tooltip=f"Field: {field_id}",
            x=position['x'],
            y=position['y'],
            borderStyle='inset',
            width=dimensions['width'],
            height=dimensions['height'],
            textColor=colors.black,
            fillColor=colors.white,
            relative=True
        )
```

---

## 5. Database and ORM Standards

### 5.1 SQLAlchemy Model Standards

**Model Definition Template**
```python
from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
import uuid
from datetime import datetime

Base = declarative_base()

class Document(Base):
    __tablename__ = "documents"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Required fields
    title = Column(String(200), nullable=False, index=True)
    content_delta = Column(JSONB, nullable=False)
    status = Column(
        Enum(DocumentStatus), 
        nullable=False, 
        default=DocumentStatus.DRAFT
    )
    
    # Placeholder objects and version data
    object_placeholders = Column(JSONB, default=list)
    version_table_data = Column(JSONB, default=dict)
    
    # Relationships
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    author = relationship("User", back_populates="documents")
    
    # Audit fields
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Indexes
    __table_args__ = (
        Index('ix_documents_status_created', 'status', 'created_at'),
        Index('ix_documents_author_status', 'author_id', 'status'),
    )
    
    def __repr__(self) -> str:
        return f"<Document(id={self.id}, title='{self.title}', status='{self.status}')>"
```

### 5.2 Database Migration Standards

**Alembic Migration Template**
```python
"""Add document placeholders and version table

Revision ID: 001_add_document_placeholders
Revises: 
Create Date: 2024-01-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '001_add_document_placeholders'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    """Add placeholder and version table support."""
    # Add new columns
    op.add_column('documents', 
        sa.Column('object_placeholders', postgresql.JSONB(), nullable=True)
    )
    op.add_column('documents',
        sa.Column('version_table_data', postgresql.JSONB(), nullable=True)
    )
    
    # Create indexes for performance
    op.create_index('ix_documents_placeholders', 'documents', 
                    [sa.text("object_placeholders")], postgresql_using='gin')

def downgrade():
    """Remove placeholder and version table support."""
    op.drop_index('ix_documents_placeholders', 'documents')
    op.drop_column('documents', 'version_table_data')
    op.drop_column('documents', 'object_placeholders')
```

---

## 6. Security Standards

### 6.1 Authentication and Authorization

**JWT Implementation Standards**
```python
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status
from datetime import datetime, timedelta

class SecurityService:
    def __init__(self):
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        self.secret_key = settings.SECRET_KEY
        self.algorithm = "HS256"
    
    def create_access_token(
        self, 
        data: Dict[str, Any], 
        expires_delta: Optional[timedelta] = None
    ) -> str:
        """Create JWT access token with proper expiration."""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=15)
        
        to_encode.update({"exp": expire})
        return jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
    
    def verify_token(self, token: str) -> Dict[str, Any]:
        """Verify and decode JWT token."""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials"
            )
```

### 6.2 Input Validation and Sanitization

**Validation Standards**
```python
from pydantic import validator, Field
from typing import Any, Dict
import bleach

class DocumentContentValidator:
    """Validator for document content and placeholders."""
    
    @staticmethod
    def validate_delta_content(delta: Dict[str, Any]) -> Dict[str, Any]:
        """Validate Quill Delta format."""
        if not isinstance(delta, dict) or 'ops' not in delta:
            raise ValueError("Invalid Delta format")
        
        ops = delta.get('ops', [])
        for op in ops:
            if 'insert' in op and isinstance(op['insert'], str):
                # Sanitize text content
                op['insert'] = bleach.clean(
                    op['insert'],
                    tags=['b', 'i', 'u', 'strong', 'em'],
                    attributes={},
                    strip=True
                )
        
        return delta
    
    @staticmethod 
    def validate_placeholder_config(config: Dict[str, Any]) -> Dict[str, Any]:
        """Validate placeholder configuration."""
        required_fields = {'id', 'type'}
        if not all(field in config for field in required_fields):
            raise ValueError("Missing required placeholder fields")
        
        # Sanitize string fields
        for key, value in config.items():
            if isinstance(value, str):
                config[key] = bleach.clean(value, strip=True)
        
        return config
```

---

## 7. Performance and Monitoring Standards

### 7.1 Performance Requirements

**Response Time Targets**
- Document CRUD operations: < 100ms (95th percentile)
- Document search: < 200ms (95th percentile) 
- Workflow operations: < 150ms (95th percentile)
- PDF generation: < 3s (95th percentile)
- Placeholder operations: < 50ms (95th percentile)

**Database Performance**
```python
# ✅ Optimized query patterns
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import selectinload, joinedload

class DocumentRepository:
    async def get_documents_with_placeholders(
        self, 
        user_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[Document]:
        """Optimized document query with eager loading."""
        query = (
            select(Document)
            .options(
                selectinload(Document.author),
                selectinload(Document.workflow_instances)
            )
            .where(
                and_(
                    Document.author_id == user_id,
                    Document.status != DocumentStatus.DELETED
                )
            )
            .order_by(Document.updated_at.desc())
            .limit(limit)
            .offset(offset)
        )
        
        result = await self.session.execute(query)
        return result.scalars().all()
```

### 7.2 Monitoring and Logging

**Logging Standards**
```python
import logging
import structlog
from datetime import datetime

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger(__name__)

# Usage in services
async def create_document(self, document_data: DocumentCreate) -> Document:
    """Create document with structured logging."""
    logger.info(
        "document_creation_started",
        user_id=document_data.author_id,
        title=document_data.title,
        placeholder_count=len(document_data.object_placeholders)
    )
    
    try:
        # Document creation logic
        logger.info(
            "document_creation_completed",
            document_id=str(document.id),
            duration_ms=duration
        )
        return document
    
    except Exception as e:
        logger.error(
            "document_creation_failed",
            error=str(e),
            user_id=document_data.author_id
        )
        raise
```

---

## 8. CI/CD and Deployment Standards

### 8.1 GitHub Actions Workflow

**Required CI/CD Pipeline**
```yaml
# .github/workflows/ca-dms.yml
name: CA-DMS CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  frontend-quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Type checking
        run: npm run type-check
      
      - name: Linting
        run: npm run lint
      
      - name: Unit tests
        run: npm run test:unit -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
          fail_ci_if_error: true

  backend-quality:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install -r requirements/dev.txt
      
      - name: Type checking
        run: mypy app/
      
      - name: Linting
        run: |
          flake8 app/
          black --check app/
      
      - name: Tests with coverage
        run: |
          pytest --cov=app --cov-report=xml
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage.xml
          fail_ci_if_error: true

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
      
      - name: Dependency vulnerability check
        run: |
          npm audit --audit-level high
          pip install safety
          safety check
```

### 8.2 Quality Gates

**Pre-commit Hooks (Required)**
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.4.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files

  - repo: https://github.com/psf/black
    rev: 22.10.0
    hooks:
      - id: black
        language_version: python3.11

  - repo: https://github.com/pycqa/flake8
    rev: 6.0.0
    hooks:
      - id: flake8

  - repo: https://github.com/pre-commit/mirrors-eslint
    rev: v8.28.0
    hooks:
      - id: eslint
        files: \.(js|ts|tsx)$
        types: [file]
```

**Branch Protection Rules**
- Require pull request reviews (minimum 1)
- Require status checks to pass
- Require branches to be up to date
- Restrict pushes to main/develop
- Require signed commits

---

## 9. Documentation Standards

### 9.1 Code Documentation

**Function Documentation Template**
```typescript
/**
 * Creates a new placeholder object in the document editor.
 * 
 * @param type - The type of placeholder to create
 * @param config - Configuration object for the placeholder
 * @param position - Optional position in the document (defaults to cursor position)
 * @returns Promise resolving to the created placeholder object
 * 
 * @throws {ValidationError} When placeholder configuration is invalid
 * @throws {PositionError} When position is outside document bounds
 * 
 * @example
 * ```typescript
 * const placeholder = await createPlaceholder('signature', {
 *   id: 'sig-001',
 *   includeTitle: true,
 *   label: 'Board President'
 * });
 * ```
 */
async function createPlaceholder(
  type: PlaceholderType,
  config: PlaceholderConfig,
  position?: number
): Promise<PlaceholderObject> {
  // Implementation
}
```

**API Documentation Standards**
```python
@router.post(
    "/documents/{document_id}/placeholders",
    response_model=PlaceholderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add placeholder to document",
    description="""
    Add a new placeholder object to the specified document.
    
    The placeholder will be inserted at the current cursor position
    or at the specified position if provided.
    
    **Supported placeholder types:**
    - `signature`: Signature field with optional title
    - `long-response`: Multi-line response area
    - `line-segment`: Single-line fill area
    - `version-table`: Immutable version information (auto-generated)
    
    **Note:** Version tables are automatically created and cannot be 
    manually inserted or modified.
    """,
    responses={
        201: {"description": "Placeholder created successfully"},
        400: {"description": "Invalid placeholder configuration"},
        404: {"description": "Document not found"},
        403: {"description": "Insufficient permissions"}
    }
)
async def add_placeholder_to_document(
    document_id: str,
    placeholder_data: PlaceholderCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> PlaceholderResponse:
    """Add placeholder to document endpoint."""
```

### 9.2 README Standards

**Repository README Template**
```markdown
# CA-DMS: Community Association Document Management System

## Overview
A comprehensive document management system for community associations featuring advanced editing capabilities, approval workflows, and PDF generation with fillable forms.

## Tech Stack
- **Frontend**: React 18, TypeScript, Zustand, React-Quill
- **Backend**: FastAPI, PostgreSQL, Supabase
- **Testing**: Vitest, React Testing Library, Playwright, Pytest
- **PDF Generation**: ReportLab
- **Deployment**: Docker, GitHub Actions

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL 15+

### Installation
```bash
# Clone repository
git clone <repository-url>
cd ca-dms

# Frontend setup
cd frontend
npm install
npm run dev

# Backend setup
cd ../backend
pip install -r requirements/dev.txt
uvicorn app.main:app --reload
```

## Development Guidelines
See [Implementation Guidelines](./CA-DMS-Implementation-Guidelines.md) for detailed coding standards and best practices.

## Testing
```bash
# Frontend tests
npm run test:unit
npm run test:e2e

# Backend tests
pytest --cov=app
```

## Contributing
1. Create feature branch from `develop`
2. Follow TDD methodology
3. Ensure all tests pass
4. Submit pull request with detailed description
```

---

## 10. Quality Assurance Checklist

### 10.1 Pre-Development Checklist

- [ ] Requirements clearly understood and documented
- [ ] Test cases written before implementation
- [ ] Database schema changes planned and reviewed
- [ ] API contracts defined and agreed upon
- [ ] Security considerations identified
- [ ] Performance requirements established

### 10.2 Development Checklist

- [ ] Code follows project conventions and standards
- [ ] All tests are passing (unit, integration, E2E)
- [ ] Code coverage meets minimum requirements (95%/90%)
- [ ] No linting or type checking errors
- [ ] Documentation updated for new features
- [ ] Error handling implemented appropriately
- [ ] Logging added for important operations
- [ ] Security best practices followed

### 10.3 Pre-Commit Checklist

- [ ] Feature branch is up to date with develop
- [ ] All tests pass locally
- [ ] Code has been reviewed by at least one other developer
- [ ] Commit message follows convention
- [ ] No sensitive data in code or commits
- [ ] Performance impact assessed
- [ ] Breaking changes documented

### 10.4 Pre-Release Checklist

- [ ] All E2E tests pass
- [ ] Performance benchmarks met
- [ ] Security scan completed without critical issues
- [ ] Database migrations tested
- [ ] Deployment scripts validated
- [ ] Rollback plan prepared
- [ ] Monitoring and alerting configured

---

## 11. Troubleshooting Common Issues

### 11.1 Quill Editor Issues

**Custom Blot Not Rendering**
```typescript
// ✅ Ensure proper registration order
import Quill from 'quill';

// Register blots before creating editor instance
Quill.register('formats/custom-blot', CustomBlot);

// Then create editor
const quill = new Quill('#editor', options);
```

**Delta Content Corruption**
```typescript
// ✅ Proper Delta validation
const validateDelta = (delta: any): boolean => {
  if (!delta || typeof delta !== 'object' || !Array.isArray(delta.ops)) {
    return false;
  }
  
  return delta.ops.every((op: any) => {
    return (
      (op.insert !== undefined) ||
      (op.delete !== undefined) ||
      (op.retain !== undefined)
    );
  });
};
```

### 11.2 Backend Performance Issues

**Slow Database Queries**
```python
# ✅ Add proper indexes and use query optimization
from sqlalchemy import Index

# Add to model definition
__table_args__ = (
    Index('ix_documents_status_author', 'status', 'author_id'),
    Index('ix_documents_placeholders_gin', 'object_placeholders', postgresql_using='gin')
)

# Use eager loading
query = select(Document).options(
    joinedload(Document.author),
    selectinload(Document.workflow_instances)
)
```

**Memory Usage in PDF Generation**
```python
# ✅ Use streaming for large documents
from io import BytesIO

def generate_large_pdf(document: Document) -> Iterator[bytes]:
    """Generate PDF in chunks to manage memory usage."""
    buffer = BytesIO()
    
    # Process document in sections
    for section in document_sections:
        section_pdf = process_section(section)
        yield section_pdf.getvalue()
        
        # Clear buffer to free memory
        buffer.truncate(0)
        buffer.seek(0)
```

---

This implementation guidelines document provides comprehensive standards and best practices for the CA-DMS project. It should be reviewed and updated regularly as the project evolves and new requirements emerge. All team members should familiarize themselves with these guidelines and refer to them throughout the development process to ensure consistent, high-quality code delivery.