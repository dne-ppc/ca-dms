import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { MobileWorkflowControls } from '../MobileWorkflowControls'

describe('MobileWorkflowControls - Task 6.2.1: Failing tests for mobile workflow controls', () => {
  const mockProps = {
    documentId: 'test-doc-123',
    workflowStage: 'review',
    currentUser: {
      id: 'user-1',
      name: 'John Doe',
      role: 'reviewer'
    },
    onApprove: vi.fn(),
    onReject: vi.fn(),
    onComment: vi.fn(),
    onReassign: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Task 6.2.1: Mobile users can access approval workflows', () => {
    it('should display workflow approval controls for authorized users', () => {
      render(
        <BrowserRouter>
          <MobileWorkflowControls {...mockProps} />
        </BrowserRouter>
      )

      expect(screen.getByText('Review Stage')).toBeInTheDocument()
      expect(screen.getAllByText('Pending Review')).toHaveLength(2) // Appears in header and status indicator
    })

    it('should show approve and reject buttons for reviewers', () => {
      render(
        <BrowserRouter>
          <MobileWorkflowControls {...mockProps} />
        </BrowserRouter>
      )

      const approveButton = screen.getByRole('button', { name: /approve/i })
      const rejectButton = screen.getByRole('button', { name: /reject/i })

      expect(approveButton).toBeInTheDocument()
      expect(rejectButton).toBeInTheDocument()
    })

    it('should display current workflow stage and status', () => {
      render(
        <BrowserRouter>
          <MobileWorkflowControls {...mockProps} />
        </BrowserRouter>
      )

      expect(screen.getByText('Review Stage')).toBeInTheDocument()
      expect(screen.getAllByText('Pending Review')).toHaveLength(2) // Appears in header and status indicator
    })

    it('should allow users to view workflow history', () => {
      render(
        <BrowserRouter>
          <MobileWorkflowControls {...mockProps} />
        </BrowserRouter>
      )

      const historyButton = screen.getByTitle('Workflow History')
      expect(historyButton).toBeInTheDocument()

      fireEvent.click(historyButton)
      expect(screen.getByText('Recent Activity')).toBeInTheDocument()
    })
  })

  describe('Task 6.2.1: Workflow controls are touch-friendly', () => {
    it('should have large touch targets for mobile interaction', () => {
      render(
        <BrowserRouter>
          <MobileWorkflowControls {...mockProps} />
        </BrowserRouter>
      )

      const approveButton = screen.getByRole('button', { name: /approve/i })

      // Check for adequate touch target size (minimum 44px height)
      expect(approveButton).toHaveClass('min-h-11') // min-h-11 = 44px
    })

    it('should support swipe gestures for quick actions', () => {
      render(
        <BrowserRouter>
          <MobileWorkflowControls {...mockProps} />
        </BrowserRouter>
      )

      const workflowCard = screen.getByTestId('workflow-card')

      // Mock getBoundingClientRect for swipe calculation
      workflowCard.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        width: 300,
        top: 0,
        right: 300,
        bottom: 100,
        height: 100,
        x: 0,
        y: 0,
        toJSON: () => {}
      }))

      // Test swipe right for approve (swipe to x=250, which is > 70% of width)
      fireEvent.touchEnd(workflowCard, {
        changedTouches: [{ clientX: 250, clientY: 100 }]
      })

      expect(mockProps.onApprove).toHaveBeenCalled()
    })

    it('should provide haptic feedback for actions', () => {
      const mockVibrate = vi.fn()
      Object.defineProperty(navigator, 'vibrate', {
        value: mockVibrate,
        writable: true
      })

      render(
        <BrowserRouter>
          <MobileWorkflowControls {...mockProps} />
        </BrowserRouter>
      )

      const approveButton = screen.getByRole('button', { name: /approve/i })
      fireEvent.click(approveButton)

      expect(mockVibrate).toHaveBeenCalledWith(100) // Medium vibration for feedback
    })
  })

  describe('Task 6.2.1: Workflow status displays clearly', () => {
    it('should show clear visual indicators for workflow stages', () => {
      render(
        <BrowserRouter>
          <MobileWorkflowControls {...mockProps} />
        </BrowserRouter>
      )

      // Check for status indicators
      const pendingIndicator = screen.getByTestId('status-pending')
      expect(pendingIndicator).toHaveClass('bg-yellow-100', 'text-yellow-800')
    })

    it('should display next required action prominently', () => {
      render(
        <BrowserRouter>
          <MobileWorkflowControls {...mockProps} />
        </BrowserRouter>
      )

      expect(screen.getByText('Action Required:')).toBeInTheDocument()
      expect(screen.getByText('Review Document')).toHaveClass('font-bold')
    })

    it('should show assignee information clearly', () => {
      render(
        <BrowserRouter>
          <MobileWorkflowControls {...mockProps} />
        </BrowserRouter>
      )

      expect(screen.getByText('Assigned to:')).toBeInTheDocument()
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Role:')).toBeInTheDocument()
      expect(screen.getByText('reviewer')).toBeInTheDocument()
    })

    it('should display due dates and time remaining', () => {
      const propsWithDueDate = {
        ...mockProps,
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days from now
      }

      render(
        <BrowserRouter>
          <MobileWorkflowControls {...propsWithDueDate} />
        </BrowserRouter>
      )

      expect(screen.getByText(/due in 2 days/i)).toBeInTheDocument()
      expect(screen.getByTestId('urgency-indicator')).toHaveClass('text-orange-600') // 2 days = medium urgency
    })
  })

  describe('Comment and Feedback Functionality', () => {
    it('should provide comment input for workflow actions', () => {
      render(
        <BrowserRouter>
          <MobileWorkflowControls {...mockProps} />
        </BrowserRouter>
      )

      const commentButton = screen.getByRole('button', { name: /add comment/i })
      fireEvent.click(commentButton)

      const commentTextarea = screen.getByRole('textbox', { name: /comment/i })
      expect(commentTextarea).toBeInTheDocument()
    })

    it('should support voice-to-text for comments on mobile', () => {
      render(
        <BrowserRouter>
          <MobileWorkflowControls {...mockProps} />
        </BrowserRouter>
      )

      const commentButton = screen.getByRole('button', { name: /add comment/i })
      fireEvent.click(commentButton)

      const voiceButton = screen.getByTitle('Voice Input')
      expect(voiceButton).toBeInTheDocument()
    })
  })
})