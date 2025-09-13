# TDD Template Service Specification

## 🎯 Service Overview

**Target**: `app/services/template_service.py`
**Current State**: 699 lines, **minimal test coverage** (only 7 basic mock tests)
**Priority**: **CRITICAL** - Core document template system with complex access controls

## 📋 Architecture Analysis

### **Core Class Structure**
1. **TemplateService** (699 lines) - Main service orchestration with 21 methods
   - 13 public API methods for template management
   - 8 private helper methods for business logic

### **Critical Template Management Functions**
- **Template Lifecycle**: Create, update, publish, archive workflows
- **Access Control**: Complex permission matrix with 4 levels across 3 access types
- **Content Processing**: Quill Delta manipulation with field substitution
- **Search & Analytics**: Advanced filtering with usage statistics
- **Document Generation**: Template-to-document conversion workflow
- **Collaboration**: Multi-user template editing with permission management

## 🔍 TDD Specification - "Failing Tests Are Good!"

### **RED Phase Test Coverage Areas**

#### **1. Access Control Security Testing (CRITICAL)**
- **Permission Matrix Validation**: 4 permission levels × 3 access types = 12 combinations
- **User Context Handling**: Creator, collaborator, organization member, external user scenarios
- **Private Template Access**: Ensure unauthorized users cannot access private templates
- **Collaborator Permission Boundaries**: Test permission escalation prevention
- **Bulk Operation Permissions**: Validate individual template permission checks
- **Search Result Filtering**: Ensure private templates don't leak in search results

#### **2. Template CRUD Operations Testing**
- **Template Creation**: Field validation, content processing, UUID generation
- **Template Retrieval**: Access control integration with detailed loading
- **Template Updates**: Version control logic, content change detection
- **Template Deletion**: Soft delete functionality preserving data integrity
- **Template Publishing**: Status transition validation and permission requirements
- **Duplicate Template Prevention**: Business rule validation

#### **3. Complex Search & Filtering Testing**
- **Text Search Functionality**: Content and metadata searching across multiple fields
- **Filter Combinations**: Category, access level, status, date range filtering
- **Pagination Logic**: Offset/limit calculation with total count accuracy
- **Sort Operations**: Multiple sort criteria with database performance
- **Access Control Integration**: Search results filtered by user permissions
- **Performance Under Load**: Large dataset search performance

#### **4. Content Processing & Field Substitution Testing**
- **Quill Delta Parsing**: JSON structure validation and manipulation
- **Field Substitution Logic**: Template placeholder replacement with user values
- **Preview Content Generation**: Searchable text extraction from rich content
- **Document Title Generation**: Pattern-based title creation with field values
- **Content Validation**: Malformed content handling and error recovery
- **Field Type Validation**: Different field types (text, number, date, choice)

#### **5. Template-to-Document Generation Testing**
- **Document Creation Workflow**: Complete template instantiation process
- **Field Value Validation**: Required field enforcement and type checking
- **Content Processing Pipeline**: Template content to document content conversion
- **Integration Error Handling**: Document service integration failure scenarios
- **Usage Logging**: Template usage statistics and audit trail
- **Concurrent Document Creation**: Multiple users creating documents simultaneously

#### **6. Collaboration System Testing**
- **Collaborator Addition**: Invitation workflow and permission assignment
- **Permission Management**: Role-based access control for template editing
- **Review System**: Template review creation and management
- **Notification Integration**: Collaborator notification workflows
- **Conflict Resolution**: Concurrent editing and version conflicts
- **Collaborator Removal**: Access revocation and cleanup

#### **7. Analytics & Usage Tracking Testing**
- **Usage Statistics**: Template usage count and frequency tracking
- **Analytics Aggregation**: Monthly usage reports and trend analysis
- **Review Metrics**: Average ratings and review count calculation
- **Performance Metrics**: Template generation time and success rates
- **Data Integrity**: Usage log accuracy and audit trail consistency
- **Historical Data**: Long-term analytics and data retention

#### **8. Bulk Operations Testing**
- **Transaction Safety**: Atomic bulk operations with rollback handling
- **Partial Success Scenarios**: Individual template failure handling
- **Permission Validation**: Bulk permission checks across multiple templates
- **Performance Limits**: Large batch operation handling
- **Error Reporting**: Detailed failure reporting for bulk operations
- **Concurrency Handling**: Multiple bulk operations from different users

#### **9. Version Control & State Management Testing**
- **Version Increment Logic**: Content-based versioning with proper detection
- **Status Transitions**: Template lifecycle state validation
- **Concurrent Updates**: Multiple users updating same template
- **Preview Synchronization**: Preview content consistency with main content
- **Historical Versions**: Version history tracking and retrieval
- **State Consistency**: Database consistency across related tables

#### **10. Integration Testing**
- **Document Service Integration**: Template-to-document creation workflow
- **User Service Dependencies**: User validation and organization membership
- **Database Transaction Management**: Multi-table atomic operations
- **Error Propagation**: Proper exception handling across service boundaries
- **Performance Integration**: Service interaction efficiency
- **Data Consistency**: Cross-service data integrity

## 🚨 Expected RED Phase Discoveries

### **High-Risk Access Control Issues**
1. **Permission Bypass Vulnerabilities**: Users accessing templates without proper permissions
2. **Data Leakage in Search**: Private templates appearing in unauthorized search results
3. **Collaborator Permission Escalation**: Users exceeding granted permission levels
4. **Bulk Operation Security Gaps**: Insufficient permission checks in batch operations
5. **Organization Boundary Violations**: Cross-organization data access issues

### **Business Logic & Data Integrity Issues**
1. **Version Control Race Conditions**: Concurrent update conflicts
2. **Field Substitution Errors**: Content processing with malformed or missing field data
3. **Usage Analytics Inconsistencies**: Incorrect usage counting and statistics
4. **Template Publishing Validation**: Incomplete templates being published
5. **Document Generation Failures**: Template-to-document conversion edge cases

### **Integration & Configuration Issues**
1. **Database Transaction Failures**: Rollback handling in complex operations
2. **Document Service Dependencies**: Integration error handling and recovery
3. **Content Processing Errors**: Quill Delta parsing and manipulation failures
4. **Search Performance Issues**: Inefficient queries with large datasets
5. **Bulk Operation Limits**: Memory and performance constraints

## 🎯 GREEN Phase Implementation Plan

### **Priority 1: Access Control Security Fixes**

#### **Fix Permission Matrix Validation**
```python
def _check_template_access(self, template: DocumentTemplate, user_id: str, permission: str) -> bool:
    """Enhanced access control with comprehensive validation"""
    if not template or not user_id or not permission:
        raise ValueError("Invalid parameters for access check")

    # Validate permission level
    valid_permissions = ["view", "edit", "manage", "publish"]
    if permission not in valid_permissions:
        raise ValueError(f"Invalid permission: {permission}")

    # Creator has all permissions
    if template.created_by == user_id:
        return True

    # Public templates - view access for all authenticated users
    if template.access_level == TemplateAccessLevel.PUBLIC and permission == "view":
        return True

    # Organization templates - check organization membership
    if template.access_level == TemplateAccessLevel.ORGANIZATION:
        if not self._is_same_organization(template.created_by, user_id):
            return False
        if permission == "view":
            return True

    # Check collaborator permissions
    collaborator = self.db.query(TemplateCollaborator).filter(
        and_(
            TemplateCollaborator.template_id == template.id,
            TemplateCollaborator.user_id == user_id,
            TemplateCollaborator.status == "active"
        )
    ).first()

    if collaborator:
        return self._validate_collaborator_permission(collaborator.permission_level, permission)

    return False
```

#### **Enhanced Search Filtering**
```python
def _apply_access_filter(self, query, user_id: str):
    """Apply comprehensive access control filtering to search queries"""
    if not user_id:
        # Anonymous users can only see public templates
        return query.filter(DocumentTemplate.access_level == TemplateAccessLevel.PUBLIC)

    # Build access conditions
    access_conditions = [
        # User's own templates
        DocumentTemplate.created_by == user_id,
        # Public templates
        DocumentTemplate.access_level == TemplateAccessLevel.PUBLIC,
        # Organization templates (same organization)
        and_(
            DocumentTemplate.access_level == TemplateAccessLevel.ORGANIZATION,
            DocumentTemplate.created_by.in_(
                self._get_organization_users(user_id)
            )
        ),
        # Templates where user is collaborator
        DocumentTemplate.id.in_(
            self.db.query(TemplateCollaborator.template_id)
            .filter(
                and_(
                    TemplateCollaborator.user_id == user_id,
                    TemplateCollaborator.status == "active"
                )
            )
            .subquery()
        )
    ]

    return query.filter(or_(*access_conditions))
```

### **Priority 2: Content Processing & Validation Enhancements**

#### **Robust Field Substitution**
```python
def _process_template_content(self, content: Dict[str, Any], field_values: Dict[str, Any]) -> Dict[str, Any]:
    """Process template content with comprehensive field substitution"""
    if not content or not isinstance(content, dict):
        raise ValueError("Invalid template content format")

    try:
        # Validate Quill Delta structure
        if "ops" not in content:
            raise ValueError("Invalid Quill Delta: missing 'ops' key")

        processed_content = copy.deepcopy(content)

        for op in processed_content.get("ops", []):
            if isinstance(op.get("insert"), str):
                # Process field placeholders in text
                op["insert"] = self._substitute_field_placeholders(
                    op["insert"], field_values
                )
            elif isinstance(op.get("insert"), dict):
                # Process custom blots (field components)
                if "field" in op["insert"]:
                    field_data = op["insert"]["field"]
                    field_id = field_data.get("id")
                    if field_id in field_values:
                        op["insert"]["field"]["value"] = field_values[field_id]

        return processed_content

    except Exception as e:
        raise ValueError(f"Content processing failed: {str(e)}")
```

### **Priority 3: Transaction Safety & Error Handling**

#### **Atomic Bulk Operations**
```python
def bulk_template_action(self, action_data: BulkTemplateAction, user_id: str) -> Dict[str, Any]:
    """Execute bulk template actions with comprehensive error handling"""
    results = {
        "successful": [],
        "failed": [],
        "total_processed": 0,
        "errors": []
    }

    try:
        # Begin transaction
        self.db.begin()

        for template_id in action_data.template_ids:
            try:
                # Validate individual template access
                template = self.get_template(template_id, user_id)
                if not template:
                    results["failed"].append({
                        "template_id": template_id,
                        "error": "Template not found or access denied"
                    })
                    continue

                # Check specific action permissions
                required_permission = self._get_action_permission(action_data.action)
                if not self._check_template_access(template, user_id, required_permission):
                    results["failed"].append({
                        "template_id": template_id,
                        "error": f"Insufficient permissions for {action_data.action}"
                    })
                    continue

                # Execute action
                self._execute_template_action(template, action_data.action, action_data.data)
                results["successful"].append(template_id)

            except Exception as e:
                results["failed"].append({
                    "template_id": template_id,
                    "error": str(e)
                })

            results["total_processed"] += 1

        # Commit if any successful operations
        if results["successful"]:
            self.db.commit()
        else:
            self.db.rollback()

        return results

    except Exception as e:
        self.db.rollback()
        raise RuntimeError(f"Bulk operation failed: {str(e)}")
```

## 📊 Expected Test Results

### **Initial RED Phase (Expected)**
- **Total Tests**: 45-55 comprehensive template tests
- **Passing**: 15-25 tests (30-45%)
- **Failing**: 25-35 tests (55-70% - revealing business logic issues!) ✅

### **Post-GREEN Phase (Target)**
- **Total Tests**: 45-55 tests
- **Passing**: 42-52 tests (90-95%)
- **Business Issues Fixed**: 25+ access control and logic vulnerabilities
- **Coverage**: Template-critical paths at 100%

## 🏆 Success Metrics

### **Access Control Improvements**
- **Permission Bypass Elimination**: Fix unauthorized template access
- **Search Security**: 100% access-controlled search results
- **Collaboration Security**: Proper permission boundary enforcement
- **Bulk Operation Safety**: Individual permission validation

### **Business Logic Enhancements**
- **Content Processing Reliability**: Robust field substitution and validation
- **Version Control Consistency**: Proper concurrent update handling
- **Analytics Accuracy**: Correct usage tracking and reporting
- **Template Publishing Validation**: Complete business rule enforcement

### **Performance & Reliability**
- **Search Optimization**: Sub-200ms search response times
- **Bulk Operation Efficiency**: Handle 100+ templates per batch
- **Concurrent Access Safety**: Thread-safe template operations
- **Data Integrity**: Atomic operations with proper rollback

### **Integration Stability**
- **Document Service Integration**: Reliable template-to-document conversion
- **Transaction Management**: Consistent multi-table operations
- **Error Handling**: Comprehensive exception management
- **Service Boundary**: Clean integration interfaces

This TDD specification targets the most business-critical template service in the application, where "failing tests are good!" will uncover access control vulnerabilities and business logic flaws that could compromise data security and system integrity.