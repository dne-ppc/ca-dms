/**
 * QuickActions Configuration Tests - TDD Red Phase
 * Testing user customization interface for quick actions
 */
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickActionsConfiguration, QuickActionConfig } from '../../components/intro/QuickActionsConfiguration'

interface QuickActionsConfigurationProps {
  actions: QuickActionConfig[]
  onSave: (actions: QuickActionConfig[]) => void
  onCancel: () => void
  onReset: () => void
  isOpen: boolean
  currentUser?: {
    id: string
    role: string
    permissions: string[]
  }
}

// Mock configuration data
const mockConfigurableActions: QuickActionConfig[] = [
  {
    id: 'create-document',
    title: 'Create Document',
    description: 'Start a new document',
    icon: 'document-plus',
    action: 'create',
    target: '/documents/new',
    category: 'document',
    enabled: true,
    order: 1,
    customizable: true,
    permissions: ['create_document']
  },
  {
    id: 'recent-documents',
    title: 'Recent Documents',
    description: 'View recently accessed documents',
    icon: 'clock',
    action: 'navigate',
    target: '/documents/recent',
    category: 'document',
    enabled: true,
    order: 2,
    customizable: true,
    permissions: ['view_document']
  },
  {
    id: 'create-template',
    title: 'Create Template',
    description: 'Design a new document template',
    icon: 'template',
    action: 'create',
    target: '/templates/new',
    category: 'template',
    enabled: false,
    order: 3,
    customizable: true,
    permissions: ['create_template']
  },
  {
    id: 'workflow-center',
    title: 'Workflow Center',
    description: 'Manage workflow processes',
    icon: 'workflow',
    action: 'navigate',
    target: '/workflows',
    category: 'workflow',
    enabled: true,
    order: 4,
    customizable: false,
    permissions: ['manage_workflow']
  },
  {
    id: 'admin-panel',
    title: 'Admin Panel',
    description: 'Administrative functions',
    icon: 'settings',
    action: 'navigate',
    target: '/admin',
    category: 'admin',
    enabled: false,
    order: 5,
    customizable: true,
    permissions: ['admin_access']
  }
]

const defaultProps = {
  actions: mockConfigurableActions,
  onSave: vi.fn(),
  onCancel: vi.fn(),
  onReset: vi.fn(),
  isOpen: true,
  currentUser: {
    id: 'user1',
    role: 'editor',
    permissions: ['create_document', 'view_document', 'create_template']
  }
}


describe('QuickActions Configuration System - TDD Red Phase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Configuration Modal Interface', () => {
    it('should display configuration modal when opened', () => {
      render(<QuickActionsConfiguration {...defaultProps} />)

      // Should have modal container
      expect(screen.getByTestId('quick-actions-config-modal')).toBeInTheDocument()

      // Should have modal title
      expect(screen.getByText('Configure Quick Actions')).toBeInTheDocument()

      // Should have configuration sections
      expect(screen.getByTestId('available-actions-section')).toBeInTheDocument()
      expect(screen.getByTestId('enabled-actions-section')).toBeInTheDocument()
    })

    it('should show action categories in organized sections', () => {
      render(<QuickActionsConfiguration {...defaultProps} />)

      // Should have category tabs/sections
      expect(screen.getByTestId('category-tab-document')).toBeInTheDocument()
      expect(screen.getByTestId('category-tab-template')).toBeInTheDocument()
      expect(screen.getByTestId('category-tab-workflow')).toBeInTheDocument()
      expect(screen.getByTestId('category-tab-admin')).toBeInTheDocument()

      // Should display actions by category
      const documentSection = screen.getByTestId('category-section-document')
      expect(documentSection).toBeInTheDocument()
      expect(documentSection).toHaveTextContent('Create Document')
      expect(documentSection).toHaveTextContent('Recent Documents')
    })

    it('should display action cards with configuration options', () => {
      render(<QuickActionsConfiguration {...defaultProps} />)

      // Should have action configuration cards
      const createDocumentCard = screen.getByTestId('config-card-create-document')
      expect(createDocumentCard).toBeInTheDocument()

      // Card should have title and description
      expect(createDocumentCard).toHaveTextContent('Create Document')
      expect(createDocumentCard).toHaveTextContent('Start a new document')

      // Should have enable/disable toggle
      const enableToggle = screen.getByTestId('enable-toggle-create-document')
      expect(enableToggle).toBeInTheDocument()
      expect(enableToggle).toBeChecked()

      // Should have order controls
      expect(screen.getByTestId('order-input-create-document')).toBeInTheDocument()
      expect(screen.getByTestId('move-up-create-document')).toBeInTheDocument()
      expect(screen.getByTestId('move-down-create-document')).toBeInTheDocument()
    })

    it('should show permission-based action availability', () => {
      render(<QuickActionsConfiguration {...defaultProps} />)

      // Actions user has permission for should be configurable
      const createDocumentCard = screen.getByTestId('config-card-create-document')
      expect(createDocumentCard).not.toHaveClass('disabled', 'permission-denied')

      // Actions user lacks permission for should be disabled
      const adminPanelCard = screen.getByTestId('config-card-admin-panel')
      expect(adminPanelCard).toHaveClass('permission-denied')

      // Should show permission message
      expect(screen.getByTestId('permission-message-admin-panel')).toBeInTheDocument()
      expect(screen.getByTestId('permission-message-admin-panel')).toHaveTextContent('Insufficient permissions')
    })

    it('should display non-customizable actions as read-only', () => {
      render(<QuickActionsConfiguration {...defaultProps} />)

      // Non-customizable actions should be marked as such
      const workflowCard = screen.getByTestId('config-card-workflow-center')
      expect(workflowCard).toHaveClass('non-customizable')

      // Controls should be disabled
      const enableToggle = screen.getByTestId('enable-toggle-workflow-center')
      expect(enableToggle).toBeDisabled()

      // Should show non-customizable message
      expect(screen.getByTestId('non-customizable-message-workflow-center')).toBeInTheDocument()
      expect(screen.getByTestId('non-customizable-message-workflow-center')).toHaveTextContent('System action - cannot be modified')
    })
  })

  describe('Action Configuration Controls', () => {
    it('should allow toggling action enabled state', async () => {
      const user = userEvent.setup()
      render(<QuickActionsConfiguration {...defaultProps} />)

      // Toggle disabled action to enabled
      const createTemplateToggle = screen.getByTestId('enable-toggle-create-template')
      expect(createTemplateToggle).not.toBeChecked()

      await user.click(createTemplateToggle)
      expect(createTemplateToggle).toBeChecked()

      // Should update configuration state
      const saveButton = screen.getByTestId('save-configuration-button')
      await user.click(saveButton)

      expect(defaultProps.onSave).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'create-template',
            enabled: true
          })
        ])
      )
    })

    it('should support reordering actions with drag and drop', async () => {
      const user = userEvent.setup()
      render(<QuickActionsConfiguration {...defaultProps} />)

      // Should have drag handles
      const dragHandle1 = screen.getByTestId('drag-handle-create-document')
      const dragHandle2 = screen.getByTestId('drag-handle-recent-documents')
      expect(dragHandle1).toBeInTheDocument()
      expect(dragHandle2).toBeInTheDocument()

      // Use move buttons instead of complex drag simulation
      const moveDownButton = screen.getByTestId('move-down-create-document')
      await user.click(moveDownButton)

      // Should update order (create-document moves from 1 to 2)
      expect(screen.getByTestId('order-input-create-document')).toHaveValue('2')
    })

    it('should allow manual order input', async () => {
      const user = userEvent.setup()
      render(<QuickActionsConfiguration {...defaultProps} />)

      // Change order via input
      const orderInput = screen.getByTestId('order-input-create-document')
      await user.clear(orderInput)
      await user.type(orderInput, '3')

      // Should update order
      expect(orderInput).toHaveValue('3')

      // Should validate order bounds
      await user.clear(orderInput)
      await user.type(orderInput, '10')

      // Should show validation error
      expect(screen.getByTestId('order-validation-error-create-document')).toBeInTheDocument()
      expect(screen.getByTestId('order-validation-error-create-document')).toHaveTextContent('Order must be between 1 and 5')
    })

    it('should provide action customization options', async () => {
      const user = userEvent.setup()
      render(<QuickActionsConfiguration {...defaultProps} />)

      // Click customize button
      const customizeButton = screen.getByTestId('customize-button-create-document')
      await user.click(customizeButton)

      // Should show customization modal
      const customizeModal = screen.getByTestId('action-customize-modal')
      expect(customizeModal).toBeInTheDocument()

      // Should allow title editing
      const titleInput = screen.getByTestId('customize-title-input')
      expect(titleInput).toHaveValue('Create Document')

      await user.clear(titleInput)
      await user.type(titleInput, 'New Document')

      // Should allow description editing
      const descriptionInput = screen.getByTestId('customize-description-input')
      expect(descriptionInput).toHaveValue('Start a new document')

      // Should allow icon selection
      const iconSelector = screen.getByTestId('customize-icon-selector')
      expect(iconSelector).toBeInTheDocument()

      await user.click(iconSelector)
      const iconOption = screen.getByTestId('icon-option-plus')
      await user.click(iconOption)
    })
  })

  describe('Category Management', () => {
    it('should display actions grouped by category', () => {
      render(<QuickActionsConfiguration {...defaultProps} />)

      // Should show category-specific action counts
      expect(screen.getByTestId('category-count-document')).toHaveTextContent('2')
      expect(screen.getByTestId('category-count-template')).toHaveTextContent('1')
      expect(screen.getByTestId('category-count-workflow')).toHaveTextContent('1')
      expect(screen.getByTestId('category-count-admin')).toHaveTextContent('1')

      // Should allow category filtering
      const categoryFilter = screen.getByTestId('category-filter-document')
      expect(categoryFilter).toBeInTheDocument()
    })

    it('should support category-wide enable/disable', async () => {
      const user = userEvent.setup()
      render(<QuickActionsConfiguration {...defaultProps} />)

      // Should have category-level controls
      const categoryToggle = screen.getByTestId('category-toggle-document')
      expect(categoryToggle).toBeInTheDocument()

      await user.click(categoryToggle)

      // Should disable all document category actions
      expect(screen.getByTestId('enable-toggle-create-document')).not.toBeChecked()
      expect(screen.getByTestId('enable-toggle-recent-documents')).not.toBeChecked()
    })

    it('should show category visibility settings', () => {
      render(<QuickActionsConfiguration {...defaultProps} />)

      // Should have category visibility options
      expect(screen.getByTestId('category-visibility-document')).toBeInTheDocument()
      expect(screen.getByTestId('category-visibility-template')).toBeInTheDocument()

      // Should show category descriptions
      const documentCategory = screen.getByTestId('category-description-document')
      expect(documentCategory).toHaveTextContent('Document creation and management actions')
    })
  })

  describe('Configuration Presets', () => {
    it('should offer predefined configuration presets', () => {
      render(<QuickActionsConfiguration {...defaultProps} />)

      // Should have preset options
      expect(screen.getByTestId('preset-selector')).toBeInTheDocument()
      expect(screen.getByTestId('preset-option-editor')).toBeInTheDocument()
      expect(screen.getByTestId('preset-option-manager')).toBeInTheDocument()
      expect(screen.getByTestId('preset-option-viewer')).toBeInTheDocument()

      // Should show preset descriptions
      const editorPreset = screen.getByTestId('preset-description-editor')
      expect(editorPreset).toHaveTextContent('Optimized for document editing and creation')
    })

    it('should allow applying configuration presets', async () => {
      const user = userEvent.setup()
      render(<QuickActionsConfiguration {...defaultProps} />)

      // Select and apply preset
      const presetSelector = screen.getByTestId('preset-selector')
      await user.selectOptions(presetSelector, 'manager')

      const applyPresetButton = screen.getByTestId('apply-preset-button')
      await user.click(applyPresetButton)

      // Should show confirmation modal
      expect(screen.getByTestId('preset-apply-confirmation')).toBeInTheDocument()
      expect(screen.getByTestId('preset-apply-confirmation')).toHaveTextContent('This will replace your current configuration')

      const confirmButton = screen.getByTestId('confirm-apply-preset')
      await user.click(confirmButton)

      // Should update configuration to match preset
      expect(screen.getByTestId('enable-toggle-workflow-center')).toBeChecked()
    })

    it('should allow saving custom presets', async () => {
      const user = userEvent.setup()
      render(<QuickActionsConfiguration {...defaultProps} />)

      // Should have save preset option
      const savePresetButton = screen.getByTestId('save-preset-button')
      await user.click(savePresetButton)

      // Should show save preset modal
      const savePresetModal = screen.getByTestId('save-preset-modal')
      expect(savePresetModal).toBeInTheDocument()

      // Should allow naming preset
      const presetNameInput = screen.getByTestId('preset-name-input')
      await user.type(presetNameInput, 'My Custom Setup')

      const presetDescriptionInput = screen.getByTestId('preset-description-input')
      await user.type(presetDescriptionInput, 'Custom configuration for my workflow')

      const saveButton = screen.getByTestId('save-custom-preset-button')
      await user.click(saveButton)

      // Should add to preset list
      await waitFor(() => {
        expect(screen.getByTestId('preset-option-my-custom-setup')).toBeInTheDocument()
      })
    })
  })

  describe('Import/Export Configuration', () => {
    it('should support configuration export', async () => {
      const user = userEvent.setup()
      render(<QuickActionsConfiguration {...defaultProps} />)

      // Should have export option
      const exportButton = screen.getByTestId('export-config-button')
      expect(exportButton).toBeInTheDocument()

      await user.click(exportButton)

      // Should show export modal
      expect(screen.getByTestId('export-config-modal')).toBeInTheDocument()

      // Should have export format options
      expect(screen.getByTestId('export-format-json')).toBeInTheDocument()
      expect(screen.getByTestId('export-format-csv')).toBeInTheDocument()

      // Should generate exportable data
      const exportData = screen.getByTestId('export-data-preview')
      expect(exportData).toBeInTheDocument()
      expect(exportData).toHaveTextContent('"id": "create-document"')
    })

    it('should support configuration import', async () => {
      const user = userEvent.setup()
      render(<QuickActionsConfiguration {...defaultProps} />)

      // Should have import option
      const importButton = screen.getByTestId('import-config-button')
      expect(importButton).toBeInTheDocument()

      await user.click(importButton)

      // Should show import modal
      expect(screen.getByTestId('import-config-modal')).toBeInTheDocument()

      // Should have file upload
      const fileInput = screen.getByTestId('import-file-input')
      expect(fileInput).toBeInTheDocument()

      // Should validate import data
      const importTextarea = screen.getByTestId('import-data-textarea') as HTMLTextAreaElement
      fireEvent.change(importTextarea, { target: { value: '{"invalid": "json"}' } })

      const validateButton = screen.getByTestId('validate-import-button')
      await user.click(validateButton)

      // Should show validation error
      expect(screen.getByTestId('import-validation-error')).toBeInTheDocument()
      expect(screen.getByTestId('import-validation-error')).toHaveTextContent('Invalid configuration format')
    })

    it('should validate configuration integrity during import', async () => {
      const user = userEvent.setup()
      render(<QuickActionsConfiguration {...defaultProps} />)

      const importButton = screen.getByTestId('import-config-button')
      await user.click(importButton)

      // Import valid but incomplete configuration
      const validConfig = JSON.stringify([
        {
          id: 'create-document',
          enabled: true,
          // Missing required fields
        }
      ])

      const importTextarea = screen.getByTestId('import-data-textarea') as HTMLTextAreaElement
      fireEvent.change(importTextarea, { target: { value: validConfig } })

      const validateButton = screen.getByTestId('validate-import-button')
      await user.click(validateButton)

      // Should show validation warnings
      expect(screen.getByTestId('import-validation-warnings')).toBeInTheDocument()
      expect(screen.getByTestId('import-validation-warnings')).toHaveTextContent('Missing required field: title')
    })
  })

  describe('Configuration Search and Filtering', () => {
    it('should provide action search functionality', async () => {
      const user = userEvent.setup()
      render(<QuickActionsConfiguration {...defaultProps} />)

      // Should have search input
      const searchInput = screen.getByTestId('action-search-input')
      expect(searchInput).toBeInTheDocument()

      // Search for specific action
      await user.type(searchInput, 'document')

      // Should filter actions
      expect(screen.getByTestId('config-card-create-document')).toBeInTheDocument()
      expect(screen.getByTestId('config-card-recent-documents')).toBeInTheDocument()
      expect(screen.queryByTestId('config-card-workflow-center')).not.toBeInTheDocument()

      // Should show search results count
      expect(screen.getByTestId('search-results-count')).toHaveTextContent('3 actions found')
    })

    it('should support filtering by multiple criteria', async () => {
      const user = userEvent.setup()
      render(<QuickActionsConfiguration {...defaultProps} />)

      // Filter by enabled status
      const enabledFilter = screen.getByTestId('filter-enabled-only')
      await user.click(enabledFilter)

      // Should show only enabled actions
      expect(screen.getByTestId('config-card-create-document')).toBeInTheDocument()
      expect(screen.queryByTestId('config-card-create-template')).not.toBeInTheDocument()

      // Filter by customizable
      const customizableFilter = screen.getByTestId('filter-customizable-only')
      await user.click(customizableFilter)

      // Should further filter results
      expect(screen.getByTestId('config-card-create-document')).toBeInTheDocument()
      expect(screen.queryByTestId('config-card-workflow-center')).not.toBeInTheDocument()

      // Should show applied filters
      expect(screen.getByTestId('applied-filters')).toBeInTheDocument()
      expect(screen.getByTestId('filter-tag-enabled')).toBeInTheDocument()
      expect(screen.getByTestId('filter-tag-customizable')).toBeInTheDocument()
    })

    it('should provide quick filter shortcuts', async () => {
      const user = userEvent.setup()
      render(<QuickActionsConfiguration {...defaultProps} />)

      // Should have quick filter buttons
      expect(screen.getByTestId('quick-filter-all')).toBeInTheDocument()
      expect(screen.getByTestId('quick-filter-enabled')).toBeInTheDocument()
      expect(screen.getByTestId('quick-filter-disabled')).toBeInTheDocument()
      expect(screen.getByTestId('quick-filter-customizable')).toBeInTheDocument()

      // Click disabled filter
      const disabledFilter = screen.getByTestId('quick-filter-disabled')
      await user.click(disabledFilter)

      // Should show only disabled actions
      expect(screen.queryByTestId('config-card-create-document')).not.toBeInTheDocument()
      expect(screen.getByTestId('config-card-create-template')).toBeInTheDocument()
    })
  })

  describe('Configuration Validation and Save', () => {
    it('should validate configuration before saving', async () => {
      const user = userEvent.setup()

      // Use custom props with all actions customizable
      const customActions = mockConfigurableActions.map(action => ({
        ...action,
        customizable: true // Make all actions customizable for this test
      }))

      const customProps = { ...defaultProps, actions: customActions }
      render(<QuickActionsConfiguration {...customProps} />)

      // Disable all enabled actions to create invalid state
      const enabledActions = ['create-document', 'recent-documents', 'workflow-center'] // based on mock data
      for (const actionId of enabledActions) {
        const toggle = screen.getByTestId(`enable-toggle-${actionId}`)
        await user.click(toggle)
        // Wait for state update
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      // Try to save
      const saveButton = screen.getByTestId('save-configuration-button')
      await user.click(saveButton)

      // Should show validation error
      expect(screen.getByTestId('config-validation-error')).toBeInTheDocument()
      expect(screen.getByTestId('config-validation-error')).toHaveTextContent('At least one action must be enabled')

      // Should not call onSave
      expect(defaultProps.onSave).not.toHaveBeenCalled()
    })

    it('should show unsaved changes warning', async () => {
      const user = userEvent.setup()
      render(<QuickActionsConfiguration {...defaultProps} />)

      // Make a change
      const toggle = screen.getByTestId('enable-toggle-create-template')
      await user.click(toggle)

      // Should show unsaved changes indicator
      expect(screen.getByTestId('unsaved-changes-indicator')).toBeInTheDocument()
      expect(screen.getByTestId('unsaved-changes-indicator')).toHaveTextContent('Unsaved changes')

      // Try to cancel
      const cancelButton = screen.getByTestId('cancel-configuration-button')
      await user.click(cancelButton)

      // Should show confirmation
      expect(screen.getByTestId('unsaved-changes-confirmation')).toBeInTheDocument()
      expect(screen.getByTestId('unsaved-changes-confirmation')).toHaveTextContent('You have unsaved changes')

      const discardButton = screen.getByTestId('discard-changes-button')
      await user.click(discardButton)

      expect(defaultProps.onCancel).toHaveBeenCalled()
    })

    it('should provide configuration reset functionality', async () => {
      const user = userEvent.setup()
      render(<QuickActionsConfiguration {...defaultProps} />)

      // Make changes
      const toggle = screen.getByTestId('enable-toggle-create-template')
      await user.click(toggle)

      // Reset configuration
      const resetButton = screen.getByTestId('reset-configuration-button')
      await user.click(resetButton)

      // Should show confirmation
      expect(screen.getByTestId('reset-confirmation-modal')).toBeInTheDocument()
      expect(screen.getByTestId('reset-confirmation-modal')).toHaveTextContent('Reset to default configuration?')

      const confirmResetButton = screen.getByTestId('confirm-reset-button')
      await user.click(confirmResetButton)

      expect(defaultProps.onReset).toHaveBeenCalled()
    })

    it('should successfully save valid configuration', async () => {
      const user = userEvent.setup()
      render(<QuickActionsConfiguration {...defaultProps} />)

      // Make valid changes
      const toggle = screen.getByTestId('enable-toggle-create-template')
      await user.click(toggle)

      // Save configuration
      const saveButton = screen.getByTestId('save-configuration-button')
      await user.click(saveButton)

      // Should call onSave with updated configuration
      expect(defaultProps.onSave).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'create-template',
            enabled: true
          })
        ])
      )

      // Should show success message
      expect(screen.getByTestId('config-save-success')).toBeInTheDocument()
      expect(screen.getByTestId('config-save-success')).toHaveTextContent('Configuration saved successfully')
    })
  })
})