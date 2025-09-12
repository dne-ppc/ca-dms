"""
Default notification templates for the CA-DMS system
"""
from sqlalchemy.orm import Session
from app.models.notification import NotificationTemplate, NotificationType

# Default notification templates
DEFAULT_TEMPLATES = [
    {
        "name": "workflow_assigned",
        "type": NotificationType.EMAIL,
        "subject_template": "New Workflow Assignment: {{ document_title }}",
        "content_template": """
Dear Team Member,

You have been assigned a new workflow step for review and approval.

Document: {{ document_title }}
Workflow: {{ workflow_type }}
Step: {{ step_name }}
Due Date: {{ due_date }}
Assigned By: {{ assigned_by }}

Instructions:
{{ instructions }}

Please log into the CA-DMS system to review and take action on this workflow.

Best regards,
CA-DMS System
        """.strip(),
        "variables": ["document_title", "workflow_type", "step_name", "due_date", "assigned_by", "instructions"],
        "is_active": True
    },
    
    {
        "name": "workflow_completed",
        "type": NotificationType.EMAIL,
        "subject_template": "Workflow Completed: {{ document_title }}",
        "content_template": """
Dear {{ recipient_name }},

The workflow for your document has been completed successfully.

Document: {{ document_title }}
Workflow: {{ workflow_type }}
Status: {{ status }}
Completed At: {{ completed_date }}

{{ message }}

You can now access the final approved document in the CA-DMS system.

Best regards,
CA-DMS System
        """.strip(),
        "variables": ["document_title", "workflow_type", "status", "message", "completed_date"],
        "is_active": True
    },
    
    {
        "name": "workflow_rejected",
        "type": NotificationType.EMAIL,
        "subject_template": "Workflow Rejected: {{ document_title }}",
        "content_template": """
Dear {{ recipient_name }},

Unfortunately, the workflow for your document has been rejected.

Document: {{ document_title }}
Workflow: {{ workflow_type }}
Status: {{ status }}
Rejected At: {{ rejection_date }}

Reason: {{ message }}

Please review the feedback and make necessary changes before resubmitting.

Best regards,
CA-DMS System
        """.strip(),
        "variables": ["document_title", "workflow_type", "status", "message", "rejection_date"],
        "is_active": True
    },
    
    {
        "name": "workflow_escalated",
        "type": NotificationType.EMAIL,
        "subject_template": "URGENT: Workflow Escalated - {{ document_title }}",
        "content_template": """
Dear {{ recipient_name }},

A workflow approval has been escalated to you due to an overdue response.

Document: {{ document_title }}
Workflow: {{ workflow_type }}
Step: {{ step_name }}
Original Assignee: {{ original_assignee }}
Due Date: {{ due_date }}
Escalation Reason: {{ escalation_reason }}

This requires immediate attention. Please log into the CA-DMS system to review and take action.

Best regards,
CA-DMS System
        """.strip(),
        "variables": ["document_title", "workflow_type", "step_name", "original_assignee", "due_date", "escalation_reason"],
        "is_active": True
    },
    
    {
        "name": "workflow_approved",
        "type": NotificationType.EMAIL,
        "subject_template": "Workflow Step Approved: {{ document_title }}",
        "content_template": """
Dear {{ recipient_name }},

A step in your workflow has been approved and the process is continuing.

Document: {{ document_title }}
Workflow: {{ workflow_type }}
Status: {{ status }}

{{ message }}

The workflow will continue to the next step automatically.

Best regards,
CA-DMS System
        """.strip(),
        "variables": ["document_title", "workflow_type", "status", "message"],
        "is_active": True
    },
    
    {
        "name": "document_shared",
        "type": NotificationType.EMAIL,
        "subject_template": "Document Shared: {{ document_title }}",
        "content_template": """
Dear {{ recipient_name }},

A document has been shared with you.

Document: {{ document_title }}
Shared By: {{ shared_by }}
Access Level: {{ access_level }}
Shared At: {{ shared_date }}

You can now access this document in the CA-DMS system with {{ access_level }} permissions.

Best regards,
CA-DMS System
        """.strip(),
        "variables": ["document_title", "shared_by", "access_level", "shared_date"],
        "is_active": True
    },
    
    {
        "name": "document_updated",
        "type": NotificationType.EMAIL,
        "subject_template": "Document Updated: {{ document_title }}",
        "content_template": """
Dear {{ recipient_name }},

A document you have access to has been updated.

Document: {{ document_title }}
Updated By: {{ updated_by }}
Updated At: {{ updated_date }}

Changes: {{ changes_summary }}

You can view the updated document in the CA-DMS system.

Best regards,
CA-DMS System
        """.strip(),
        "variables": ["document_title", "updated_by", "updated_date", "changes_summary"],
        "is_active": True
    },
    
    {
        "name": "system_maintenance",
        "type": NotificationType.EMAIL,
        "subject_template": "System Maintenance Notice",
        "content_template": """
Dear Users,

We will be performing scheduled maintenance on the CA-DMS system.

Maintenance Window: {{ maintenance_start }} to {{ maintenance_end }}
Expected Duration: {{ duration }}
Impact: {{ impact_description }}

During this time, the system may be unavailable. We apologize for any inconvenience.

Best regards,
CA-DMS Administration
        """.strip(),
        "variables": ["maintenance_start", "maintenance_end", "duration", "impact_description"],
        "is_active": True
    },
    
    {
        "name": "security_alert",
        "type": NotificationType.EMAIL,
        "subject_template": "SECURITY ALERT: {{ alert_type }}",
        "content_template": """
SECURITY ALERT

Alert Type: {{ alert_type }}
Severity: {{ severity }}
Detected At: {{ detection_time }}
User Account: {{ user_account }}
IP Address: {{ ip_address }}

Description: {{ alert_description }}

If this activity was not authorized by you, please contact your system administrator immediately and change your password.

Best regards,
CA-DMS Security Team
        """.strip(),
        "variables": ["alert_type", "severity", "detection_time", "user_account", "ip_address", "alert_description"],
        "is_active": True
    }
]

def create_default_templates(db: Session) -> int:
    """Create default notification templates if they don't exist"""
    created_count = 0
    
    for template_data in DEFAULT_TEMPLATES:
        # Check if template already exists
        existing = db.query(NotificationTemplate).filter(
            NotificationTemplate.name == template_data["name"],
            NotificationTemplate.type == template_data["type"]
        ).first()
        
        if not existing:
            template = NotificationTemplate(
                name=template_data["name"],
                type=template_data["type"],
                subject_template=template_data.get("subject_template"),
                content_template=template_data["content_template"],
                variables=template_data.get("variables", []),
                is_active=template_data.get("is_active", True)
            )
            
            db.add(template)
            created_count += 1
    
    if created_count > 0:
        db.commit()
        print(f"Created {created_count} default notification templates")
    
    return created_count

def get_template_list() -> list:
    """Get list of available templates"""
    return [template["name"] for template in DEFAULT_TEMPLATES]