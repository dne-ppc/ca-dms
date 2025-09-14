import Quill from 'quill';
import './DraggablePlaceholderBlot.css';

// Safe import Block to avoid module-level execution issues
let Block: any;
try {
  Block = Quill.import('blots/block');
} catch (error) {
  console.warn('Quill block import failed, using fallback', error);
  Block = class extends HTMLElement {}; // Fallback class
}

export interface PlaceholderConfig {
  id: string;
  type: string;
  label: string;
  isDraggable: boolean;
  isResizable: boolean;
  validation?: {
    required: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    errorMessage?: string;
  };
  preset?: string;
  customStyles?: Record<string, string>;
}

export abstract class DraggablePlaceholderBlot extends Block {
  static className = 'ql-draggable-placeholder';
  
  protected config: PlaceholderConfig;
  protected dragHandle: HTMLElement | null = null;
  protected resizeHandle: HTMLElement | null = null;
  protected isDragging = false;
  protected isResizing = false;
  
  constructor(scroll: unknown, domNode: HTMLElement) {
    super(scroll, domNode);
    this.setupDragAndDrop();
    this.setupResize();
    this.setupValidation();
  }

  static create(config: PlaceholderConfig): HTMLElement {
    const node = super.create() as HTMLElement;
    node.classList.add(this.className);
    node.setAttribute('data-placeholder-id', config.id);
    node.setAttribute('data-placeholder-type', config.type);
    node.setAttribute('draggable', config.isDraggable ? 'true' : 'false');
    
    // Add placeholder wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'placeholder-wrapper';
    
    // Add drag handle if draggable
    if (config.isDraggable) {
      const dragHandle = document.createElement('div');
      dragHandle.className = 'placeholder-drag-handle';
      dragHandle.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M3 2h2v2H3V2zm4 0h2v2H7V2zm4 0h2v2h-2V2zM3 6h2v2H3V6zm4 0h2v2H7V6zm4 0h2v2h-2V6zM3 10h2v2H3v-2zm4 0h2v2H7v-2zm4 0h2v2h-2v-2z"/>
        </svg>
      `;
      dragHandle.title = 'Drag to move placeholder';
      wrapper.appendChild(dragHandle);
    }
    
    // Add resize handle if resizable
    if (config.isResizable) {
      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'placeholder-resize-handle';
      resizeHandle.innerHTML = '↘';
      resizeHandle.title = 'Drag to resize placeholder';
      wrapper.appendChild(resizeHandle);
    }
    
    // Add configuration button
    const configButton = document.createElement('button');
    configButton.className = 'placeholder-config-button';
    configButton.innerHTML = '⚙';
    configButton.title = 'Configure placeholder';
    configButton.type = 'button';
    wrapper.appendChild(configButton);
    
    // Add delete button
    const deleteButton = document.createElement('button');
    deleteButton.className = 'placeholder-delete-button';
    deleteButton.innerHTML = '×';
    deleteButton.title = 'Delete placeholder';
    deleteButton.type = 'button';
    wrapper.appendChild(deleteButton);
    
    // Add content container
    const contentContainer = document.createElement('div');
    contentContainer.className = 'placeholder-content';
    wrapper.appendChild(contentContainer);
    
    node.appendChild(wrapper);
    
    return node;
  }

  private setupDragAndDrop(): void {
    if (!this.config?.isDraggable) return;
    
    this.dragHandle = this.domNode.querySelector('.placeholder-drag-handle');
    
    if (this.dragHandle) {
      this.dragHandle.addEventListener('mousedown', this.handleDragStart.bind(this));
      this.dragHandle.addEventListener('dragstart', this.handleDragStart.bind(this));
    }
    
    // Setup drop zone listeners on the editor
    const editor = this.domNode.closest('.ql-editor');
    if (editor) {
      editor.addEventListener('dragover', this.handleDragOver.bind(this));
      editor.addEventListener('drop', this.handleDrop.bind(this));
    }
    
    // Delete button functionality
    const deleteButton = this.domNode.querySelector('.placeholder-delete-button');
    deleteButton?.addEventListener('click', this.handleDelete.bind(this));
    
    // Config button functionality
    const configButton = this.domNode.querySelector('.placeholder-config-button');
    configButton?.addEventListener('click', this.handleConfig.bind(this));
  }

  private setupResize(): void {
    if (!this.config?.isResizable) return;
    
    this.resizeHandle = this.domNode.querySelector('.placeholder-resize-handle');
    
    if (this.resizeHandle) {
      this.resizeHandle.addEventListener('mousedown', this.handleResizeStart.bind(this));
    }
  }

  private setupValidation(): void {
    if (!this.config?.validation) return;
    
    // Add validation indicator
    const validationIndicator = document.createElement('div');
    validationIndicator.className = 'placeholder-validation-indicator';
    
    if (this.config.validation.required) {
      validationIndicator.classList.add('required');
      validationIndicator.title = 'This field is required';
    }
    
    const wrapper = this.domNode.querySelector('.placeholder-wrapper');
    wrapper?.appendChild(validationIndicator);
    
    // Add validation styling
    if (this.config.validation.required) {
      this.domNode.classList.add('required-placeholder');
    }
  }

  private handleDragStart(e: DragEvent | MouseEvent): void {
    e.preventDefault();
    this.isDragging = true;
    this.domNode.classList.add('dragging');
    
    // Create ghost image for drag preview
    const ghostImage = this.domNode.cloneNode(true) as HTMLElement;
    ghostImage.classList.add('drag-preview');
    ghostImage.style.opacity = '0.7';
    ghostImage.style.transform = 'rotate(5deg)';
    
    if (e instanceof DragEvent && e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', this.config.id);
      e.dataTransfer.setDragImage(ghostImage, 50, 25);
    }
    
    // Emit custom event for editor to handle
    const customEvent = new CustomEvent('placeholderDragStart', {
      detail: { placeholderId: this.config.id, type: this.config.type }
    });
    this.domNode.dispatchEvent(customEvent);
  }

  private handleDragOver(e: DragEvent): void {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    
    // Add visual feedback for drop zones
    const target = e.target as HTMLElement;
    if (target && target !== this.domNode) {
      const rect = target.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      
      if (e.clientY < midY) {
        target.classList.add('drop-target-above');
        target.classList.remove('drop-target-below');
      } else {
        target.classList.add('drop-target-below');
        target.classList.remove('drop-target-above');
      }
    }
  }

  private handleDrop(e: DragEvent): void {
    e.preventDefault();
    
    const draggedId = e.dataTransfer?.getData('text/plain');
    if (draggedId !== this.config.id) return;
    
    this.isDragging = false;
    this.domNode.classList.remove('dragging');
    
    // Remove all drop target indicators
    const allElements = document.querySelectorAll('.drop-target-above, .drop-target-below');
    allElements.forEach(el => {
      el.classList.remove('drop-target-above', 'drop-target-below');
    });
    
    // Emit custom event for editor to handle repositioning
    const customEvent = new CustomEvent('placeholderDrop', {
      detail: { 
        placeholderId: this.config.id,
        targetElement: e.target,
        position: this.getDropPosition(e)
      }
    });
    this.domNode.dispatchEvent(customEvent);
  }

  private handleResizeStart(e: MouseEvent): void {
    e.preventDefault();
    this.isResizing = true;
    this.domNode.classList.add('resizing');
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = this.domNode.offsetWidth;
    const startHeight = this.domNode.offsetHeight;
    
    const handleResize = (e: MouseEvent) => {
      const newWidth = Math.max(200, startWidth + (e.clientX - startX));
      const newHeight = Math.max(50, startHeight + (e.clientY - startY));
      
      this.domNode.style.width = `${newWidth}px`;
      this.domNode.style.height = `${newHeight}px`;
      
      // Emit resize event
      const customEvent = new CustomEvent('placeholderResize', {
        detail: { 
          placeholderId: this.config.id,
          width: newWidth,
          height: newHeight
        }
      });
      this.domNode.dispatchEvent(customEvent);
    };
    
    const handleResizeEnd = () => {
      this.isResizing = false;
      this.domNode.classList.remove('resizing');
      document.removeEventListener('mousemove', handleResize);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
    
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', handleResizeEnd);
  }

  private handleDelete(): void {
    if (confirm('Are you sure you want to delete this placeholder?')) {
      // Emit delete event
      const customEvent = new CustomEvent('placeholderDelete', {
        detail: { placeholderId: this.config.id }
      });
      this.domNode.dispatchEvent(customEvent);
      
      // Remove from DOM
      this.remove();
    }
  }

  private handleConfig(): void {
    // Emit config event for the editor to handle
    const customEvent = new CustomEvent('placeholderConfig', {
      detail: { 
        placeholderId: this.config.id,
        currentConfig: this.config
      }
    });
    this.domNode.dispatchEvent(customEvent);
  }

  private getDropPosition(e: DragEvent): 'before' | 'after' {
    const target = e.target as HTMLElement;
    const rect = target.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    return e.clientY < midY ? 'before' : 'after';
  }

  // Validation methods
  protected validateContent(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!this.config.validation) {
      return { isValid: true, errors: [] };
    }
    
    const content = this.getContentValue();
    const validation = this.config.validation;
    
    // Required validation
    if (validation.required && (!content || content.trim() === '')) {
      errors.push(validation.errorMessage || 'This field is required');
    }
    
    // Length validations
    if (content && validation.minLength && content.length < validation.minLength) {
      errors.push(`Minimum length is ${validation.minLength} characters`);
    }
    
    if (content && validation.maxLength && content.length > validation.maxLength) {
      errors.push(`Maximum length is ${validation.maxLength} characters`);
    }
    
    // Pattern validation
    if (content && validation.pattern) {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(content)) {
        errors.push(validation.errorMessage || 'Content does not match required pattern');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  protected updateValidationDisplay(): void {
    const validation = this.validateContent();
    const indicator = this.domNode.querySelector('.placeholder-validation-indicator');
    
    if (indicator) {
      indicator.classList.toggle('invalid', !validation.isValid);
      indicator.title = validation.isValid ? 'Valid' : validation.errors.join(', ');
    }
    
    this.domNode.classList.toggle('invalid-placeholder', !validation.isValid);
  }

  // Abstract methods to be implemented by subclasses
  protected abstract getContentValue(): string;
  public abstract updateConfig(newConfig: Partial<PlaceholderConfig>): void;

  // Override for proper Quill integration
  length(): number {
    return 1;
  }

  delta(): unknown {
    const Delta = Quill.import('delta');
    return new Delta().insert({ 
      [(this.constructor as typeof DraggablePlaceholderBlot).blotName]: {
        config: this.config,
        value: this.value()
      }
    });
  }

  abstract value(): any;
}