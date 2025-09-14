import { useState, useEffect } from 'react'
import {
  CheckCircle,
  XCircle,
  MessageSquare,
  Clock,
  User,
  History,
  Mic,
  UserCheck,
  AlertCircle,
  ChevronRight
} from 'lucide-react'

interface WorkflowUser {
  id: string
  name: string
  role: string
}

interface MobileWorkflowControlsProps {
  documentId: string
  workflowStage: string
  currentUser: WorkflowUser
  onApprove: () => void
  onReject: () => void
  onComment: (comment: string) => void
  onReassign?: (userId: string) => void
  dueDate?: Date
  className?: string
}

export const MobileWorkflowControls = ({
  documentId,
  workflowStage,
  currentUser,
  onApprove,
  onReject,
  onComment,
  onReassign,
  dueDate,
  className = ''
}: MobileWorkflowControlsProps) => {
  const [showCommentInput, setShowCommentInput] = useState(false)
  const [comment, setComment] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [isVoiceInput, setIsVoiceInput] = useState(false)

  // Haptic feedback function
  const triggerHapticFeedback = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (navigator.vibrate) {
      const duration = type === 'light' ? 50 : type === 'medium' ? 100 : 200
      navigator.vibrate(duration)
    }
  }

  // Calculate time remaining for due date
  const getTimeRemaining = () => {
    if (!dueDate) return null

    const now = new Date()
    const diff = dueDate.getTime() - now.getTime()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

    if (days < 0) return { text: 'Overdue', urgency: 'high' }
    if (days === 0) return { text: 'Due today', urgency: 'high' }
    if (days === 1) return { text: 'Due tomorrow', urgency: 'medium' }
    if (days <= 3) return { text: `Due in ${days} days`, urgency: 'medium' }

    return { text: `Due in ${days} days`, urgency: 'low' }
  }

  const timeRemaining = getTimeRemaining()

  const handleApprove = () => {
    triggerHapticFeedback('medium')
    onApprove()
  }

  const handleReject = () => {
    triggerHapticFeedback('medium')
    onReject()
  }

  const handleCommentSubmit = () => {
    if (comment.trim()) {
      triggerHapticFeedback('light')
      onComment(comment.trim())
      setComment('')
      setShowCommentInput(false)
    }
  }

  const handleSwipeGesture = (event: React.TouchEvent) => {
    // Simple swipe detection for workflow actions
    const touch = event.changedTouches[0]
    const target = event.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const swipeDistance = touch.clientX - rect.left

    if (swipeDistance > rect.width * 0.7) {
      // Swipe right for approve
      handleApprove()
    } else if (swipeDistance < rect.width * 0.3) {
      // Swipe left for reject
      handleReject()
    }
  }

  const getStageDisplayName = (stage: string) => {
    const stageMap: { [key: string]: string } = {
      'review': 'Review Stage',
      'approval': 'Approval Stage',
      'final-review': 'Final Review',
      'completed': 'Completed'
    }
    return stageMap[stage] || stage
  }

  const getStatusText = (stage: string) => {
    const statusMap: { [key: string]: string } = {
      'review': 'Pending Review',
      'approval': 'Pending Approval',
      'final-review': 'Final Review Required',
      'completed': 'Workflow Complete'
    }
    return statusMap[stage] || 'In Progress'
  }

  const getActionText = (stage: string) => {
    const actionMap: { [key: string]: string } = {
      'review': 'Review Document',
      'approval': 'Approve Document',
      'final-review': 'Final Review',
      'completed': 'No Action Required'
    }
    return actionMap[stage] || 'Take Action'
  }

  return (
    <div className={`mobile-workflow-controls bg-white border rounded-lg shadow-sm p-4 ${className}`}>
      {/* Workflow Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {getStageDisplayName(workflowStage)}
          </h3>
          <p className="text-sm text-gray-600">{getStatusText(workflowStage)}</p>
        </div>

        <button
          onClick={() => setShowHistory(!showHistory)}
          className="p-2 rounded-md hover:bg-gray-100 transition-colors"
          title="Workflow History"
        >
          <History className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      {/* Status Indicator */}
      <div className="mb-4">
        <div
          data-testid="status-pending"
          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800"
        >
          <Clock className="h-4 w-4 mr-1" />
          {getStatusText(workflowStage)}
        </div>
      </div>

      {/* Action Required */}
      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-blue-600 mr-2" />
          <div>
            <p className="text-sm text-blue-900">
              <span className="font-semibold">Action Required:</span>{' '}
              <span className="font-bold">{getActionText(workflowStage)}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Assignee Information */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center">
          <User className="h-5 w-5 text-gray-600 mr-2" />
          <div>
            <p className="text-sm text-gray-900">
              <span className="font-medium">Assigned to:</span> {currentUser.name}
            </p>
            <p className="text-xs text-gray-600">
              <span className="font-medium">Role:</span> {currentUser.role}
            </p>
          </div>
        </div>
      </div>

      {/* Due Date */}
      {timeRemaining && (
        <div className="mb-4 flex items-center">
          <Clock className="h-4 w-4 mr-2 text-gray-500" />
          <span
            data-testid="urgency-indicator"
            className={`text-sm font-medium ${
              timeRemaining.urgency === 'high' ? 'text-red-600' :
              timeRemaining.urgency === 'medium' ? 'text-orange-600' : 'text-green-600'
            }`}
          >
            {timeRemaining.text}
          </span>
        </div>
      )}

      {/* Swipeable Action Card */}
      <div
        data-testid="workflow-card"
        className="mb-4 p-4 bg-gradient-to-r from-green-50 to-red-50 rounded-lg border-2 border-dashed border-gray-200"
        onTouchEnd={handleSwipeGesture}
      >
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">Swipe for Quick Actions</p>
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span>← Reject</span>
            <span>Approve →</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button
          onClick={handleApprove}
          className="min-h-11 flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
        >
          <CheckCircle className="h-5 w-5 mr-2" />
          Approve
        </button>

        <button
          onClick={handleReject}
          className="min-h-11 flex items-center justify-center px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
        >
          <XCircle className="h-5 w-5 mr-2" />
          Reject
        </button>
      </div>

      {/* Comment Section */}
      <div className="border-t pt-4">
        {!showCommentInput ? (
          <button
            onClick={() => setShowCommentInput(true)}
            className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <MessageSquare className="h-5 w-5 mr-2 text-gray-600" />
            <span className="text-gray-700 font-medium">Add Comment</span>
          </button>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add your comment..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={3}
                name="comment"
                aria-label="Comment"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCommentSubmit}
                disabled={!comment.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Submit Comment
              </button>

              <button
                onClick={() => setIsVoiceInput(!isVoiceInput)}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                title="Voice Input"
              >
                <Mic className={`h-5 w-5 ${isVoiceInput ? 'text-red-600' : 'text-gray-600'}`} />
              </button>

              <button
                onClick={() => setShowCommentInput(false)}
                className="px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Workflow History */}
      {showHistory && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Recent Activity</h4>
          <div className="space-y-2 text-xs text-gray-600">
            <div className="flex items-center">
              <UserCheck className="h-3 w-3 mr-2" />
              <span>Document submitted for review - 2 hours ago</span>
            </div>
            <div className="flex items-center">
              <MessageSquare className="h-3 w-3 mr-2" />
              <span>Comment added by reviewer - 1 hour ago</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Hook for mobile workflow interactions
export const useMobileWorkflow = (documentId: string) => {
  const [workflowState, setWorkflowState] = useState({
    stage: 'review',
    status: 'pending',
    assignee: null,
    dueDate: null
  })

  // Simulated workflow state management
  useEffect(() => {
    // In a real app, this would fetch workflow state from API
    console.log(`Loading workflow state for document ${documentId}`)
  }, [documentId])

  const approveDocument = () => {
    console.log('Approving document:', documentId)
    setWorkflowState(prev => ({ ...prev, status: 'approved' }))
  }

  const rejectDocument = () => {
    console.log('Rejecting document:', documentId)
    setWorkflowState(prev => ({ ...prev, status: 'rejected' }))
  }

  const addComment = (comment: string) => {
    console.log('Adding comment:', comment)
  }

  return {
    workflowState,
    approveDocument,
    rejectDocument,
    addComment
  }
}