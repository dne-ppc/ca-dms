import Quill from 'quill';
import { DraggablePlaceholderBlot } from './DraggablePlaceholderBlot';
import type { PlaceholderConfig } from './DraggablePlaceholderBlot';
import './EnhancedResponseBlot.css';

export interface ResponseConfig extends PlaceholderConfig {
  lines: number;
  placeholder?: string;
  allowRichText: boolean;
  autoResize: boolean;
}

export interface ResponseData {
  content: string;
  wordCount: number;
  characterCount: number;
}

export class EnhancedResponseBlot extends DraggablePlaceholderBlot {
  static blotName = 'enhanced-response';
  static tagName = 'div';
  static className = 'ql-enhanced-response';

  private responseConfig: ResponseConfig;

  static create(config: ResponseConfig): HTMLElement {
    const node = super.create(config) as HTMLElement;
    node.classList.add(this.className);

    const instance = new this({} as any, node);
    instance.responseConfig = config;
    instance.renderResponseContent();

    return node;
  }

  static getPresetConfig(preset: string): Partial<ResponseConfig> {
    const presets: Record<string, Partial<ResponseConfig>> = {
      short: {
        lines: 1,
        allowRichText: false,
        autoResize: false,
        isDraggable: true,
        isResizable: true,
        validation: {
          required: false,
          maxLength: 100
        }
      },
      paragraph: {
        lines: 5,
        allowRichText: true,
        autoResize: true,
        isDraggable: true,
        isResizable: true,
        validation: {
          required: false,
          minLength: 10,
          maxLength: 1000
        }
      },
      essay: {
        lines: 10,
        allowRichText: true,
        autoResize: true,
        isDraggable: true,
        isResizable: true,
        validation: {
          required: false,
          minLength: 50,
          maxLength: 5000
        }
      },
      comment: {
        lines: 3,
        allowRichText: false,
        autoResize: true,
        isDraggable: true,
        isResizable: true,
        validation: {
          required: false,
          maxLength: 500
        }
      }
    };

    return presets[preset] || presets.paragraph;
  }

  private renderResponseContent(): void {
    const contentContainer = this.domNode.querySelector('.placeholder-content') as HTMLElement;
    if (!contentContainer) return;

    contentContainer.innerHTML = '';
    contentContainer.className = 'placeholder-content response-content';

    // Apply custom styles if defined
    if (this.responseConfig.customStyles) {
      Object.entries(this.responseConfig.customStyles).forEach(([key, value]) => {
        (contentContainer.style as any)[key] = value;
      });
    }

    // Add response label
    const label = document.createElement('div');
    label.className = 'response-label';
    label.textContent = this.responseConfig.label || 'Response';
    contentContainer.appendChild(label);

    // Create response area
    this.createResponseArea(contentContainer);

    // Add word/character counter if enabled
    if (this.responseConfig.validation?.maxLength) {
      this.createCounter(contentContainer);
    }

    // Add preset indicator
    if (this.responseConfig.preset && this.responseConfig.preset !== 'custom') {
      const presetBadge = document.createElement('div');
      presetBadge.className = 'response-preset-badge';
      presetBadge.textContent = this.responseConfig.preset.toUpperCase();
      contentContainer.appendChild(presetBadge);
    }
  }

  private createResponseArea(container: HTMLElement): void {
    const responseArea = document.createElement('div');
    responseArea.className = 'response-area';

    if (this.responseConfig.allowRichText) {
      // Create rich text editor area
      const editorContainer = document.createElement('div');
      editorContainer.className = 'response-rich-editor';
      editorContainer.setAttribute('data-field', 'content');

      // Initialize mini Quill editor for rich text
      const toolbar = document.createElement('div');
      toolbar.className = 'response-toolbar';
      toolbar.innerHTML = `
        <button type="button" class="ql-bold" title="Bold"></button>
        <button type="button" class="ql-italic" title="Italic"></button>
        <button type="button" class="ql-underline" title="Underline"></button>
        <button type="button" class="ql-list" value="ordered" title="Numbered List"></button>
        <button type="button" class="ql-list" value="bullet" title="Bullet List"></button>
      `;

      const editorDiv = document.createElement('div');
      editorDiv.className = 'response-editor';
      editorDiv.style.minHeight = `${this.responseConfig.lines * 1.5}em`;

      editorContainer.appendChild(toolbar);
      editorContainer.appendChild(editorDiv);
      responseArea.appendChild(editorContainer);

      // Setup rich text editor
      this.setupRichTextEditor(editorDiv, toolbar);
    } else {
      // Create plain textarea
      const textarea = document.createElement('textarea');
      textarea.setAttribute('data-field', 'content');
      textarea.className = 'response-textarea';
      textarea.rows = this.responseConfig.lines;
      textarea.placeholder = this.responseConfig.placeholder || 'Enter your response...';

      // Apply validation attributes
      if (this.responseConfig.validation?.required) {
        textarea.required = true;
      }

      if (this.responseConfig.validation?.maxLength) {
        textarea.maxLength = this.responseConfig.validation.maxLength;
      }

      // Auto-resize functionality
      if (this.responseConfig.autoResize) {
        textarea.style.resize = 'vertical';
        textarea.addEventListener('input', () => {
          textarea.style.height = 'auto';
          textarea.style.height = `${textarea.scrollHeight}px`;
        });
      }

      // Add event listeners
      textarea.addEventListener('input', () => {
        this.updateCounter();
        this.updateValidationDisplay();
        this.notifyChange();
      });

      textarea.addEventListener('blur', () => {
        this.validateField(textarea);
      });

      responseArea.appendChild(textarea);
    }

    container.appendChild(responseArea);
  }

  private createCounter(container: HTMLElement): void {
    const counter = document.createElement('div');
    counter.className = 'response-counter';
    
    const wordCount = document.createElement('span');
    wordCount.className = 'word-count';
    wordCount.textContent = '0 words';

    const charCount = document.createElement('span');
    charCount.className = 'char-count';
    charCount.textContent = '0 characters';

    const maxLength = this.responseConfig.validation?.maxLength;
    if (maxLength) {
      const charLimit = document.createElement('span');
      charLimit.className = 'char-limit';
      charLimit.textContent = ` / ${maxLength}`;
      charCount.appendChild(charLimit);
    }

    counter.appendChild(wordCount);
    counter.appendChild(charCount);
    container.appendChild(counter);
  }

  private setupRichTextEditor(editorDiv: HTMLElement, toolbar: HTMLElement): void {
    try {
      // Create a mini Quill instance for the response area
      const quill = new Quill(editorDiv, {
        theme: 'snow',
        modules: {
          toolbar: toolbar
        },
        formats: ['bold', 'italic', 'underline', 'list']
      });

      // Set minimum height
      const editor = editorDiv.querySelector('.ql-editor') as HTMLElement;
      if (editor) {
        editor.style.minHeight = `${this.responseConfig.lines * 1.5}em`;
      }

      // Add event listeners
      quill.on('text-change', () => {
        this.updateCounter();
        this.updateValidationDisplay();
        this.notifyChange();
      });

      // Store Quill instance for later access
      (editorDiv as any).quillInstance = quill;
    } catch (error) {
      console.warn('Failed to initialize rich text editor, falling back to textarea:', error);
      this.fallbackToTextarea(editorDiv.parentElement!);
    }
  }

  private fallbackToTextarea(container: HTMLElement): void {
    container.innerHTML = '';
    
    const textarea = document.createElement('textarea');
    textarea.setAttribute('data-field', 'content');
    textarea.className = 'response-textarea';
    textarea.rows = this.responseConfig.lines;
    textarea.placeholder = this.responseConfig.placeholder || 'Enter your response...';

    container.appendChild(textarea);
  }

  private updateCounter(): void {
    const counter = this.domNode.querySelector('.response-counter');
    if (!counter) return;

    const content = this.getContentValue();
    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
    const charCount = content.length;

    const wordCountEl = counter.querySelector('.word-count');
    const charCountEl = counter.querySelector('.char-count');

    if (wordCountEl) {
      wordCountEl.textContent = `${wordCount} ${wordCount === 1 ? 'word' : 'words'}`;
    }

    if (charCountEl) {
      const maxLength = this.responseConfig.validation?.maxLength;
      const limitEl = charCountEl.querySelector('.char-limit');
      
      if (limitEl) {
        charCountEl.firstChild!.textContent = `${charCount}`;
        
        // Update color based on limit
        if (maxLength && charCount > maxLength * 0.9) {
          charCountEl.classList.add('near-limit');
        } else {
          charCountEl.classList.remove('near-limit');
        }
        
        if (maxLength && charCount > maxLength) {
          charCountEl.classList.add('over-limit');
        } else {
          charCountEl.classList.remove('over-limit');
        }
      } else {
        charCountEl.textContent = `${charCount} ${charCount === 1 ? 'character' : 'characters'}`;
      }
    }
  }

  private validateField(input: HTMLTextAreaElement): void {
    const value = input.value.trim();

    // Remove existing validation classes
    input.classList.remove('field-valid', 'field-invalid');

    const validation = this.responseConfig.validation;
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
        errorMessage = validation.errorMessage || 'Content does not match required pattern';
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
    const richEditor = this.domNode.querySelector('.response-rich-editor .ql-editor');
    if (richEditor) {
      return richEditor.textContent || '';
    }

    const textarea = this.domNode.querySelector('.response-textarea') as HTMLTextAreaElement;
    return textarea?.value || '';
  }

  public updateConfig(newConfig: Partial<PlaceholderConfig>): void {
    this.responseConfig = { ...this.responseConfig, ...newConfig };
    this.renderResponseContent();
  }

  value(): ResponseData {
    const content = this.getContentValue();
    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

    return {
      content,
      wordCount,
      characterCount: content.length
    };
  }

  static value(node: HTMLElement): ResponseData {
    const richEditor = node.querySelector('.response-rich-editor .ql-editor');
    const content = richEditor?.textContent || 
                   (node.querySelector('.response-textarea') as HTMLTextAreaElement)?.value || '';
    
    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

    return {
      content,
      wordCount,
      characterCount: content.length
    };
  }
}