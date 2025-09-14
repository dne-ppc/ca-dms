import React, { useState, useEffect } from 'react';
import { X, Settings, Save, RotateCcw, Download, Upload } from 'lucide-react';
import { PlaceholderTemplateManager } from './PlaceholderTemplates';
import type { PlaceholderTemplate } from './PlaceholderTemplates';
import type { PlaceholderConfig } from './blots/DraggablePlaceholderBlot';
import type { SignatureConfig } from './blots/EnhancedSignatureBlot';

interface PlaceholderConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  placeholderId?: string;
  currentConfig?: PlaceholderConfig;
  onConfigUpdate: (config: PlaceholderConfig) => void;
  onTemplateSelect: (template: PlaceholderTemplate) => void;
}


export const PlaceholderConfigPanel: React.FC<PlaceholderConfigPanelProps> = ({
  isOpen,
  onClose,
  placeholderId,
  currentConfig,
  onConfigUpdate,
  onTemplateSelect
}) => {
  const [activeTab, setActiveTab] = useState<'templates' | 'config' | 'validation' | 'style'>('templates');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Configuration state
  const [config, setConfig] = useState<Partial<PlaceholderConfig>>({
    id: '',
    type: 'enhanced-signature',
    label: '',
    isDraggable: true,
    isResizable: false,
    validation: {
      required: false
    }
  });

  // Template state
  const [templates, setTemplates] = useState<PlaceholderTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<PlaceholderTemplate[]>([]);
  const [categories, setCategories] = useState<Array<{id: string, name: string, count: number, icon: string}>>([]);

  // Load data on component mount
  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      loadCategories();
      if (currentConfig) {
        setConfig(currentConfig);
      }
    }
  }, [isOpen, currentConfig]);

  // Filter templates based on search and category
  useEffect(() => {
    let filtered = templates;

    if (searchQuery) {
      filtered = PlaceholderTemplateManager.searchTemplates(searchQuery);
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(template => template.category === selectedCategory);
    }

    setFilteredTemplates(filtered);
  }, [templates, searchQuery, selectedCategory]);

  const loadTemplates = () => {
    const allTemplates = PlaceholderTemplateManager.getAllTemplates();
    setTemplates(allTemplates);
  };

  const loadCategories = () => {
    const templateCategories = PlaceholderTemplateManager.getTemplateCategories();
    setCategories([
      { id: 'all', name: 'All Templates', count: templates.length, icon: '📄' },
      ...templateCategories
    ]);
  };

  const handleTemplateSelect = (template: PlaceholderTemplate) => {
    const newConfig: PlaceholderConfig = {
      id: placeholderId || `${template.id}-${Date.now()}`,
      ...template.config,
      type: template.config.type || 'enhanced-signature'
    } as PlaceholderConfig;

    setConfig(newConfig);
    onTemplateSelect(template);
    
    // Increment popularity
    PlaceholderTemplateManager.incrementPopularity(template.id);
  };

  const handleConfigChange = (key: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleValidationChange = (rule: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      validation: {
        ...prev.validation,
        [rule]: value
      }
    }));
  };

  const handleStyleChange = (style: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      customStyles: {
        ...prev.customStyles,
        [style]: value
      }
    }));
  };

  const handleSaveConfig = () => {
    if (config.id && config.type && config.label) {
      onConfigUpdate(config as PlaceholderConfig);
      onClose();
    }
  };

  const handleResetConfig = () => {
    if (currentConfig) {
      setConfig(currentConfig);
    } else {
      setConfig({
        id: '',
        type: 'enhanced-signature',
        label: '',
        isDraggable: true,
        isResizable: false,
        validation: { required: false }
      });
    }
  };

  const exportConfig = () => {
    const configData = {
      version: '1.0',
      exported: new Date().toISOString(),
      config: config
    };

    const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `placeholder-config-${config.label || 'untitled'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.config) {
          setConfig(data.config);
        }
      } catch (error) {
        console.error('Failed to import configuration:', error);
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Placeholder Configuration
            </h2>
            {placeholderId && (
              <span className="text-sm text-gray-500">({placeholderId})</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportConfig}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Export Configuration"
            >
              <Download className="h-4 w-4" />
            </button>
            <label className="p-2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer" title="Import Configuration">
              <Upload className="h-4 w-4" />
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={importConfig}
              />
            </label>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b bg-gray-50">
          <nav className="flex px-6">
            {[
              { id: 'templates', label: 'Templates', icon: '📝' },
              { id: 'config', label: 'Configuration', icon: '⚙️' },
              { id: 'validation', label: 'Validation', icon: '✅' },
              { id: 'style', label: 'Styling', icon: '🎨' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'templates' && (
            <div className="space-y-4">
              {/* Search and Filter */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search templates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.icon} {category.name} ({category.count})
                    </option>
                  ))}
                </select>
              </div>

              {/* Template Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{template.icon}</span>
                        <h3 className="font-medium text-gray-900">{template.name}</h3>
                      </div>
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {template.popularity}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                    <p className="text-xs text-gray-500 mb-2">{template.preview}</p>
                    <div className="flex flex-wrap gap-1">
                      {template.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {filteredTemplates.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>No templates found matching your criteria.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'config' && (
            <div className="space-y-6">
              {/* Basic Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Label
                  </label>
                  <input
                    type="text"
                    value={config.label || ''}
                    onChange={(e) => handleConfigChange('label', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter placeholder label"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <select
                    value={config.type || ''}
                    onChange={(e) => handleConfigChange('type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="enhanced-signature">Enhanced Signature</option>
                    <option value="enhanced-response">Enhanced Response</option>
                    <option value="enhanced-line">Enhanced Line</option>
                    <option value="enhanced-date">Enhanced Date</option>
                    <option value="enhanced-checkbox">Enhanced Checkbox</option>
                    <option value="enhanced-select">Enhanced Select</option>
                  </select>
                </div>
              </div>

              {/* Behavior Options */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Behavior</h3>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.isDraggable || false}
                      onChange={(e) => handleConfigChange('isDraggable', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Draggable</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.isResizable || false}
                      onChange={(e) => handleConfigChange('isResizable', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Resizable</span>
                  </label>
                </div>
              </div>

              {/* Type-Specific Configuration */}
              {config.type === 'enhanced-signature' && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Signature Options</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Signature Style
                      </label>
                      <select
                        value={(config as SignatureConfig).signatureStyle || 'line'}
                        onChange={(e) => handleConfigChange('signatureStyle', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="line">Line</option>
                        <option value="box">Box (Canvas)</option>
                        <option value="image">Image Upload</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Preset
                      </label>
                      <select
                        value={(config as SignatureConfig).preset || 'standard'}
                        onChange={(e) => handleConfigChange('preset', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="standard">Standard</option>
                        <option value="executive">Executive</option>
                        <option value="witness">Witness</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={(config as SignatureConfig).includeName !== false}
                        onChange={(e) => handleConfigChange('includeName', e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Include Name Field</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={(config as SignatureConfig).includeDate !== false}
                        onChange={(e) => handleConfigChange('includeDate', e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Include Date Field</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={(config as SignatureConfig).includeTitle !== false}
                        onChange={(e) => handleConfigChange('includeTitle', e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Include Title Field</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'validation' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Validation Rules</h3>
                <div className="space-y-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.validation?.required || false}
                      onChange={(e) => handleValidationChange('required', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Required Field</span>
                  </label>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Minimum Length
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={config.validation?.minLength || ''}
                        onChange={(e) => handleValidationChange('minLength', parseInt(e.target.value) || undefined)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="No minimum"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Maximum Length
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={config.validation?.maxLength || ''}
                        onChange={(e) => handleValidationChange('maxLength', parseInt(e.target.value) || undefined)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="No maximum"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pattern (Regular Expression)
                    </label>
                    <input
                      type="text"
                      value={config.validation?.pattern || ''}
                      onChange={(e) => handleValidationChange('pattern', e.target.value || undefined)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., ^[A-Za-z\s]+$"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Error Message
                    </label>
                    <input
                      type="text"
                      value={config.validation?.errorMessage || ''}
                      onChange={(e) => handleValidationChange('errorMessage', e.target.value || undefined)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Custom error message"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'style' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Custom Styles</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Background Color
                    </label>
                    <input
                      type="color"
                      value={config.customStyles?.background || '#f9fafb'}
                      onChange={(e) => handleStyleChange('background', e.target.value)}
                      className="w-full h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Border Color
                    </label>
                    <input
                      type="color"
                      value={config.customStyles?.borderColor || '#d1d5db'}
                      onChange={(e) => handleStyleChange('borderColor', e.target.value)}
                      className="w-full h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Padding
                    </label>
                    <input
                      type="text"
                      value={config.customStyles?.padding || ''}
                      onChange={(e) => handleStyleChange('padding', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 16px"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Border Radius
                    </label>
                    <input
                      type="text"
                      value={config.customStyles?.borderRadius || ''}
                      onChange={(e) => handleStyleChange('borderRadius', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 8px"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Custom CSS
                  </label>
                  <textarea
                    rows={4}
                    value={JSON.stringify(config.customStyles || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const styles = JSON.parse(e.target.value);
                        handleConfigChange('customStyles', styles);
                      } catch (error) {
                        // Invalid JSON, ignore for now
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="Custom CSS properties as JSON"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetConfig}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveConfig}
              disabled={!config.id || !config.type || !config.label}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};