import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Save, 
  Eye, 
  Settings, 
  Plus, 
  X,
  FileText,
  ArrowLeft
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { QuillEditor } from '@/components/editor/QuillEditor';
import { cn } from '@/lib/utils';

interface TemplateField {
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

interface TemplateData {
  name: string;
  description: string;
  category: string;
  content: any;
  placeholders?: any;
  default_title_pattern?: string;
  required_fields?: string[];
  field_validations?: any;
  access_level: string;
  tags: string[];
  fields: TemplateField[];
}

const categories = [
  { value: 'governance', label: 'Governance' },
  { value: 'policy', label: 'Policy' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'report', label: 'Report' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'legal', label: 'Legal' },
  { value: 'financial', label: 'Financial' },
  { value: 'custom', label: 'Custom' }
];

const accessLevels = [
  { value: 'private', label: 'Private - Only you and collaborators' },
  { value: 'organization', label: 'Organization - All organization members' },
  { value: 'public', label: 'Public - Everyone can view' }
];

const fieldTypes = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'radio', label: 'Radio' },
  { value: 'email', label: 'Email' },
  { value: 'url', label: 'URL' },
  { value: 'tel', label: 'Phone' }
];

interface TemplateCreatorProps {
  templateId?: string;
  onSave?: () => void;
  onCancel?: () => void;
}

export const TemplateCreator: React.FC<TemplateCreatorProps> = ({
  templateId,
  onSave,
  onCancel
}) => {
  const [templateData, setTemplateData] = useState<TemplateData>({
    name: '',
    description: '',
    category: '',
    content: { ops: [] },
    access_level: 'organization',
    tags: [],
    fields: []
  });

  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showFieldDialog, setShowFieldDialog] = useState(false);
  const [currentField, setCurrentField] = useState<TemplateField | null>(null);
  const [tagInput, setTagInput] = useState('');

  const quillRef = useRef<any>(null);

  const handleSave = async (publish = false) => {
    try {
      setSaving(true);
      
      // Get content from Quill editor
      const content = quillRef.current?.getContents();
      const placeholders = quillRef.current?.extractPlaceholders();

      const payload = {
        ...templateData,
        content,
        placeholders,
        status: publish ? 'published' : 'draft'
      };

      const url = templateId 
        ? `/api/v1/templates/${templateId}`
        : '/api/v1/templates/';
      
      const method = templateId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to save template');
      }

      const savedTemplate = await response.json();

      if (publish && !templateId) {
        // Publish the newly created template
        await fetch(`/api/v1/templates/${savedTemplate.id}/publish`, {
          method: 'POST'
        });
      }

      onSave?.();
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !templateData.tags.includes(tagInput.trim())) {
      setTemplateData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTemplateData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleAddField = (field: TemplateField) => {
    setTemplateData(prev => ({
      ...prev,
      fields: [...prev.fields, { ...field, field_order: prev.fields.length }]
    }));
    setShowFieldDialog(false);
    setCurrentField(null);
  };

  const handleUpdateField = (index: number, field: TemplateField) => {
    setTemplateData(prev => ({
      ...prev,
      fields: prev.fields.map((f, i) => i === index ? field : f)
    }));
    setShowFieldDialog(false);
    setCurrentField(null);
  };

  const handleRemoveField = (index: number) => {
    setTemplateData(prev => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel || (() => window.history.back())}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {templateId ? 'Edit Template' : 'Create Template'}
            </h1>
            <p className="text-muted-foreground">
              Design a reusable template for your organization
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowPreview(true)}
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button
            onClick={() => handleSave(false)}
            disabled={saving || !templateData.name.trim()}
          >
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
          <Button
            onClick={() => handleSave(true)}
            disabled={saving || !templateData.name.trim()}
            className="bg-green-600 hover:bg-green-700"
          >
            <Save className="h-4 w-4 mr-2" />
            Save & Publish
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar - Template Settings */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Template Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={templateData.name}
                  onChange={(e) => setTemplateData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter template name"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={templateData.description}
                  onChange={(e) => setTemplateData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe this template"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="category">Category *</Label>
                <Select 
                  value={templateData.category} 
                  onValueChange={(value) => setTemplateData(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="access_level">Access Level</Label>
                <Select 
                  value={templateData.access_level} 
                  onValueChange={(value) => setTemplateData(prev => ({ ...prev, access_level: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accessLevels.map(level => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="default_title_pattern">Default Title Pattern</Label>
                <Input
                  id="default_title_pattern"
                  value={templateData.default_title_pattern || ''}
                  onChange={(e) => setTemplateData(prev => ({ ...prev, default_title_pattern: e.target.value }))}
                  placeholder="e.g., Meeting Minutes - {date}"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use {'{field_name}'} for dynamic values
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Add tag"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                />
                <Button size="sm" onClick={handleAddTag}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex flex-wrap gap-1">
                {templateData.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Template Fields */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center justify-between">
                Template Fields
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setCurrentField(null);
                    setShowFieldDialog(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {templateData.fields.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No fields defined. Add fields to collect data when creating documents from this template.
                </p>
              ) : (
                <div className="space-y-2">
                  {templateData.fields.map((field, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{field.field_label}</div>
                        <div className="text-xs text-muted-foreground">
                          {field.field_type} {field.is_required && '(Required)'}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveField(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content - Editor */}
        <div className="lg:col-span-3">
          <Card className="h-[calc(100vh-200px)]">
            <CardHeader>
              <CardTitle className="text-sm">Template Content</CardTitle>
            </CardHeader>
            <CardContent className="h-full p-0">
              <QuillEditor
                ref={quillRef}
                value={templateData.content}
                onChange={(content) => setTemplateData(prev => ({ ...prev, content }))}
                placeholder="Start designing your template..."
                className="h-full"
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Field Dialog */}
      <FieldDialog
        open={showFieldDialog}
        onOpenChange={setShowFieldDialog}
        field={currentField}
        onSave={currentField ? 
          (field) => handleUpdateField(templateData.fields.indexOf(currentField), field) :
          handleAddField
        }
      />

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Template Preview</DialogTitle>
            <DialogDescription>
              This is how your template will appear to users
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-2">{templateData.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{templateData.description}</p>
              
              {/* Preview would show the rendered Quill content here */}
              <div className="border rounded p-4 min-h-[300px] bg-gray-50">
                <p className="text-center text-muted-foreground">
                  Template content preview would be rendered here
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Field Dialog Component
interface FieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: TemplateField | null;
  onSave: (field: TemplateField) => void;
}

const FieldDialog: React.FC<FieldDialogProps> = ({
  open,
  onOpenChange,
  field,
  onSave
}) => {
  const [fieldData, setFieldData] = useState<TemplateField>({
    field_name: '',
    field_label: '',
    field_type: 'text',
    is_required: false,
    field_order: 0
  });

  React.useEffect(() => {
    if (field) {
      setFieldData(field);
    } else {
      setFieldData({
        field_name: '',
        field_label: '',
        field_type: 'text',
        is_required: false,
        field_order: 0
      });
    }
  }, [field, open]);

  const handleSave = () => {
    if (fieldData.field_name && fieldData.field_label) {
      onSave(fieldData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{field ? 'Edit Field' : 'Add Field'}</DialogTitle>
          <DialogDescription>
            Define a field that users will fill when creating documents from this template
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="field_name">Field Name</Label>
              <Input
                id="field_name"
                value={fieldData.field_name}
                onChange={(e) => setFieldData(prev => ({ ...prev, field_name: e.target.value }))}
                placeholder="field_name"
              />
              <p className="text-xs text-muted-foreground">
                Used in template content as {'{field_name}'}
              </p>
            </div>
            <div>
              <Label htmlFor="field_label">Field Label</Label>
              <Input
                id="field_label"
                value={fieldData.field_label}
                onChange={(e) => setFieldData(prev => ({ ...prev, field_label: e.target.value }))}
                placeholder="Display name"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="field_type">Field Type</Label>
            <Select 
              value={fieldData.field_type} 
              onValueChange={(value) => setFieldData(prev => ({ ...prev, field_type: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fieldTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="field_description">Description (Optional)</Label>
            <Textarea
              id="field_description"
              value={fieldData.field_description || ''}
              onChange={(e) => setFieldData(prev => ({ ...prev, field_description: e.target.value }))}
              placeholder="Help text for this field"
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="default_value">Default Value (Optional)</Label>
            <Input
              id="default_value"
              value={fieldData.default_value || ''}
              onChange={(e) => setFieldData(prev => ({ ...prev, default_value: e.target.value }))}
              placeholder="Default value"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="is_required"
              checked={fieldData.is_required}
              onChange={(e) => setFieldData(prev => ({ ...prev, is_required: e.target.checked }))}
            />
            <Label htmlFor="is_required">Required field</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!fieldData.field_name || !fieldData.field_label}>
            {field ? 'Update' : 'Add'} Field
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};