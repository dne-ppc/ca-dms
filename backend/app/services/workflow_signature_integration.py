"""
Integration service between workflow system and digital signatures
"""
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.models.workflow import (
    Workflow,
    WorkflowStep,
    WorkflowInstance,
    WorkflowStepInstance,
    WorkflowStepType,
    StepInstanceStatus,
    WorkflowInstanceStatus
)
from app.models.digital_signature import (
    DigitalSignatureRequest,
    DigitalSignature,
    SignatureStatus,
    ComplianceFramework
)
from app.models.document import Document
from app.models.user import User
from app.schemas.digital_signature import (
    DigitalSignatureRequestCreate,
    SignerInfo
)
from app.services.digital_signature_service import DigitalSignatureService
from app.services.notification_service import NotificationService
import logging

logger = logging.getLogger(__name__)


class WorkflowSignatureIntegration:
    """Service for integrating digital signatures with workflow approval processes"""

    def __init__(self, db: Session):
        self.db = db
        self.signature_service = DigitalSignatureService(db)
        self.notification_service = NotificationService(db)

    async def create_signature_workflow_step(
        self,
        workflow_instance_id: str,
        step_instance_id: str,
        signature_provider_id: str,
        compliance_framework: ComplianceFramework = ComplianceFramework.ESIGN_ACT
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Create a digital signature request as part of a workflow step

        Returns: (success, signature_request_id, error_message)
        """
        try:
            # Get workflow step instance
            step_instance = self.db.query(WorkflowStepInstance).filter(
                WorkflowStepInstance.id == step_instance_id
            ).first()

            if not step_instance:
                return False, None, "Workflow step instance not found"

            # Get workflow instance and document
            workflow_instance = self.db.query(WorkflowInstance).filter(
                WorkflowInstance.id == workflow_instance_id
            ).first()

            if not workflow_instance:
                return False, None, "Workflow instance not found"

            document = self.db.query(Document).filter(
                Document.id == workflow_instance.document_id
            ).first()

            if not document:
                return False, None, "Document not found"

            # Get workflow step details
            step = self.db.query(WorkflowStep).filter(
                WorkflowStep.id == step_instance.step_id
            ).first()

            if not step or step.step_type != WorkflowStepType.APPROVAL:
                return False, None, "Step is not an approval step"

            # Determine signers based on workflow step configuration
            signers = await self._determine_workflow_signers(step_instance, step)

            if not signers:
                return False, None, "No signers determined for workflow step"

            # Create signature request
            signature_request_data = DigitalSignatureRequestCreate(
                document_id=workflow_instance.document_id,
                workflow_instance_id=workflow_instance_id,
                provider_id=signature_provider_id,
                title=f"Approval Required: {document.title}",
                message=self._generate_approval_message(step, workflow_instance),
                signers=signers,
                expiration_days=self._calculate_expiration_days(step),
                reminder_frequency_days=3,
                compliance_framework=compliance_framework,
                authentication_required=True,
                require_all_signatures=step.required_approvals > 1
            )

            success, signature_request, error = await self.signature_service.create_signature_request(
                signature_request_data,
                workflow_instance.initiated_by
            )

            if success and signature_request:
                # Update step instance with signature request reference
                step_instance.form_data = step_instance.form_data or {}
                step_instance.form_data['signature_request_id'] = signature_request.id
                step_instance.status = StepInstanceStatus.IN_PROGRESS

                self.db.commit()

                # Log the integration
                logger.info(f"Digital signature request {signature_request.id} created for workflow step {step_instance_id}")

                return True, signature_request.id, None
            else:
                return False, None, error or "Failed to create signature request"

        except Exception as e:
            self.db.rollback()
            error_msg = f"Failed to create signature workflow step: {str(e)}"
            logger.error(error_msg)
            return False, None, error_msg

    async def _determine_workflow_signers(
        self,
        step_instance: WorkflowStepInstance,
        step: WorkflowStep
    ) -> List[SignerInfo]:
        """Determine signers for a workflow step"""
        signers = []

        try:
            # If step is assigned to specific user
            if step_instance.assigned_to:
                assignee = self.db.query(User).filter(User.id == step_instance.assigned_to).first()
                if assignee:
                    signers.append(SignerInfo(
                        name=f"{assignee.first_name} {assignee.last_name}",
                        email=assignee.email,
                        role="Approver",
                        signing_order=1
                    ))

            # If step requires specific users
            elif step.required_users:
                for user_id in step.required_users:
                    user = self.db.query(User).filter(User.id == user_id).first()
                    if user:
                        signers.append(SignerInfo(
                            name=f"{user.first_name} {user.last_name}",
                            email=user.email,
                            role="Approver",
                            signing_order=len(signers) + 1
                        ))

            # If step requires role-based approval
            elif step.required_role:
                users_with_role = self.db.query(User).filter(
                    User.role == step.required_role
                ).limit(step.required_approvals or 1).all()

                for user in users_with_role:
                    signers.append(SignerInfo(
                        name=f"{user.first_name} {user.last_name}",
                        email=user.email,
                        role=f"{step.required_role} Approver",
                        signing_order=len(signers) + 1
                    ))

            # If no specific assignment, use initiator as fallback
            if not signers and step_instance.workflow_instance:
                initiator = self.db.query(User).filter(
                    User.id == step_instance.workflow_instance.initiated_by
                ).first()
                if initiator:
                    signers.append(SignerInfo(
                        name=f"{initiator.first_name} {initiator.last_name}",
                        email=initiator.email,
                        role="Document Owner",
                        signing_order=1
                    ))

        except Exception as e:
            logger.error(f"Failed to determine workflow signers: {str(e)}")

        return signers

    def _generate_approval_message(
        self,
        step: WorkflowStep,
        workflow_instance: WorkflowInstance
    ) -> str:
        """Generate approval message for signature request"""
        base_message = f"This document requires your approval as part of the {step.name} workflow step."

        if step.instructions:
            base_message += f"\n\nInstructions: {step.instructions}"

        if workflow_instance.due_date:
            base_message += f"\n\nDue Date: {workflow_instance.due_date.strftime('%B %d, %Y')}"

        if step.timeout_hours:
            base_message += f"\n\nThis approval will automatically escalate in {step.timeout_hours} hours if not completed."

        return base_message

    def _calculate_expiration_days(self, step: WorkflowStep) -> int:
        """Calculate expiration days based on workflow step configuration"""
        if step.timeout_hours:
            # Convert hours to days, minimum 1 day
            return max(1, step.timeout_hours // 24)
        else:
            # Default to 30 days
            return 30

    async def process_signature_completion(
        self,
        signature_request_id: str
    ) -> Tuple[bool, Optional[str]]:
        """
        Process completion of a signature request and advance workflow

        Returns: (success, error_message)
        """
        try:
            # Get signature request
            signature_request = self.db.query(DigitalSignatureRequest).filter(
                DigitalSignatureRequest.id == signature_request_id
            ).first()

            if not signature_request:
                return False, "Signature request not found"

            if not signature_request.workflow_instance_id:
                return False, "Signature request not associated with workflow"

            # Find the workflow step instance
            workflow_instance = self.db.query(WorkflowInstance).filter(
                WorkflowInstance.id == signature_request.workflow_instance_id
            ).first()

            if not workflow_instance:
                return False, "Workflow instance not found"

            step_instance = self.db.query(WorkflowStepInstance).filter(
                and_(
                    WorkflowStepInstance.workflow_instance_id == workflow_instance.id,
                    WorkflowStepInstance.form_data.contains({'signature_request_id': signature_request_id})
                )
            ).first()

            if not step_instance:
                return False, "Associated workflow step not found"

            # Check signature completion status
            if signature_request.status == SignatureStatus.SIGNED:
                # Mark step as approved
                step_instance.status = StepInstanceStatus.APPROVED
                step_instance.completed_at = datetime.utcnow()
                step_instance.decision = "approved"
                step_instance.comments = "Approved via digital signature"

                # Advance workflow to next step
                await self._advance_workflow(workflow_instance)

                # Send notifications
                await self._notify_signature_workflow_completion(
                    workflow_instance, step_instance, "approved"
                )

            elif signature_request.status == SignatureStatus.DECLINED:
                # Mark step as rejected
                step_instance.status = StepInstanceStatus.REJECTED
                step_instance.completed_at = datetime.utcnow()
                step_instance.decision = "rejected"

                # Get decline reason from signatures
                decline_reasons = [
                    sig.decline_reason for sig in signature_request.signatures
                    if sig.decline_reason
                ]
                step_instance.comments = f"Rejected via digital signature: {'; '.join(decline_reasons)}"

                # Mark entire workflow as rejected
                workflow_instance.status = WorkflowInstanceStatus.REJECTED
                workflow_instance.completed_at = datetime.utcnow()
                workflow_instance.rejection_reason = "Digital signature declined"

                # Send notifications
                await self._notify_signature_workflow_completion(
                    workflow_instance, step_instance, "rejected"
                )

            elif signature_request.status == SignatureStatus.EXPIRED:
                # Handle expiration - escalate if configured
                step = self.db.query(WorkflowStep).filter(
                    WorkflowStep.id == step_instance.step_id
                ).first()

                if step and step.escalation_users:
                    await self._escalate_expired_signature(step_instance, step)
                else:
                    # Mark step as skipped and continue workflow
                    step_instance.status = StepInstanceStatus.SKIPPED
                    step_instance.completed_at = datetime.utcnow()
                    step_instance.comments = "Signature request expired"

                    await self._advance_workflow(workflow_instance)

            self.db.commit()

            logger.info(f"Processed signature completion for request {signature_request_id}")
            return True, None

        except Exception as e:
            self.db.rollback()
            error_msg = f"Failed to process signature completion: {str(e)}"
            logger.error(error_msg)
            return False, error_msg

    async def _advance_workflow(self, workflow_instance: WorkflowInstance):
        """Advance workflow to next step"""
        try:
            # Get workflow definition
            workflow = self.db.query(Workflow).filter(
                Workflow.id == workflow_instance.workflow_id
            ).first()

            if not workflow:
                return

            # Find next step
            next_step = self.db.query(WorkflowStep).filter(
                and_(
                    WorkflowStep.workflow_id == workflow.id,
                    WorkflowStep.step_order > workflow_instance.current_step_order
                )
            ).order_by(WorkflowStep.step_order).first()

            if next_step:
                # Create next step instance
                next_step_instance = WorkflowStepInstance(
                    workflow_instance_id=workflow_instance.id,
                    step_id=next_step.id,
                    status=StepInstanceStatus.PENDING
                )

                # Assign to appropriate user(s)
                if next_step.required_users:
                    next_step_instance.assigned_to = next_step.required_users[0]
                elif next_step.required_role:
                    # Find first user with required role
                    user_with_role = self.db.query(User).filter(
                        User.role == next_step.required_role
                    ).first()
                    if user_with_role:
                        next_step_instance.assigned_to = user_with_role.id

                self.db.add(next_step_instance)

                # Update workflow instance
                workflow_instance.current_step_order = next_step.step_order

                # If next step is also a signature step, create signature request
                if next_step.step_type == WorkflowStepType.APPROVAL and 'signature' in (next_step.form_fields or {}):
                    # This would trigger another signature workflow
                    pass

            else:
                # No more steps - complete workflow
                workflow_instance.status = WorkflowInstanceStatus.COMPLETED
                workflow_instance.completed_at = datetime.utcnow()

                # Update document status
                document = self.db.query(Document).filter(
                    Document.id == workflow_instance.document_id
                ).first()
                if document:
                    document.status = "approved"

        except Exception as e:
            logger.error(f"Failed to advance workflow: {str(e)}")

    async def _escalate_expired_signature(
        self,
        step_instance: WorkflowStepInstance,
        step: WorkflowStep
    ):
        """Handle escalation of expired signature requests"""
        try:
            # Mark as escalated
            step_instance.escalated = True
            step_instance.escalated_at = datetime.utcnow()

            # Assign to escalation users
            if step.escalation_users:
                step_instance.escalated_to = step.escalation_users[0]

                # Send escalation notifications
                for user_id in step.escalation_users:
                    user = self.db.query(User).filter(User.id == user_id).first()
                    if user:
                        await self.notification_service.send_escalation_notification(
                            user.email,
                            f"{user.first_name} {user.last_name}",
                            f"Signature request for step '{step.name}' has expired and requires your attention."
                        )

            logger.info(f"Escalated expired signature for step instance {step_instance.id}")

        except Exception as e:
            logger.error(f"Failed to escalate expired signature: {str(e)}")

    async def _notify_signature_workflow_completion(
        self,
        workflow_instance: WorkflowInstance,
        step_instance: WorkflowStepInstance,
        decision: str
    ):
        """Send notifications for signature workflow completion"""
        try:
            # Notify workflow initiator
            initiator = self.db.query(User).filter(
                User.id == workflow_instance.initiated_by
            ).first()

            if initiator:
                document = self.db.query(Document).filter(
                    Document.id == workflow_instance.document_id
                ).first()

                if document:
                    if decision == "approved":
                        await self.notification_service.send_workflow_approval_notification(
                            initiator.email,
                            f"{initiator.first_name} {initiator.last_name}",
                            document.title,
                            f"Your document has been approved via digital signature."
                        )
                    else:
                        await self.notification_service.send_workflow_rejection_notification(
                            initiator.email,
                            f"{initiator.first_name} {initiator.last_name}",
                            document.title,
                            f"Your document was rejected via digital signature: {step_instance.comments}"
                        )

        except Exception as e:
            logger.error(f"Failed to send signature workflow notifications: {str(e)}")

    def get_workflow_signature_requests(
        self,
        workflow_instance_id: str
    ) -> List[DigitalSignatureRequest]:
        """Get all signature requests associated with a workflow instance"""
        return self.db.query(DigitalSignatureRequest).filter(
            DigitalSignatureRequest.workflow_instance_id == workflow_instance_id
        ).all()

    def get_pending_signature_workflows(self, user_id: str) -> List[Dict[str, Any]]:
        """Get pending signature workflows for a user"""
        try:
            # Find step instances assigned to user that have signature requests
            step_instances = self.db.query(WorkflowStepInstance).filter(
                and_(
                    WorkflowStepInstance.assigned_to == user_id,
                    WorkflowStepInstance.status.in_([
                        StepInstanceStatus.PENDING,
                        StepInstanceStatus.IN_PROGRESS
                    ]),
                    WorkflowStepInstance.form_data.isnot(None)
                )
            ).all()

            pending_workflows = []

            for step_instance in step_instances:
                if (step_instance.form_data and
                    'signature_request_id' in step_instance.form_data):

                    signature_request_id = step_instance.form_data['signature_request_id']
                    signature_request = self.db.query(DigitalSignatureRequest).filter(
                        DigitalSignatureRequest.id == signature_request_id
                    ).first()

                    if (signature_request and
                        signature_request.status in [SignatureStatus.PENDING, SignatureStatus.REQUESTED]):

                        workflow_instance = self.db.query(WorkflowInstance).filter(
                            WorkflowInstance.id == step_instance.workflow_instance_id
                        ).first()

                        if workflow_instance:
                            document = self.db.query(Document).filter(
                                Document.id == workflow_instance.document_id
                            ).first()

                            pending_workflows.append({
                                'workflow_instance_id': workflow_instance.id,
                                'step_instance_id': step_instance.id,
                                'signature_request_id': signature_request.id,
                                'document_title': document.title if document else 'Unknown',
                                'step_name': step_instance.step.name if step_instance.step else 'Unknown Step',
                                'due_date': workflow_instance.due_date,
                                'initiated_at': workflow_instance.initiated_at,
                                'signature_status': signature_request.status.value
                            })

            return pending_workflows

        except Exception as e:
            logger.error(f"Failed to get pending signature workflows: {str(e)}")
            return []

    async def retry_failed_signature_workflow(
        self,
        step_instance_id: str,
        new_provider_id: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """Retry a failed signature workflow step"""
        try:
            step_instance = self.db.query(WorkflowStepInstance).filter(
                WorkflowStepInstance.id == step_instance_id
            ).first()

            if not step_instance:
                return False, "Step instance not found"

            if not (step_instance.form_data and 'signature_request_id' in step_instance.form_data):
                return False, "No signature request associated with step"

            # Cancel existing signature request
            old_signature_request_id = step_instance.form_data['signature_request_id']
            await self.signature_service.cancel_signature_request(
                old_signature_request_id,
                step_instance.workflow_instance.initiated_by,
                "Retrying with new provider"
            )

            # Create new signature request
            provider_id = new_provider_id or step_instance.form_data.get('provider_id')
            if not provider_id:
                # Use default active provider
                providers = self.signature_service.get_active_providers()
                if providers:
                    provider_id = providers[0].id
                else:
                    return False, "No active signature providers available"

            success, new_request_id, error = await self.create_signature_workflow_step(
                step_instance.workflow_instance_id,
                step_instance_id,
                provider_id
            )

            if success:
                logger.info(f"Retried signature workflow step {step_instance_id} with new request {new_request_id}")

            return success, error

        except Exception as e:
            error_msg = f"Failed to retry signature workflow: {str(e)}"
            logger.error(error_msg)
            return False, error_msg