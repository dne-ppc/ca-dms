import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  ArrowLeft,
  Edit2,
  Share2,
  Download,
  FileText,
  Star,
  Users,
  Clock,
  Eye,
  MoreHorizontal,
  Copy,
  Trash2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface Template {
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
  fields: any[];
  collaborators: any[];
  reviews_summary?: any;
}

interface TemplateViewerProps {
  templateId: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onBack?: () => void;
}

export const TemplateViewer: React.FC<TemplateViewerProps> = ({
  templateId,
  onEdit,
  onDelete,
  onBack
}) => {
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [documentTitle, setDocumentTitle] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});

  useEffect(() => {
    loadTemplate();
  }, [templateId]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/templates/${templateId}`);
      if (response.ok) {
        const templateData = await response.json();
        setTemplate(templateData);
        
        // Initialize field values with defaults
        const initialValues: Record<string, any> = {};
        templateData.fields?.forEach((field: any) => {
          if (field.default_value) {
            initialValues[field.field_name] = field.default_value;
          }
        });
        setFieldValues(initialValues);
      }
    } catch (error) {
      console.error('Failed to load template:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDocument = async () => {
    try {
      const response = await fetch(`/api/v1/templates/${templateId}/create-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: templateId,
          document_title: documentTitle,
          field_values: fieldValues,
          document_type: template?.category || 'governance'
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setShowCreateDialog(false);
        // Navigate to the created document
        window.location.href = `/documents/${result.document_id}`;
      } else {
        throw new Error('Failed to create document');
      }
    } catch (error) {
      console.error('Error creating document:', error);
      alert('Failed to create document. Please try again.');
    }
  };

  const handleDuplicateTemplate = async () => {
    try {
      const response = await fetch(`/api/v1/templates/bulk-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_ids: [templateId],
          action: 'duplicate'
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.succeeded.length > 0) {
          alert('Template duplicated successfully');
          loadTemplate(); // Refresh
        }
      }
    } catch (error) {
      console.error('Error duplicating template:', error);
      alert('Failed to duplicate template. Please try again.');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      governance: 'bg-blue-100 text-blue-800',
      policy: 'bg-green-100 text-green-800',
      procedure: 'bg-purple-100 text-purple-800',
      report: 'bg-orange-100 text-orange-800',
      meeting: 'bg-indigo-100 text-indigo-800',
      legal: 'bg-red-100 text-red-800',
      financial: 'bg-yellow-100 text-yellow-800',
      custom: 'bg-gray-100 text-gray-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      published: 'bg-green-100 text-green-800',
      archived: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const renderFieldInput = (field: any) => {
    const value = fieldValues[field.field_name] || '';
    
    switch (field.field_type) {
      case 'textarea':
        return (
          <textarea
            className="w-full p-2 border rounded resize-none"
            rows={3}
            value={value}
            onChange={(e) => setFieldValues(prev => ({
              ...prev,
              [field.field_name]: e.target.value
            }))}
            placeholder={field.field_description}
            required={field.is_required}
          />
        );
      case 'select':
        return (
          <select
            className="w-full p-2 border rounded"
            value={value}
            onChange={(e) => setFieldValues(prev => ({
              ...prev,
              [field.field_name]: e.target.value
            }))}
            required={field.is_required}
          >
            <option value="">Select...</option>
            {field.field_options?.options?.map((option: string, index: number) => (
              <option key={index} value={option}>{option}</option>
            ))}
          </select>
        );
      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={value === true}
              onChange={(e) => setFieldValues(prev => ({
                ...prev,
                [field.field_name]: e.target.checked
              }))}
              required={field.is_required}
            />
            <span className="text-sm">{field.field_description || 'Check if applicable'}</span>
          </div>
        );
      default:
        return (
          <Input
            type={field.field_type}
            value={value}
            onChange={(e) => setFieldValues(prev => ({
              ...prev,
              [field.field_name]: e.target.value
            }))}
            placeholder={field.field_description}
            required={field.is_required}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Template not found</h3>
        <p className="text-muted-foreground">The template you're looking for doesn't exist or you don't have permission to view it.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack || (() => window.history.back())}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold">{template.name}</h1>
              <Badge className={cn("text-xs", getCategoryColor(template.category))}>
                {template.category}
              </Badge>
              <Badge className={cn("text-xs", getStatusColor(template.status))}>
                {template.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">{template.description}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            <FileText className="h-4 w-4 mr-2" />
            Create Document
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit Template
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDuplicateTemplate}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowShareDialog(true)}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar - Template Info */}
        <div className="lg:col-span-1 space-y-4">
          {/* Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Usage Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Used</span>
                <span className="font-medium">{template.usage_count} times</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Version</span>
                <span className="font-medium">v{template.version}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge className={cn("text-xs", getStatusColor(template.status))}>
                  {template.status}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <span className="text-sm text-muted-foreground">Created by</span>
                <div className="flex items-center gap-2 mt-1">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs">
                      {template.created_by.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{template.created_by}</span>
                </div>
              </div>
              
              <div>
                <span className="text-sm text-muted-foreground">Created</span>
                <p className="text-sm mt-1">{formatDate(template.created_at)}</p>
              </div>
              
              <div>
                <span className="text-sm text-muted-foreground">Last updated</span>
                <p className="text-sm mt-1">{formatDate(template.updated_at)}</p>
              </div>

              {template.published_at && (
                <div>
                  <span className="text-sm text-muted-foreground">Published</span>
                  <p className="text-sm mt-1">{formatDate(template.published_at)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          {template.tags && template.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {template.tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Collaborators */}
          {template.collaborators && template.collaborators.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Collaborators
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {template.collaborators.slice(0, 5).map((collaborator: any, index: number) => (
                    <div key={index} className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {collaborator.user_id.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{collaborator.user_id}</span>
                      {collaborator.can_edit && (
                        <Badge variant="secondary" className="text-xs">Edit</Badge>
                      )}
                    </div>
                  ))}
                  {template.collaborators.length > 5 && (
                    <p className="text-xs text-muted-foreground">
                      +{template.collaborators.length - 5} more
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <Card className="h-[calc(100vh-200px)]">
            <CardHeader>
              <CardTitle className="text-sm">Template Preview</CardTitle>
            </CardHeader>
            <CardContent className="h-full overflow-y-auto">
              {/* Template content would be rendered here */}
              <div className="prose prose-sm max-w-none">
                <div className="border rounded-lg p-6 min-h-[400px] bg-gray-50">
                  <p className="text-center text-muted-foreground">
                    Template content preview would be rendered here
                    <br />
                    <small>This would show the actual Quill Delta content formatted as HTML</small>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Document Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Document from Template</DialogTitle>
            <DialogDescription>
              Fill in the details to create a new document using this template
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="document_title">Document Title</Label>
              <Input
                id="document_title"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                placeholder={template.default_title_pattern || `Document from ${template.name}`}
              />
            </div>

            {template.fields && template.fields.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-medium">Template Fields</h4>
                {template.fields.map((field: any, index: number) => (
                  <div key={index}>
                    <Label htmlFor={field.field_name}>
                      {field.field_label}
                      {field.is_required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    {renderFieldInput(field)}
                    {field.field_description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {field.field_description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateDocument}
              disabled={!documentTitle.trim()}
            >
              Create Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Template</DialogTitle>
            <DialogDescription>
              Share this template with others in your organization
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Template sharing functionality would be implemented here, including:
              <br />• Add collaborators
              <br />• Set permissions (view, edit, manage)
              <br />• Generate share links
              <br />• Manage access levels
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};