import React, { useEffect, useRef, useState } from 'react';
import Quill from 'quill';
import { Plus, Settings, Download, Upload, Save } from 'lucide-react';

// Import custom blots
import { DraggablePlaceholderBlot } from './blots/DraggablePlaceholderBlot';
import type { PlaceholderConfig } from './blots/DraggablePlaceholderBlot';
import { EnhancedSignatureBlot } from './blots/EnhancedSignatureBlot';
import { EnhancedResponseBlot } from './blots/EnhancedResponseBlot';
import { EnhancedLineBlot } from './blots/EnhancedLineBlot';

// Import components
import { PlaceholderConfigPanel } from './PlaceholderConfigPanel';
import { PlaceholderTemplateManager } from './PlaceholderTemplates';
import type { PlaceholderTemplate } from './PlaceholderTemplates';

// Import styles
import 'quill/dist/quill.snow.css';
import './EnhancedQuillEditor.css';

interface EnhancedQuillEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  onPlaceholderChange?: (placeholders: PlaceholderData[]) => void;
  onEditorReady?: (editor: any) => void;
  height?: string;
  readOnly?: boolean;
  theme?: 'snow' | 'bubble';
  placeholder?: string;
}

export interface PlaceholderData {
  id: string;
  type: string;
  config: PlaceholderConfig;
  value: any;
  position: number;
}

export const EnhancedQuillEditor: React.FC<EnhancedQuillEditorProps> = ({
  value = '',
  onChange,
  onPlaceholderChange,
  onEditorReady,
  height = '400px',
  readOnly = false,
  theme = 'snow',
  placeholder = 'Start writing...'
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);
  const [selectedPlaceholderId, setSelectedPlaceholderId] = useState<string>();
  const [currentConfig, setCurrentConfig] = useState<PlaceholderConfig>();
  const [placeholders, setPlaceholders] = useState<PlaceholderData[]>([]);

  // Register custom blots
  useEffect(() => {
    Quill.register(EnhancedSignatureBlot);
    Quill.register(EnhancedResponseBlot);
    Quill.register(EnhancedLineBlot);
  }, []);

  // Initialize Quill editor
  useEffect(() => {
    if (!editorRef.current) return;

    const quill = new Quill(editorRef.current, {
      theme,
      readOnly,
      placeholder,
      modules: {
        toolbar: false, // Disable Quill's built-in toolbar since we use our own EnhancedToolbar
        history: {
          delay: 2000,
          maxStack: 500,
          userOnly: true
        }
      },
      formats: [
        'header', 'bold', 'italic', 'underline', 'strike',
        'color', 'background', 'align', 'list', 'blockquote',
        'code-block', 'link', 'image',
        'enhanced-signature', 'enhanced-response', 'enhanced-line'
      ]
    });

    quillRef.current = quill;

    // Set initial content
    if (value) {
      quill.setContents(JSON.parse(value));
    }

    // Setup event listeners
    setupEventListeners(quill);

    // Notify parent component that editor is ready
    if (onEditorReady) {
      onEditorReady(quill);
    }

    return () => {
      if (quillRef.current) {
        quillRef.current = null;
      }
    };
  }, [onEditorReady]);

  // Update content when value prop changes
  useEffect(() => {
    if (quillRef.current && value) {
      const currentContents = quillRef.current.getContents();
      const newContents = JSON.parse(value);
      
      if (JSON.stringify(currentContents) !== JSON.stringify(newContents)) {
        quillRef.current.setContents(newContents);
      }
    }
  }, [value]);

  const setupCustomToolbar = (quill: Quill) => {
    const toolbar = quill.getModule('toolbar');
    const placeholderButton = document.querySelector('.ql-placeholder-menu');
    
    if (placeholderButton) {
      placeholderButton.innerHTML = '<span class="placeholder-icon">🧩</span>';
      placeholderButton.setAttribute('title', 'Add Placeholder');
      
      placeholderButton.addEventListener('click', () => {
        showPlaceholderMenu(quill);
      });
    }
  };

  const showPlaceholderMenu = (quill: Quill) => {
    const range = quill.getSelection();
    if (!range) return;

    // Create placeholder menu
    const menu = document.createElement('div');
    menu.className = 'placeholder-menu';
    
    const popularTemplates = PlaceholderTemplateManager.getPopularTemplates(8);
    
    menu.innerHTML = `
      <div class="placeholder-menu-header">
        <h3>Add Placeholder</h3>
        <button class="close-menu">×</button>
      </div>
      <div class="placeholder-menu-content">
        <div class="template-grid">
          ${popularTemplates.map(template => `
            <div class="template-item" data-template-id="${template.id}">
              <span class="template-icon">${template.icon}</span>
              <span class="template-name">${template.name}</span>
            </div>
          `).join('')}
        </div>
        <div class="menu-actions">
          <button class="custom-placeholder-btn">
            <span>⚙️</span> Custom Placeholder
          </button>
        </div>
      </div>
    `;

    // Position menu
    const selection = window.getSelection();
    const rect = selection?.getRangeAt(0).getBoundingClientRect();
    if (rect) {
      menu.style.position = 'absolute';
      menu.style.top = `${rect.bottom + window.scrollY}px`;
      menu.style.left = `${rect.left + window.scrollX}px`;
      menu.style.zIndex = '1000';
    }

    document.body.appendChild(menu);

    // Handle template selection
    menu.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const templateItem = target.closest('.template-item');
      const customBtn = target.closest('.custom-placeholder-btn');
      const closeBtn = target.closest('.close-menu');

      if (templateItem) {
        const templateId = templateItem.getAttribute('data-template-id');
        if (templateId) {
          const template = PlaceholderTemplateManager.getTemplateById(templateId);
          if (template) {
            insertPlaceholder(quill, range.index, template);
          }
        }
        document.body.removeChild(menu);
      } else if (customBtn) {
        document.body.removeChild(menu);
        openConfigPanel();
      } else if (closeBtn) {
        document.body.removeChild(menu);
      }
    });

    // Close menu when clicking outside
    const closeMenu = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        if (document.body.contains(menu)) {
          document.body.removeChild(menu);
        }
        document.removeEventListener('click', closeMenu);
      }
    };

    setTimeout(() => {
      document.addEventListener('click', closeMenu);
    }, 100);
  };

  const insertPlaceholder = (quill: Quill, index: number, template: PlaceholderTemplate) => {
    const placeholderConfig: PlaceholderConfig = {
      id: `${template.id}-${Date.now()}`,
      ...template.config,
      type: template.config.type || 'enhanced-signature'
    } as PlaceholderConfig;

    // Insert the placeholder
    quill.insertEmbed(index, placeholderConfig.type, placeholderConfig);
    
    // Move cursor after placeholder
    quill.setSelection(index + 1);
    
    // Track the placeholder
    const placeholderData: PlaceholderData = {
      id: placeholderConfig.id,
      type: placeholderConfig.type,
      config: placeholderConfig,
      value: null,
      position: index
    };

    const newPlaceholders = [...placeholders, placeholderData];
    setPlaceholders(newPlaceholders);
    onPlaceholderChange?.(newPlaceholders);

    // Increment template popularity
    PlaceholderTemplateManager.incrementPopularity(template.id);
  };

  const setupEventListeners = (quill: Quill) => {
    // Handle text changes
    quill.on('text-change', (delta, oldDelta, source) => {
      if (source === 'user') {
        const contents = quill.getContents();
        onChange?.(JSON.stringify(contents));
      }
    });

    // Handle placeholder events
    const editor = quill.root;
    
    editor.addEventListener('placeholderConfig', (e: CustomEvent) => {
      const { placeholderId, currentConfig } = e.detail;
      setSelectedPlaceholderId(placeholderId);
      setCurrentConfig(currentConfig);
      setIsConfigPanelOpen(true);
    });

    editor.addEventListener('placeholderDelete', (e: CustomEvent) => {
      const { placeholderId } = e.detail;
      const newPlaceholders = placeholders.filter(p => p.id !== placeholderId);
      setPlaceholders(newPlaceholders);
      onPlaceholderChange?.(newPlaceholders);
    });

    editor.addEventListener('placeholderDragStart', (e: CustomEvent) => {
      // Handle drag start if needed
    });

    editor.addEventListener('placeholderDrop', (e: CustomEvent) => {
      // Handle drop repositioning if needed
    });

    editor.addEventListener('input', (e: Event) => {
      // Update placeholder values when they change
      updatePlaceholderValues();
    });
  };

  const updatePlaceholderValues = () => {
    if (!quillRef.current) return;

    const updatedPlaceholders = placeholders.map(placeholder => {
      const element = document.querySelector(`[data-placeholder-id="${placeholder.id}"]`);
      if (element) {
        const blotName = placeholder.type;
        const BlotClass = Quill.import(blotName);
        if (BlotClass && BlotClass.value) {
          const newValue = BlotClass.value(element);
          return {
            ...placeholder,
            value: newValue
          };
        }
      }
      return placeholder;
    });

    setPlaceholders(updatedPlaceholders);
    onPlaceholderChange?.(updatedPlaceholders);
  };

  const openConfigPanel = () => {
    setSelectedPlaceholderId(undefined);
    setCurrentConfig(undefined);
    setIsConfigPanelOpen(true);
  };

  const handleConfigUpdate = (config: PlaceholderConfig) => {
    if (selectedPlaceholderId) {
      // Update existing placeholder
      const element = document.querySelector(`[data-placeholder-id="${selectedPlaceholderId}"]`);
      if (element) {
        const blot = Quill.find(element);
        if (blot && typeof blot.updateConfig === 'function') {
          blot.updateConfig(config);
        }
      }
    } else {
      // Create new placeholder
      const range = quillRef.current?.getSelection();
      if (range && quillRef.current) {
        insertPlaceholder(quillRef.current, range.index, {
          id: config.id,
          name: config.label,
          description: '',
          category: 'custom',
          icon: '⚙️',
          preview: '',
          config: config,
          tags: [],
          popularity: 1
        });
      }
    }
  };

  const handleTemplateSelect = (template: PlaceholderTemplate) => {
    const range = quillRef.current?.getSelection();
    if (range && quillRef.current) {
      insertPlaceholder(quillRef.current, range.index, template);
    }
  };

  const exportDocument = () => {
    if (!quillRef.current) return;

    const contents = quillRef.current.getContents();
    const documentData = {
      version: '1.0',
      exported: new Date().toISOString(),
      content: contents,
      placeholders: placeholders
    };

    const blob = new Blob([JSON.stringify(documentData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `document-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importDocument = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !quillRef.current) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.content) {
          quillRef.current?.setContents(data.content);
          if (data.placeholders) {
            setPlaceholders(data.placeholders);
            onPlaceholderChange?.(data.placeholders);
          }
        }
      } catch (error) {
        console.error('Failed to import document:', error);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="enhanced-quill-editor">
      {/* Custom Toolbar Actions */}
      <div className="editor-actions">
        <div className="action-group">
          <button
            onClick={openConfigPanel}
            className="action-btn"
            title="Add Custom Placeholder"
          >
            <Plus className="h-4 w-4" />
            <span>Add Placeholder</span>
          </button>
          <button
            onClick={() => setIsConfigPanelOpen(true)}
            className="action-btn"
            title="Configure Placeholders"
          >
            <Settings className="h-4 w-4" />
            <span>Configure</span>
          </button>
        </div>

        <div className="action-group">
          <button
            onClick={exportDocument}
            className="action-btn"
            title="Export Document"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
          <label className="action-btn" title="Import Document">
            <Upload className="h-4 w-4" />
            <span>Import</span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={importDocument}
            />
          </label>
        </div>
      </div>

      {/* Quill Editor */}
      <div className="editor-container" style={{ height }}>
        <div ref={editorRef} className="quill-editor" />
      </div>

      {/* Placeholder Summary */}
      {placeholders.length > 0 && (
        <div className="placeholder-summary">
          <h4>Placeholders ({placeholders.length})</h4>
          <div className="placeholder-list">
            {placeholders.map((placeholder) => (
              <div key={placeholder.id} className="placeholder-item">
                <span className="placeholder-type">{placeholder.type}</span>
                <span className="placeholder-label">{placeholder.config.label}</span>
                <span className={`placeholder-status ${placeholder.value ? 'completed' : 'empty'}`}>
                  {placeholder.value ? '✓' : '○'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Configuration Panel */}
      <PlaceholderConfigPanel
        isOpen={isConfigPanelOpen}
        onClose={() => setIsConfigPanelOpen(false)}
        placeholderId={selectedPlaceholderId}
        currentConfig={currentConfig}
        onConfigUpdate={handleConfigUpdate}
        onTemplateSelect={handleTemplateSelect}
      />
    </div>
  );
};