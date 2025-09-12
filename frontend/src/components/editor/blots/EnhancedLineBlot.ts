import Quill from 'quill';
import { DraggablePlaceholderBlot, PlaceholderConfig } from './DraggablePlaceholderBlot';
import './EnhancedLineBlot.css';

export interface LineConfig extends PlaceholderConfig {
  length: 'short' | 'medium' | 'long' | 'custom';
  customLength?: number;
  lineStyle: 'solid' | 'dashed' | 'dotted' | 'double' | 'underline';
  placeholder?: string;
  allowMultiline: boolean;
  autoExpand: boolean;
}

export interface LineData {
  content: string;
  length: number;
}

export class EnhancedLineBlot extends DraggablePlaceholderBlot {
  static blotName = 'enhanced-line';
  static tagName = 'div';
  static className = 'ql-enhanced-line';

  private lineConfig: LineConfig;

  static create(config: LineConfig): HTMLElement {
    const node = super.create(config) as HTMLElement;
    node.classList.add(this.className);

    const instance = new this({} as any, node);
    instance.lineConfig = config;
    instance.renderLineContent();

    return node;
  }

  static getPresetConfig(preset: string): Partial<LineConfig> {
    const presets: Record<string, Partial<LineConfig>> = {
      short: {
        length: 'short',
        lineStyle: 'solid',
        allowMultiline: false,
        autoExpand: false,
        isDraggable: true,
        isResizable: true,
        validation: {
          required: false,
          maxLength: 20
        }
      },
      medium: {
        length: 'medium',
        lineStyle: 'solid',
        allowMultiline: false,
        autoExpand: false,
        isDraggable: true,
        isResizable: true,
        validation: {
          required: false,
          maxLength: 50
        }
      },
      long: {
        length: 'long',
        lineStyle: 'solid',
        allowMultiline: false,
        autoExpand: true,
        isDraggable: true,
        isResizable: true,
        validation: {
          required: false,
          maxLength: 100
        }
      },
      signature: {
        length: 'long',
        lineStyle: 'solid',
        allowMultiline: false,
        autoExpand: false,
        isDraggable: true,
        isResizable: true,
        placeholder: 'Signature',
        validation: {
          required: true,
          errorMessage: 'Signature is required'
        }
      },
      date: {
        length: 'medium',
        lineStyle: 'solid',
        allowMultiline: false,
        autoExpand: false,
        isDraggable: true,
        isResizable: false,
        placeholder: 'Date',
        validation: {
          required: false,
          pattern: '^\\d{1,2}/\\d{1,2}/\\d{4}$',
          errorMessage: 'Please enter a valid date (MM/DD/YYYY)'
        }
      },
      name: {
        length: 'medium',
        lineStyle: 'solid',
        allowMultiline: false,
        autoExpand: false,
        isDraggable: true,
        isResizable: true,
        placeholder: 'Full Name',
        validation: {
          required: false,
          minLength: 2,
          maxLength: 50
        }
      }
    };

    return presets[preset] || presets.medium;
  }

  private renderLineContent(): void {
    const contentContainer = this.domNode.querySelector('.placeholder-content') as HTMLElement;
    if (!contentContainer) return;

    contentContainer.innerHTML = '';
    contentContainer.className = 'placeholder-content line-content';

    // Apply custom styles if defined
    if (this.lineConfig.customStyles) {
      Object.entries(this.lineConfig.customStyles).forEach(([key, value]) => {
        (contentContainer.style as any)[key] = value;
      });
    }

    // Add line label if provided
    if (this.lineConfig.label) {
      const label = document.createElement('div');
      label.className = 'line-label';
      label.textContent = this.lineConfig.label;
      contentContainer.appendChild(label);
    }

    // Create line area
    this.createLineArea(contentContainer);

    // Add preset indicator
    if (this.lineConfig.preset && this.lineConfig.preset !== 'custom') {
      const presetBadge = document.createElement('div');
      presetBadge.className = 'line-preset-badge';
      presetBadge.textContent = this.lineConfig.preset.toUpperCase();
      contentContainer.appendChild(presetBadge);
    }
  }

  private createLineArea(container: HTMLElement): void {
    const lineArea = document.createElement('div');
    lineArea.className = `line-area line-${this.lineConfig.length} line-style-${this.lineConfig.lineStyle}`;

    // Calculate line width
    const lineWidth = this.calculateLineWidth();
    if (lineWidth) {
      lineArea.style.width = lineWidth;
    }

    if (this.lineConfig.allowMultiline) {
      // Create textarea for multi-line input
      const textarea = document.createElement('textarea');
      textarea.setAttribute('data-field', 'content');
      textarea.className = 'line-input multiline';
      textarea.placeholder = this.lineConfig.placeholder || 'Enter text...';
      textarea.rows = 3;

      this.setupInputHandlers(textarea);
      lineArea.appendChild(textarea);
    } else {
      // Create single-line input
      const input = document.createElement('input');
      input.type = 'text';
      input.setAttribute('data-field', 'content');
      input.className = 'line-input single-line';
      input.placeholder = this.lineConfig.placeholder || 'Fill in the line...';

      this.setupInputHandlers(input);
      lineArea.appendChild(input);
    }

    // Add visual line element
    const visualLine = document.createElement('div');
    visualLine.className = 'visual-line';
    lineArea.appendChild(visualLine);

    container.appendChild(lineArea);
  }

  private calculateLineWidth(): string | null {
    switch (this.lineConfig.length) {
      case 'short':
        return '120px';
      case 'medium':
        return '200px';
      case 'long':
        return '300px';
      case 'custom':
        return this.lineConfig.customLength ? `${this.lineConfig.customLength}px` : null;
      default:
        return null;
    }
  }

  private setupInputHandlers(input: HTMLInputElement | HTMLTextAreaElement): void {
    // Apply validation attributes
    if (this.lineConfig.validation?.required) {
      input.required = true;
    }

    if (this.lineConfig.validation?.maxLength) {
      if (input instanceof HTMLInputElement) {
        input.maxLength = this.lineConfig.validation.maxLength;
      } else {
        (input as HTMLTextAreaElement).maxLength = this.lineConfig.validation.maxLength;
      }
    }

    // Auto-expand functionality for single-line inputs
    if (this.lineConfig.autoExpand && input instanceof HTMLInputElement) {
      input.addEventListener('input', () => {
        this.adjustInputWidth(input);
      });

      // Set initial width
      this.adjustInputWidth(input);
    }

    // Add event listeners
    input.addEventListener('input', () => {
      this.updateValidationDisplay();
      this.notifyChange();
    });

    input.addEventListener('blur', () => {
      this.validateField(input);
    });

    input.addEventListener('focus', () => {
      input.parentElement?.classList.add('focused');
    });

    input.addEventListener('blur', () => {
      input.parentElement?.classList.remove('focused');
    });

    // Pattern-specific input handling
    if (this.lineConfig.preset === 'date') {
      this.setupDateInput(input as HTMLInputElement);
    }
  }

  private adjustInputWidth(input: HTMLInputElement): void {
    // Create temporary element to measure text width
    const temp = document.createElement('span');
    temp.style.visibility = 'hidden';
    temp.style.position = 'absolute';
    temp.style.whiteSpace = 'nowrap';
    temp.style.font = getComputedStyle(input).font;
    temp.textContent = input.value || input.placeholder;

    document.body.appendChild(temp);
    const textWidth = temp.offsetWidth;
    document.body.removeChild(temp);

    // Set minimum width based on line length
    const minWidth = parseInt(this.calculateLineWidth() || '120px');
    const newWidth = Math.max(minWidth, textWidth + 20);

    input.style.width = `${newWidth}px`;

    // Update visual line width
    const visualLine = input.parentElement?.querySelector('.visual-line') as HTMLElement;
    if (visualLine) {
      visualLine.style.width = `${newWidth}px`;
    }
  }

  private setupDateInput(input: HTMLInputElement): void {
    // Add date formatting on input
    input.addEventListener('input', (e) => {
      let value = input.value.replace(/\D/g, ''); // Remove non-digits
      
      if (value.length >= 2) {
        value = value.substring(0, 2) + '/' + value.substring(2);
      }
      if (value.length >= 5) {
        value = value.substring(0, 5) + '/' + value.substring(5, 9);
      }
      
      input.value = value;
    });

    // Validate date format
    input.addEventListener('blur', () => {
      const value = input.value;
      if (value && !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
        input.classList.add('field-invalid');
        this.showFieldError(input, 'Please enter a valid date (MM/DD/YYYY)');
      }
    });
  }

  private validateField(input: HTMLInputElement | HTMLTextAreaElement): void {
    const value = input.value.trim();

    // Remove existing validation classes
    input.classList.remove('field-valid', 'field-invalid');

    const validation = this.lineConfig.validation;
    if (!validation) return;

    let isValid = true;
    let errorMessage = '';

    // Required validation
    if (validation.required && !value) {
      isValid = false;
      errorMessage = validation.errorMessage || 'This field is required';
    }

    // Length validations
    if (value && validation.minLength && value.length < validation.minLength) {
      isValid = false;
      errorMessage = `Minimum length is ${validation.minLength} characters`;
    }

    if (value && validation.maxLength && value.length > validation.maxLength) {
      isValid = false;
      errorMessage = `Maximum length is ${validation.maxLength} characters`;
    }

    // Pattern validation
    if (value && validation.pattern) {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        isValid = false;
        errorMessage = validation.errorMessage || 'Invalid format';
      }
    }

    // Apply validation styling
    input.classList.add(isValid ? 'field-valid' : 'field-invalid');

    if (!isValid) {
      this.showFieldError(input, errorMessage);
    } else {
      this.hideFieldError(input);
    }
  }

  private showFieldError(input: HTMLElement, message: string): void {
    this.hideFieldError(input);

    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.textContent = message;
    input.parentNode?.appendChild(errorDiv);
  }

  private hideFieldError(input: HTMLElement): void {
    const existingError = input.parentNode?.querySelector('.field-error');
    if (existingError) {
      existingError.remove();
    }
  }

  private notifyChange(): void {
    const changeEvent = new Event('input', { bubbles: true });
    this.domNode.dispatchEvent(changeEvent);
  }

  protected getContentValue(): string {
    const input = this.domNode.querySelector('input[data-field="content"], textarea[data-field="content"]') as HTMLInputElement | HTMLTextAreaElement;
    return input?.value || '';
  }

  public updateConfig(newConfig: Partial<PlaceholderConfig>): void {
    this.lineConfig = { ...this.lineConfig, ...newConfig };
    this.renderLineContent();
  }

  value(): LineData {
    const content = this.getContentValue();

    return {
      content,
      length: content.length
    };
  }

  static value(node: HTMLElement): LineData {
    const input = node.querySelector('input[data-field="content"], textarea[data-field="content"]') as HTMLInputElement | HTMLTextAreaElement;
    const content = input?.value || '';

    return {
      content,
      length: content.length
    };
  }
}