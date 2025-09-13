# Document Editor Enhancement Specification

## 1. SPECIFY - Requirements & Architecture Definition

### Mission Statement
Enhance the CA-DMS document editor to provide a Google Docs-like experience with improved toolbar design, markdown support, table of contents navigation, mobile restrictions, and integrated advanced reporting functionality.

### Technology Stack
- **Frontend**: React + TypeScript, Enhanced Rich Text Editor
- **Backend**: FastAPI + Python (existing)
- **Database**: SQLite (existing)
- **Styling**: CSS with responsive design principles
- **Testing**: Jest + React Testing Library (TDD approach)

### Core Requirements

#### 1. Toolbar Enhancement
- **Full-width toolbar**: Toolbar spans entire editor width
- **Integrated document controls**: Document title and type selection moved to toolbar
- **Google Docs-style layout**: Clean, modern appearance matching Google Docs interface
- **Header formatting**: Replace size dropdown with H1/H2/H3 header type selection
- **Markdown support**: Automatic markdown formatting for headers

#### 2. Right-Hand Panel with Dual Navigation
- **Tabbed interface**: TOC and Version History tabs in right sidebar
- **Table of Contents Tab**:
  - Automatically detect H1, H2, H3 headers in document
  - Click TOC items to jump to corresponding sections
  - Dynamic updates as headers are added/modified
- **Version History Tab**:
  - List all document versions with timestamps and authors
  - Preview version content on hover/selection
  - Restore version functionality (move selected version to head)
  - Version comparison capabilities
- **Responsive design**: Panel hides on mobile, shows on desktop

#### 3. Mobile Restrictions
- **Desktop-only editing**: Full document editing restricted to desktop devices
- **Mobile limitations**: Mobile users limited to:
  - Document viewing (read-only)
  - Approval workflows
  - Search functionality
- **Responsive detection**: Automatic device detection and appropriate UI rendering

#### 4. Advanced Reporting Integration
- **Toolbar integration**: Advanced reporting controls accessible from toolbar
- **Report generation**: Generate reports on document usage, workflows, approvals
- **Export capabilities**: Export reports in multiple formats (PDF, CSV, JSON)
- **Dashboard integration**: Link to advanced reporting dashboard

### Quality Standards
- **Test Coverage**: 95%+ business logic, 90%+ overall coverage
- **Performance**: <100ms toolbar interactions, <200ms TOC navigation
- **Responsive**: Seamless desktop/mobile detection and appropriate UX
- **Accessibility**: WCAG 2.1 AA compliance for toolbar and TOC

### User Experience Goals
1. **Intuitive Interface**: Google Docs-like familiarity
2. **Efficient Navigation**: Quick access to document sections via TOC
3. **Mobile-first Workflow**: Appropriate limitations for mobile users
4. **Integrated Reporting**: Easy access to document analytics

### Technical Architecture

#### Frontend Components
```
src/components/editor/
├── EnhancedToolbar.tsx          # Full-width toolbar with integrated controls
├── DocumentTitleInput.tsx       # Inline document title editing
├── DocumentTypeSelector.tsx     # Document type dropdown in toolbar
├── HeaderFormatSelector.tsx     # H1/H2/H3 header type selector
├── TableOfContents.tsx          # Sidebar TOC component
├── MobileEditor.tsx             # Mobile-restricted editor view
└── AdvancedReportingButton.tsx  # Reporting integration button
```

#### State Management
```
src/stores/
├── editorStore.ts              # Editor state (content, cursor, formatting)
├── tocStore.ts                 # Table of contents state
└── reportingStore.ts           # Advanced reporting state
```

#### Services
```
src/services/
├── markdownService.ts          # Markdown conversion utilities
├── tocService.ts               # TOC generation and navigation
├── deviceService.ts            # Mobile/desktop detection
└── reportingService.ts         # Advanced reporting API integration
```

### Data Models

#### Document Structure
```typescript
interface DocumentModel {
  id: string
  title: string
  documentType: 'governance' | 'policy' | 'procedure' | 'notice'
  content: QuillDelta
  headers: HeaderStructure[]
  metadata: DocumentMetadata
  // ... existing fields
}

interface HeaderStructure {
  id: string
  level: 1 | 2 | 3  // H1, H2, H3
  text: string
  position: number  // Character position in document
  anchor: string    // URL anchor for navigation
}
```

#### Reporting Models
```typescript
interface ReportConfig {
  id: string
  name: string
  type: 'usage' | 'workflow' | 'approval' | 'performance'
  filters: ReportFilters
  format: 'pdf' | 'csv' | 'json'
}

interface ReportData {
  config: ReportConfig
  generatedAt: Date
  data: any[]
  summary: ReportSummary
}
```

### Security Considerations
- **Mobile restrictions**: Server-side validation of edit permissions
- **Role-based access**: Reporting features require appropriate permissions
- **Content validation**: Sanitize markdown input to prevent XSS
- **Audit trail**: Track all editor interactions and report generation

### Performance Requirements
- **Toolbar responsiveness**: <100ms for all toolbar interactions
- **TOC updates**: Real-time header detection with <50ms delay
- **Mobile detection**: Instantaneous device type detection
- **Report generation**: <5s for standard reports, <30s for complex reports

### Compliance & Standards
- **Accessibility**: Full keyboard navigation, screen reader support
- **Mobile compliance**: Touch-friendly interfaces where applicable
- **Data integrity**: Maintain document version history
- **Export standards**: Industry-standard report formats

This specification serves as the foundation for implementing a modern, efficient document editor that meets user expectations while maintaining system integrity and performance standards.