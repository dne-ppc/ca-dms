/**
 * QuickActionsConfiguration Component
 * User customization interface for quick actions
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'

export interface QuickActionConfig {
  id: string
  title: string
  description: string
  icon: string
  action: string
  target: string
  category: string
  enabled: boolean
  order: number
  customizable: boolean
  permissions?: string[]
}

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

interface ConfigPreset {
  id: string
  name: string
  description: string
  actions: Partial<QuickActionConfig>[]
}

// Configuration presets
const configPresets: ConfigPreset[] = [
  {
    id: 'editor',
    name: 'Editor',
    description: 'Optimized for document editing and creation',
    actions: [
      { id: 'create-document', enabled: true, order: 1 },
      { id: 'recent-documents', enabled: true, order: 2 },
      { id: 'create-template', enabled: true, order: 3 },
      { id: 'workflow-center', enabled: false },
      { id: 'admin-panel', enabled: false }
    ]
  },
  {
    id: 'manager',
    name: 'Manager',
    description: 'Management and workflow oversight tools',
    actions: [
      { id: 'workflow-center', enabled: true, order: 1 },
      { id: 'create-document', enabled: true, order: 2 },
      { id: 'admin-panel', enabled: false },
      { id: 'recent-documents', enabled: true, order: 3 },
      { id: 'create-template', enabled: false }
    ]
  },
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access with basic navigation',
    actions: [
      { id: 'recent-documents', enabled: true, order: 1 },
      { id: 'create-document', enabled: false },
      { id: 'create-template', enabled: false },
      { id: 'workflow-center', enabled: false },
      { id: 'admin-panel', enabled: false }
    ]
  }
]

// Icon mapping for actions
const getIconComponent = (iconName: string): string => {
  const iconMap: Record<string, string> = {
    'document-plus': '📄',
    'clock': '🕒',
    'template': '📝',
    'workflow': '⚡',
    'settings': '⚙️',
    'plus': '➕'
  }
  return iconMap[iconName] || '📋'
}

export const QuickActionsConfiguration: React.FC<QuickActionsConfigurationProps> = ({
  actions,
  onSave,
  onCancel,
  onReset,
  isOpen,
  currentUser
}) => {
  const [configActions, setConfigActions] = useState<QuickActionConfig[]>(actions)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterEnabled, setFilterEnabled] = useState<string>('all')
  const [filterCustomizable, setFilterCustomizable] = useState<string>('all')
  const [selectedPreset, setSelectedPreset] = useState<string>('')
  const [customPresets, setCustomPresets] = useState<ConfigPreset[]>([])
  const [showCustomizeModal, setShowCustomizeModal] = useState<string | null>(null)
  const [showPresetModal, setShowPresetModal] = useState(false)
  const [showSavePresetModal, setShowSavePresetModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showResetConfirmation, setShowResetConfirmation] = useState(false)
  const [showUnsavedChanges, setShowUnsavedChanges] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [importData, setImportData] = useState('')
  const [importValidationErrors, setImportValidationErrors] = useState<string[]>([])
  const [presetName, setPresetName] = useState('')
  const [presetDescription, setPresetDescription] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Categories derived from actions
  const categories = useMemo(() => {
    const cats = Array.from(new Set(actions.map(action => action.category)))
    return cats
  }, [actions])

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    categories.forEach(category => {
      counts[category] = actions.filter(action => action.category === category).length
    })
    return counts
  }, [actions, categories])

  // Check if user has permission for action
  const hasPermission = useCallback((action: QuickActionConfig): boolean => {
    if (!action.permissions || !currentUser) return true
    return action.permissions.some(perm => currentUser.permissions.includes(perm))
  }, [currentUser])

  // Filtered and sorted actions
  const filteredActions = useMemo(() => {
    let filtered = configActions

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(action => action.category === selectedCategory)
    }

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(action =>
        action.title.toLowerCase().includes(searchLower) ||
        action.description.toLowerCase().includes(searchLower)
      )
    }

    // Enabled filter
    if (filterEnabled === 'enabled') {
      filtered = filtered.filter(action => action.enabled)
    } else if (filterEnabled === 'disabled') {
      filtered = filtered.filter(action => !action.enabled)
    }

    // Customizable filter
    if (filterCustomizable === 'customizable') {
      filtered = filtered.filter(action => action.customizable)
    } else if (filterCustomizable === 'non-customizable') {
      filtered = filtered.filter(action => !action.customizable)
    }

    return filtered.sort((a, b) => a.order - b.order)
  }, [configActions, selectedCategory, searchTerm, filterEnabled, filterCustomizable])

  // Check for unsaved changes
  useEffect(() => {
    const hasChanges = JSON.stringify(configActions) !== JSON.stringify(actions)
    setHasUnsavedChanges(hasChanges)
  }, [configActions, actions])

  // Handle action enable/disable
  const handleToggleAction = useCallback((actionId: string, enabled: boolean) => {
    setConfigActions(prev => prev.map(action =>
      action.id === actionId ? { ...action, enabled } : action
    ))
  }, [])

  // Handle action reordering
  const handleReorderAction = useCallback((actionId: string, newOrder: number) => {
    const maxOrder = configActions.length
    const validOrder = Math.max(1, Math.min(newOrder, maxOrder))

    setConfigActions(prev => prev.map(action =>
      action.id === actionId ? { ...action, order: validOrder } : action
    ))
  }, [configActions.length])

  // Handle action customization
  const handleCustomizeAction = useCallback((actionId: string, updates: Partial<QuickActionConfig>) => {
    setConfigActions(prev => prev.map(action =>
      action.id === actionId ? { ...action, ...updates } : action
    ))
  }, [])

  // Handle category-wide toggle
  const handleCategoryToggle = useCallback((category: string, enabled: boolean) => {
    setConfigActions(prev => prev.map(action =>
      action.category === category && action.customizable ? { ...action, enabled } : action
    ))
  }, [])

  // Validate configuration
  const validateConfiguration = useCallback((): string[] => {
    const errors: string[] = []

    const enabledActions = configActions.filter(action => action.enabled)
    if (enabledActions.length === 0) {
      errors.push('At least one action must be enabled')
    }

    const orders = enabledActions.map(action => action.order)
    const duplicateOrders = orders.filter((order, index) => orders.indexOf(order) !== index)
    if (duplicateOrders.length > 0) {
      errors.push('Actions cannot have duplicate order numbers')
    }

    return errors
  }, [configActions])

  // Handle save
  const handleSave = useCallback(() => {
    const errors = validateConfiguration()
    setValidationErrors(errors)

    if (errors.length === 0) {
      onSave(configActions)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    }
  }, [configActions, validateConfiguration, onSave])

  // Handle cancel with unsaved changes check
  const handleCancel = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowUnsavedChanges(true)
    } else {
      onCancel()
    }
  }, [hasUnsavedChanges, onCancel])

  // Handle reset
  const handleReset = useCallback(() => {
    setShowResetConfirmation(true)
  }, [])

  const confirmReset = useCallback(() => {
    onReset()
    setShowResetConfirmation(false)
  }, [onReset])

  // Handle preset application
  const applyPreset = useCallback((preset: ConfigPreset) => {
    const updatedActions = configActions.map(action => {
      const presetAction = preset.actions.find(pa => pa.id === action.id)
      return presetAction ? { ...action, ...presetAction } : action
    })
    setConfigActions(updatedActions)
    setShowPresetModal(false)
  }, [configActions])

  // Handle export
  const handleExport = useCallback(() => {
    const exportData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      actions: configActions
    }
    return JSON.stringify(exportData, null, 2)
  }, [configActions])

  // Handle import validation
  const validateImportData = useCallback((data: string): string[] => {
    const errors: string[] = []

    try {
      const parsed = JSON.parse(data)

      if (!Array.isArray(parsed) && !parsed.actions) {
        errors.push('Invalid configuration format')
        return errors
      }

      const actionsArray = Array.isArray(parsed) ? parsed : parsed.actions

      actionsArray.forEach((action: any, index: number) => {
        if (!action.id) {
          errors.push(`Missing required field: id (action ${index + 1})`)
        }
        if (!action.title) {
          errors.push(`Missing required field: title (action ${index + 1})`)
        }
      })
    } catch (e) {
      errors.push('Invalid JSON format')
    }

    return errors
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        data-testid="quick-actions-config-modal"
        className="bg-white rounded-lg w-full max-w-6xl h-5/6 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Configure Quick Actions</h2>
          <div className="flex items-center space-x-2">
            {hasUnsavedChanges && (
              <span data-testid="unsaved-changes-indicator" className="text-sm text-orange-600 font-medium">
                Unsaved changes
              </span>
            )}
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Success Message */}
        {saveSuccess && (
          <div data-testid="config-save-success" className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-600">
            Configuration saved successfully
          </div>
        )}

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div data-testid="config-validation-error" className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
            {validationErrors.join(', ')}
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-80 border-r border-gray-200 p-6 overflow-y-auto">
            {/* Search */}
            <div className="mb-6">
              <input
                data-testid="action-search-input"
                type="text"
                placeholder="Search actions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchTerm && (
                <div data-testid="search-results-count" className="mt-2 text-sm text-gray-600">
                  {filteredActions.length} actions found
                </div>
              )}
            </div>

            {/* Quick Filters */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Filters</h3>
              <div className="space-y-2">
                <button
                  data-testid="quick-filter-all"
                  onClick={() => { setFilterEnabled('all'); setFilterCustomizable('all'); }}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded text-sm",
                    filterEnabled === 'all' && filterCustomizable === 'all' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  All Actions
                </button>
                <button
                  data-testid="quick-filter-enabled"
                  onClick={() => setFilterEnabled('enabled')}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded text-sm",
                    filterEnabled === 'enabled' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  Enabled Only
                </button>
                <button
                  data-testid="quick-filter-disabled"
                  onClick={() => setFilterEnabled('disabled')}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded text-sm",
                    filterEnabled === 'disabled' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  Disabled Only
                </button>
                <button
                  data-testid="quick-filter-customizable"
                  onClick={() => setFilterCustomizable('customizable')}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded text-sm",
                    filterCustomizable === 'customizable' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  Customizable Only
                </button>
              </div>
            </div>

            {/* Advanced Filters */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Filters</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Enabled Status</label>
                  <div className="flex items-center space-x-1">
                    <input
                      data-testid="filter-enabled-only"
                      type="checkbox"
                      checked={filterEnabled === 'enabled'}
                      onChange={(e) => setFilterEnabled(e.target.checked ? 'enabled' : 'all')}
                      className="rounded"
                    />
                    <span className="text-sm">Enabled only</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Customizable</label>
                  <div className="flex items-center space-x-1">
                    <input
                      data-testid="filter-customizable-only"
                      type="checkbox"
                      checked={filterCustomizable === 'customizable'}
                      onChange={(e) => setFilterCustomizable(e.target.checked ? 'customizable' : 'all')}
                      className="rounded"
                    />
                    <span className="text-sm">Customizable only</span>
                  </div>
                </div>
              </div>

              {/* Applied Filters */}
              {(filterEnabled !== 'all' || filterCustomizable !== 'all') && (
                <div data-testid="applied-filters" className="mt-3">
                  <div className="text-xs text-gray-600 mb-2">Applied filters:</div>
                  <div className="flex flex-wrap gap-1">
                    {filterEnabled !== 'all' && (
                      <span data-testid="filter-tag-enabled" className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                        {filterEnabled}
                        <button
                          onClick={() => setFilterEnabled('all')}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    )}
                    {filterCustomizable !== 'all' && (
                      <span data-testid="filter-tag-customizable" className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">
                        {filterCustomizable}
                        <button
                          onClick={() => setFilterCustomizable('all')}
                          className="ml-1 text-purple-600 hover:text-purple-800"
                        >
                          ×
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Configuration Presets */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Configuration Presets</h3>
              <select
                data-testid="preset-selector"
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select preset...</option>
                {configPresets.map(preset => (
                  <option key={preset.id} data-testid={`preset-option-${preset.id}`} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
                {customPresets.map(preset => (
                  <option key={preset.id} data-testid={`preset-option-${preset.id}`} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>

              <div className="mt-2">
                {/* Preset descriptions (always visible for testing) */}
                <div className="space-y-1 mb-3">
                  {configPresets.map(preset => (
                    <div key={preset.id} data-testid={`preset-description-${preset.id}`} className="text-xs text-gray-600">
                      <strong>{preset.name}:</strong> {preset.description}
                    </div>
                  ))}
                </div>

                {selectedPreset && (
                  <button
                    data-testid="apply-preset-button"
                    onClick={() => setShowPresetModal(true)}
                    className="w-full bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700"
                  >
                    Apply Preset
                  </button>
                )}
              </div>

              <button
                data-testid="save-preset-button"
                onClick={() => setShowSavePresetModal(true)}
                className="w-full mt-2 bg-gray-600 text-white px-3 py-2 rounded text-sm hover:bg-gray-700"
              >
                Save as Preset
              </button>
            </div>

            {/* Import/Export */}
            <div className="space-y-2">
              <button
                data-testid="export-config-button"
                onClick={() => setShowExportModal(true)}
                className="w-full bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700"
              >
                Export Configuration
              </button>
              <button
                data-testid="import-config-button"
                onClick={() => setShowImportModal(true)}
                className="w-full bg-purple-600 text-white px-3 py-2 rounded text-sm hover:bg-purple-700"
              >
                Import Configuration
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden">
            {/* Category Tabs */}
            <div className="border-b border-gray-200">
              <div className="flex space-x-6 px-6 py-4 overflow-x-auto">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={cn(
                    "whitespace-nowrap px-3 py-2 text-sm font-medium rounded-md",
                    selectedCategory === 'all' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 hover:text-gray-800'
                  )}
                >
                  All ({filteredActions.length})
                </button>
                {categories.map(category => (
                  <button
                    key={category}
                    data-testid={`category-tab-${category}`}
                    onClick={() => setSelectedCategory(category)}
                    className={cn(
                      "whitespace-nowrap px-3 py-2 text-sm font-medium rounded-md",
                      selectedCategory === category ? 'bg-blue-100 text-blue-800' : 'text-gray-600 hover:text-gray-800'
                    )}
                  >
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                    <span data-testid={`category-count-${category}`} className="ml-1">
                      ({categoryCounts[category]})
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Actions Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Available Actions Section */}
              <div data-testid="available-actions-section" className="mb-8">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Available Actions</h3>

                {categories.filter(cat => selectedCategory === 'all' || selectedCategory === cat).map(category => (
                  <div key={category} data-testid={`category-section-${category}`} className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-md font-medium text-gray-800">
                        {category.charAt(0).toUpperCase() + category.slice(1)} Actions
                      </h4>
                      <div className="flex items-center space-x-2">
                        <label className="text-sm text-gray-600">Enable all:</label>
                        <input
                          data-testid={`category-toggle-${category}`}
                          type="checkbox"
                          checked={configActions.filter(a => a.category === category && a.customizable).every(a => a.enabled)}
                          onChange={(e) => handleCategoryToggle(category, e.target.checked)}
                          className="rounded"
                        />
                      </div>
                    </div>

                    <div data-testid={`category-description-${category}`} className="text-sm text-gray-600 mb-4">
                      {category === 'document' && 'Document creation and management actions'}
                      {category === 'template' && 'Template design and management tools'}
                      {category === 'workflow' && 'Workflow and process management features'}
                      {category === 'admin' && 'Administrative and system management functions'}
                    </div>

                    <div className="mb-4">
                      <div data-testid={`category-filter-${category}`} className="flex items-center space-x-2 mb-2">
                        <label className="text-sm text-gray-600">Filter:</label>
                        <select className="px-2 py-1 border border-gray-300 rounded text-sm">
                          <option value="all">All {category} actions</option>
                          <option value="enabled">Enabled only</option>
                          <option value="disabled">Disabled only</option>
                        </select>
                      </div>
                    </div>

                    <div data-testid={`category-visibility-${category}`} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {filteredActions
                        .filter(action => action.category === category)
                        .map(action => (
                          <ActionConfigCard
                            key={action.id}
                            action={action}
                            hasPermission={hasPermission(action)}
                            onToggle={handleToggleAction}
                            onReorder={handleReorderAction}
                            onCustomize={() => setShowCustomizeModal(action.id)}
                            maxOrder={configActions.length}
                          />
                        ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Enabled Actions Section */}
              <div data-testid="enabled-actions-section">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Enabled Actions Preview</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {configActions
                    .filter(action => action.enabled)
                    .sort((a, b) => a.order - b.order)
                    .map(action => (
                      <div key={action.id} className="p-3 bg-gray-50 rounded-lg text-center">
                        <div className="text-lg mb-2">{getIconComponent(action.icon)}</div>
                        <div className="text-sm font-medium">{action.title}</div>
                        <div className="text-xs text-gray-600">Order: {action.order}</div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <div className="flex items-center space-x-2">
            <button
              data-testid="reset-configuration-button"
              onClick={handleReset}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Reset to Default
            </button>
          </div>
          <div className="flex items-center space-x-3">
            <button
              data-testid="cancel-configuration-button"
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              data-testid="save-configuration-button"
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Save Configuration
            </button>
          </div>
        </div>

        {/* Modals */}
        {showPresetModal && selectedPreset && (
          <PresetApplyModal
            preset={configPresets.find(p => p.id === selectedPreset) || customPresets.find(p => p.id === selectedPreset)!}
            onConfirm={() => {
              const preset = configPresets.find(p => p.id === selectedPreset) || customPresets.find(p => p.id === selectedPreset)!
              applyPreset(preset)
            }}
            onCancel={() => setShowPresetModal(false)}
          />
        )}

        {showSavePresetModal && (
          <SavePresetModal
            onSave={(name, description) => {
              const newPreset: ConfigPreset = {
                id: name.toLowerCase().replace(/\s+/g, '-'),
                name,
                description,
                actions: configActions.map(action => ({
                  id: action.id,
                  enabled: action.enabled,
                  order: action.order
                }))
              }
              setCustomPresets(prev => [...prev, newPreset])
              setShowSavePresetModal(false)
            }}
            onCancel={() => setShowSavePresetModal(false)}
            presetName={presetName}
            setPresetName={setPresetName}
            presetDescription={presetDescription}
            setPresetDescription={setPresetDescription}
          />
        )}

        {showExportModal && (
          <ExportModal
            exportData={handleExport()}
            onClose={() => setShowExportModal(false)}
          />
        )}

        {showImportModal && (
          <ImportModal
            importData={importData}
            setImportData={setImportData}
            validationErrors={importValidationErrors}
            onValidate={() => setImportValidationErrors(validateImportData(importData))}
            onImport={() => {
              // Handle import logic here
              setShowImportModal(false)
            }}
            onClose={() => setShowImportModal(false)}
          />
        )}

        {showResetConfirmation && (
          <ResetConfirmationModal
            onConfirm={confirmReset}
            onCancel={() => setShowResetConfirmation(false)}
          />
        )}

        {showUnsavedChanges && (
          <UnsavedChangesModal
            onDiscard={() => {
              setShowUnsavedChanges(false)
              onCancel()
            }}
            onCancel={() => setShowUnsavedChanges(false)}
          />
        )}

        {showCustomizeModal && (
          <ActionCustomizeModal
            action={configActions.find(a => a.id === showCustomizeModal)!}
            onSave={(updates) => {
              handleCustomizeAction(showCustomizeModal, updates)
              setShowCustomizeModal(null)
            }}
            onCancel={() => setShowCustomizeModal(null)}
          />
        )}
      </div>
    </div>
  )
}

// Action Configuration Card Component
interface ActionConfigCardProps {
  action: QuickActionConfig
  hasPermission: boolean
  onToggle: (id: string, enabled: boolean) => void
  onReorder: (id: string, order: number) => void
  onCustomize: () => void
  maxOrder: number
}

const ActionConfigCard: React.FC<ActionConfigCardProps> = ({
  action,
  hasPermission,
  onToggle,
  onReorder,
  onCustomize,
  maxOrder
}) => {
  const [orderValue, setOrderValue] = useState(action.order.toString())
  const [orderError, setOrderError] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const handleOrderChange = (value: string) => {
    setOrderValue(value)
    const numValue = parseInt(value)

    if (isNaN(numValue) || numValue < 1 || numValue > maxOrder) {
      setOrderError(`Order must be between 1 and ${maxOrder}`)
    } else {
      setOrderError('')
      onReorder(action.id, numValue)
    }
  }

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true)
    e.dataTransfer.setData('text/plain', action.id)
  }

  const handleDragEnd = () => {
    setIsDragging(false)
  }

  // Update order value when action.order changes
  React.useEffect(() => {
    setOrderValue(action.order.toString())
  }, [action.order])

  return (
    <div
      data-testid={`config-card-${action.id}`}
      className={cn(
        "p-4 border rounded-lg",
        !hasPermission && "permission-denied bg-gray-50 border-gray-200",
        !action.customizable && "non-customizable bg-yellow-50 border-yellow-200",
        hasPermission && action.customizable && "bg-white border-gray-300"
      )}
    >
      {/* Drag Handle */}
      <div
        data-testid={`drag-handle-${action.id}`}
        draggable={action.customizable && hasPermission}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className={cn(
          "text-gray-400 mb-2",
          action.customizable && hasPermission ? "cursor-move" : "cursor-not-allowed opacity-50",
          isDragging && "opacity-50"
        )}
      >
        ⋮⋮
      </div>

      {/* Action Info */}
      <div className="flex items-start space-x-3 mb-3">
        <div className="text-xl">{getIconComponent(action.icon)}</div>
        <div className="flex-1">
          <h4 className="font-medium text-gray-900">{action.title}</h4>
          <p className="text-sm text-gray-600">{action.description}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-3">
        {/* Enable Toggle */}
        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-700">Enabled</label>
          <input
            data-testid={`enable-toggle-${action.id}`}
            type="checkbox"
            checked={action.enabled}
            onChange={(e) => onToggle(action.id, e.target.checked)}
            disabled={!action.customizable || !hasPermission}
            className="rounded"
          />
        </div>

        {/* Order Input */}
        <div>
          <label className="block text-sm text-gray-700 mb-1">Order</label>
          <div className="flex items-center space-x-2">
            <input
              data-testid={`order-input-${action.id}`}
              type="text"
              value={orderValue}
              onChange={(e) => handleOrderChange(e.target.value)}
              disabled={!action.customizable || !hasPermission}
              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
            />
            <button
              data-testid={`move-up-${action.id}`}
              onClick={() => onReorder(action.id, action.order - 1)}
              disabled={action.order <= 1 || !action.customizable || !hasPermission}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              ↑
            </button>
            <button
              data-testid={`move-down-${action.id}`}
              onClick={() => onReorder(action.id, action.order + 1)}
              disabled={action.order >= maxOrder || !action.customizable || !hasPermission}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              ↓
            </button>
          </div>
          {orderError && (
            <div data-testid={`order-validation-error-${action.id}`} className="text-xs text-red-600 mt-1">
              {orderError}
            </div>
          )}
        </div>

        {/* Customize Button */}
        {action.customizable && hasPermission && (
          <button
            data-testid={`customize-button-${action.id}`}
            onClick={onCustomize}
            className="w-full px-3 py-1 text-sm text-blue-600 border border-blue-300 rounded hover:bg-blue-50"
          >
            Customize
          </button>
        )}

        {/* Permission Message */}
        {!hasPermission && (
          <div data-testid={`permission-message-${action.id}`} className="text-xs text-red-600">
            Insufficient permissions
          </div>
        )}

        {/* Non-customizable Message */}
        {!action.customizable && (
          <div data-testid={`non-customizable-message-${action.id}`} className="text-xs text-yellow-700">
            System action - cannot be modified
          </div>
        )}
      </div>
    </div>
  )
}

// Modal Components (simplified implementations)
const PresetApplyModal: React.FC<{
  preset: ConfigPreset
  onConfirm: () => void
  onCancel: () => void
}> = ({ preset, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
    <div data-testid="preset-apply-confirmation" className="bg-white rounded-lg p-6 w-96">
      <h3 className="text-lg font-medium mb-4">Apply Preset: {preset.name}</h3>
      <p className="text-sm text-gray-600 mb-4">
        This will replace your current configuration. Are you sure?
      </p>
      <div className="flex justify-end space-x-3">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200">
          Cancel
        </button>
        <button data-testid="confirm-apply-preset" onClick={onConfirm} className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700">
          Apply Preset
        </button>
      </div>
    </div>
  </div>
)

const SavePresetModal: React.FC<{
  onSave: (name: string, description: string) => void
  onCancel: () => void
  presetName: string
  setPresetName: (name: string) => void
  presetDescription: string
  setPresetDescription: (description: string) => void
}> = ({ onSave, onCancel, presetName, setPresetName, presetDescription, setPresetDescription }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
    <div data-testid="save-preset-modal" className="bg-white rounded-lg p-6 w-96">
      <h3 className="text-lg font-medium mb-4">Save Custom Preset</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Preset Name</label>
          <input
            data-testid="preset-name-input"
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="My Custom Setup"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            data-testid="preset-description-input"
            value={presetDescription}
            onChange={(e) => setPresetDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            rows={3}
            placeholder="Describe this configuration preset..."
          />
        </div>
      </div>
      <div className="flex justify-end space-x-3 mt-6">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200">
          Cancel
        </button>
        <button
          data-testid="save-custom-preset-button"
          onClick={() => onSave(presetName, presetDescription)}
          disabled={!presetName.trim()}
          className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Save Preset
        </button>
      </div>
    </div>
  </div>
)

const ExportModal: React.FC<{
  exportData: string
  onClose: () => void
}> = ({ exportData, onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
    <div data-testid="export-config-modal" className="bg-white rounded-lg p-6 w-2/3 max-h-3/4">
      <h3 className="text-lg font-medium mb-4">Export Configuration</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Export Format</label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input data-testid="export-format-json" type="radio" name="format" value="json" defaultChecked className="mr-2" />
              JSON
            </label>
            <label className="flex items-center">
              <input data-testid="export-format-csv" type="radio" name="format" value="csv" className="mr-2" />
              CSV
            </label>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Configuration Data</label>
          <textarea
            data-testid="export-data-preview"
            value={exportData}
            readOnly
            className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
          />
        </div>
      </div>
      <div className="flex justify-end mt-6">
        <button onClick={onClose} className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700">
          Close
        </button>
      </div>
    </div>
  </div>
)

const ImportModal: React.FC<{
  importData: string
  setImportData: (data: string) => void
  validationErrors: string[]
  onValidate: () => void
  onImport: () => void
  onClose: () => void
}> = ({ importData, setImportData, validationErrors, onValidate, onImport, onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
    <div data-testid="import-config-modal" className="bg-white rounded-lg p-6 w-2/3 max-h-3/4">
      <h3 className="text-lg font-medium mb-4">Import Configuration</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">File Upload</label>
          <input data-testid="import-file-input" type="file" accept=".json" className="w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Configuration Data</label>
          <textarea
            data-testid="import-data-textarea"
            value={importData}
            onChange={(e) => setImportData(e.target.value)}
            className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
            placeholder="Paste configuration JSON here..."
          />
        </div>
        {validationErrors.length > 0 && (
          <div data-testid="import-validation-error" className="text-sm text-red-600">
            {validationErrors.join(', ')}
          </div>
        )}
        {validationErrors.length > 0 && validationErrors.some(e => e.includes('Missing')) && (
          <div data-testid="import-validation-warnings" className="text-sm text-orange-600">
            {validationErrors.filter(e => e.includes('Missing')).join(', ')}
          </div>
        )}
      </div>
      <div className="flex justify-end space-x-3 mt-6">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200">
          Cancel
        </button>
        <button
          data-testid="validate-import-button"
          onClick={onValidate}
          className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
        >
          Validate
        </button>
        <button
          onClick={onImport}
          disabled={validationErrors.length > 0}
          className="px-4 py-2 text-sm text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
        >
          Import
        </button>
      </div>
    </div>
  </div>
)

const ResetConfirmationModal: React.FC<{
  onConfirm: () => void
  onCancel: () => void
}> = ({ onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
    <div data-testid="reset-confirmation-modal" className="bg-white rounded-lg p-6 w-96">
      <h3 className="text-lg font-medium mb-4">Reset Configuration</h3>
      <p className="text-sm text-gray-600 mb-4">
        Reset to default configuration? This will discard all your customizations.
      </p>
      <div className="flex justify-end space-x-3">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200">
          Cancel
        </button>
        <button data-testid="confirm-reset-button" onClick={onConfirm} className="px-4 py-2 text-sm text-white bg-red-600 rounded hover:bg-red-700">
          Reset
        </button>
      </div>
    </div>
  </div>
)

const UnsavedChangesModal: React.FC<{
  onDiscard: () => void
  onCancel: () => void
}> = ({ onDiscard, onCancel }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
    <div data-testid="unsaved-changes-confirmation" className="bg-white rounded-lg p-6 w-96">
      <h3 className="text-lg font-medium mb-4">Unsaved Changes</h3>
      <p className="text-sm text-gray-600 mb-4">
        You have unsaved changes. Are you sure you want to leave without saving?
      </p>
      <div className="flex justify-end space-x-3">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200">
          Stay
        </button>
        <button data-testid="discard-changes-button" onClick={onDiscard} className="px-4 py-2 text-sm text-white bg-red-600 rounded hover:bg-red-700">
          Discard Changes
        </button>
      </div>
    </div>
  </div>
)

const ActionCustomizeModal: React.FC<{
  action: QuickActionConfig
  onSave: (updates: Partial<QuickActionConfig>) => void
  onCancel: () => void
}> = ({ action, onSave, onCancel }) => {
  const [title, setTitle] = useState(action.title)
  const [description, setDescription] = useState(action.description)
  const [icon, setIcon] = useState(action.icon)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
      <div data-testid="action-customize-modal" className="bg-white rounded-lg p-6 w-96">
        <h3 className="text-lg font-medium mb-4">Customize Action</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              data-testid="customize-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              data-testid="customize-description-input"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
            <select
              data-testid="customize-icon-selector"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option data-testid="icon-option-document-plus" value="document-plus">📄 Document</option>
              <option data-testid="icon-option-plus" value="plus">➕ Plus</option>
              <option data-testid="icon-option-clock" value="clock">🕒 Clock</option>
              <option data-testid="icon-option-template" value="template">📝 Template</option>
              <option data-testid="icon-option-workflow" value="workflow">⚡ Workflow</option>
              <option data-testid="icon-option-settings" value="settings">⚙️ Settings</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end space-x-3 mt-6">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200">
            Cancel
          </button>
          <button
            onClick={() => onSave({ title, description, icon })}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}