import Quill from 'quill';
import { DraggablePlaceholderBlot } from './DraggablePlaceholderBlot';
import type { PlaceholderConfig } from './DraggablePlaceholderBlot';
import './EnhancedSignatureBlot.css';

export interface SignatureConfig extends PlaceholderConfig {
  includeTitle: boolean;
  includeName: boolean;
  includeDate: boolean;
  signatureStyle: 'line' | 'box' | 'image';
  preset: 'standard' | 'executive' | 'witness' | 'custom';
}

export interface SignatureData {
  name: string;
  date: string;
  title: string;
  signature?: string; // Base64 image or text
}

export class EnhancedSignatureBlot extends DraggablePlaceholderBlot {
  static blotName = 'enhanced-signature';
  static tagName = 'div';
  static className = 'ql-enhanced-signature';

  private signatureConfig: SignatureConfig;

  static create(config: SignatureConfig): HTMLElement {
    const node = super.create(config) as HTMLElement;
    node.classList.add(this.className);

    const instance = new this({} as any, node);
    instance.signatureConfig = config;
    instance.renderSignatureContent();

    return node;
  }

  static getPresetConfig(preset: string): Partial<SignatureConfig> {
    const presets: Record<string, Partial<SignatureConfig>> = {
      standard: {
        includeTitle: true,
        includeName: true,
        includeDate: true,
        signatureStyle: 'line',
        isDraggable: true,
        isResizable: false,
        validation: {
          required: true,
          errorMessage: 'Signature is required'
        }
      },
      executive: {
        includeTitle: true,
        includeName: true,
        includeDate: true,
        signatureStyle: 'box',
        isDraggable: true,
        isResizable: true,
        customStyles: {
          border: '2px solid #1f2937',
          padding: '16px',
          background: '#f9fafb'
        },
        validation: {
          required: true,
          errorMessage: 'Executive signature required'
        }
      },
      witness: {
        includeTitle: false,
        includeName: true,
        includeDate: true,
        signatureStyle: 'line',
        isDraggable: true,
        isResizable: false,
        validation: {
          required: false
        }
      },
      custom: {
        includeTitle: true,
        includeName: true,
        includeDate: true,
        signatureStyle: 'line',
        isDraggable: true,
        isResizable: true,
        validation: {
          required: false
        }
      }
    };

    return presets[preset] || presets.standard;
  }

  private renderSignatureContent(): void {
    const contentContainer = this.domNode.querySelector('.placeholder-content') as HTMLElement;
    if (!contentContainer) return;

    contentContainer.innerHTML = '';
    contentContainer.className = 'placeholder-content signature-content';

    // Apply custom styles if defined
    if (this.signatureConfig.customStyles) {
      Object.entries(this.signatureConfig.customStyles).forEach(([key, value]) => {
        (contentContainer.style as any)[key] = value;
      });
    }

    // Add signature label
    const label = document.createElement('div');
    label.className = 'signature-label';
    label.textContent = this.signatureConfig.label || 'Signature';
    contentContainer.appendChild(label);

    // Create signature area based on style
    this.createSignatureArea(contentContainer);

    // Add form fields based on configuration
    if (this.signatureConfig.includeName) {
      this.createFieldInput(contentContainer, 'name', 'Name', 'text', 'Enter full name');
    }

    if (this.signatureConfig.includeDate) {
      this.createFieldInput(contentContainer, 'date', 'Date', 'date', '');
    }

    if (this.signatureConfig.includeTitle) {
      this.createFieldInput(contentContainer, 'title', 'Title', 'text', 'Enter title/position');
    }

    // Add preset indicator
    if (this.signatureConfig.preset && this.signatureConfig.preset !== 'custom') {
      const presetBadge = document.createElement('div');
      presetBadge.className = 'signature-preset-badge';
      presetBadge.textContent = this.signatureConfig.preset.toUpperCase();
      contentContainer.appendChild(presetBadge);
    }
  }

  private createSignatureArea(container: HTMLElement): void {
    const signatureArea = document.createElement('div');
    signatureArea.className = `signature-area signature-${this.signatureConfig.signatureStyle}`;

    switch (this.signatureConfig.signatureStyle) {
      case 'line':
        signatureArea.innerHTML = `
          <div class="signature-line">
            <input type="text" 
                   data-field="signature" 
                   placeholder="Sign here" 
                   class="signature-input line-style"
                   style="font-family: cursive;">
          </div>
        `;
        break;

      case 'box':
        signatureArea.innerHTML = `
          <div class="signature-box">
            <canvas class="signature-canvas" width="300" height="100"></canvas>
            <div class="signature-controls">
              <button type="button" class="clear-signature">Clear</button>
              <button type="button" class="save-signature">Save</button>
            </div>
            <input type="hidden" data-field="signature" class="signature-data">
          </div>
        `;
        this.setupCanvasSignature(signatureArea);
        break;

      case 'image':
        signatureArea.innerHTML = `
          <div class="signature-image-upload">
            <input type="file" 
                   data-field="signature" 
                   accept="image/*" 
                   class="signature-file-input"
                   style="display: none;">
            <div class="signature-preview">
              <img class="signature-image" style="display: none; max-width: 200px; max-height: 60px;">
              <div class="upload-prompt">Click to upload signature image</div>
            </div>
            <button type="button" class="upload-signature">Choose Image</button>
          </div>
        `;
        this.setupImageSignature(signatureArea);
        break;
    }

    container.appendChild(signatureArea);
  }

  private createFieldInput(container: HTMLElement, fieldName: string, label: string, type: string, placeholder: string): void {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'signature-field';

    const fieldLabel = document.createElement('label');
    fieldLabel.textContent = `${label}:`;
    fieldLabel.className = 'signature-field-label';

    const fieldInput = document.createElement('input');
    fieldInput.type = type;
    fieldInput.setAttribute('data-field', fieldName);
    fieldInput.placeholder = placeholder;
    fieldInput.className = 'signature-field-input';

    // Add validation attributes
    if (this.signatureConfig.validation?.required) {
      fieldInput.required = true;
    }

    // Add event listeners for validation
    fieldInput.addEventListener('input', () => {
      this.updateValidationDisplay();
      this.notifyChange();
    });

    fieldInput.addEventListener('blur', () => {
      this.validateField(fieldInput);
    });

    fieldDiv.appendChild(fieldLabel);
    fieldDiv.appendChild(fieldInput);
    container.appendChild(fieldDiv);
  }

  private setupCanvasSignature(container: HTMLElement): void {
    const canvas = container.querySelector('.signature-canvas') as HTMLCanvasElement;
    const clearBtn = container.querySelector('.clear-signature') as HTMLButtonElement;
    const saveBtn = container.querySelector('.save-signature') as HTMLButtonElement;
    const hiddenInput = container.querySelector('.signature-data') as HTMLInputElement;

    if (!canvas) return;

    const ctx = canvas.getContext('2d')!;
    let isDrawing = false;

    // Set up canvas styling
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Mouse events
    canvas.addEventListener('mousedown', (e) => {
      isDrawing = true;
      const rect = canvas.getBoundingClientRect();
      ctx.beginPath();
      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!isDrawing) return;
      const rect = canvas.getBoundingClientRect();
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      ctx.stroke();
    });

    canvas.addEventListener('mouseup', () => {
      isDrawing = false;
    });

    // Touch events for mobile
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      isDrawing = true;
      ctx.beginPath();
      ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
    });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!isDrawing) return;
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
      ctx.stroke();
    });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      isDrawing = false;
    });

    // Clear button
    clearBtn.addEventListener('click', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hiddenInput.value = '';
      this.notifyChange();
    });

    // Save button
    saveBtn.addEventListener('click', () => {
      const dataURL = canvas.toDataURL();
      hiddenInput.value = dataURL;
      this.notifyChange();
    });
  }

  private setupImageSignature(container: HTMLElement): void {
    const fileInput = container.querySelector('.signature-file-input') as HTMLInputElement;
    const uploadBtn = container.querySelector('.upload-signature') as HTMLButtonElement;
    const preview = container.querySelector('.signature-preview') as HTMLElement;
    const image = container.querySelector('.signature-image') as HTMLImageElement;
    const prompt = container.querySelector('.upload-prompt') as HTMLElement;

    uploadBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataURL = e.target?.result as string;
        image.src = dataURL;
        image.style.display = 'block';
        prompt.style.display = 'none';
        this.notifyChange();
      };
      reader.readAsDataURL(file);
    });

    // Make preview clickable
    preview.addEventListener('click', () => {
      fileInput.click();
    });
  }

  private validateField(input: HTMLInputElement): void {
    const fieldName = input.getAttribute('data-field');
    const value = input.value.trim();

    // Remove existing validation classes
    input.classList.remove('field-valid', 'field-invalid');

    // Basic validation
    if (this.signatureConfig.validation?.required && !value) {
      input.classList.add('field-invalid');
      this.showFieldError(input, 'This field is required');
    } else if (value) {
      input.classList.add('field-valid');
      this.hideFieldError(input);
    }

    // Field-specific validation
    if (fieldName === 'name' && value) {
      if (value.length < 2) {
        input.classList.remove('field-valid');
        input.classList.add('field-invalid');
        this.showFieldError(input, 'Name must be at least 2 characters');
      }
    }
  }

  private showFieldError(input: HTMLInputElement, message: string): void {
    this.hideFieldError(input); // Remove existing error

    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.textContent = message;
    input.parentNode?.appendChild(errorDiv);
  }

  private hideFieldError(input: HTMLInputElement): void {
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
    const inputs = this.domNode.querySelectorAll('input[data-field]');
    const values: string[] = [];

    inputs.forEach(input => {
      const value = (input as HTMLInputElement).value;
      if (value.trim()) {
        values.push(value);
      }
    });

    return values.join(' ');
  }

  public updateConfig(newConfig: Partial<PlaceholderConfig>): void {
    this.signatureConfig = { ...this.signatureConfig, ...newConfig };
    this.renderSignatureContent();
  }

  value(): SignatureData {
    const nameInput = this.domNode.querySelector('input[data-field="name"]') as HTMLInputElement;
    const dateInput = this.domNode.querySelector('input[data-field="date"]') as HTMLInputElement;
    const titleInput = this.domNode.querySelector('input[data-field="title"]') as HTMLInputElement;
    const signatureInput = this.domNode.querySelector('input[data-field="signature"], .signature-data') as HTMLInputElement;

    return {
      name: nameInput?.value || '',
      date: dateInput?.value || '',
      title: titleInput?.value || '',
      signature: signatureInput?.value || ''
    };
  }

  static value(node: HTMLElement): SignatureData {
    const nameInput = node.querySelector('input[data-field="name"]') as HTMLInputElement;
    const dateInput = node.querySelector('input[data-field="date"]') as HTMLInputElement;
    const titleInput = node.querySelector('input[data-field="title"]') as HTMLInputElement;
    const signatureInput = node.querySelector('input[data-field="signature"], .signature-data') as HTMLInputElement;

    return {
      name: nameInput?.value || '',
      date: dateInput?.value || '',
      title: titleInput?.value || '',
      signature: signatureInput?.value || ''
    };
  }
}