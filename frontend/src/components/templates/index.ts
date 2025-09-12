// Document Template Management Components
export { TemplateManager } from './TemplateManager';
export { TemplateCreator } from './TemplateCreator';
export { TemplateViewer } from './TemplateViewer';
export { TemplateCollaboration } from './TemplateCollaboration';
export { TemplateVersionHistory } from './TemplateVersionHistory';

// Export template-related types if needed
export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  access_level: string;
  status: string;
  version: number;
  usage_count: number;
  created_by: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
  content: any;
  placeholders?: any;
  tags: string[];
  fields: TemplateField[];
  collaborators?: any[];
  reviews_summary?: any;
}

export interface TemplateField {
  field_name: string;
  field_label: string;
  field_type: string;
  field_description?: string;
  is_required: boolean;
  default_value?: string;
  field_options?: any;
  field_order: number;
  field_group?: string;
  validation_rules?: any;
  error_message?: string;
}

export interface TemplateSearchResponse {
  templates: Template[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}