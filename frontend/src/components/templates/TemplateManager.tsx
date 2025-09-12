import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Search, 
  Filter, 
  FileText, 
  Eye, 
  Edit2, 
  Trash2, 
  Share2,
  Star,
  ChevronLeft,
  ChevronRight,
  Grid,
  List
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
} from "@/components/ui/dialog";
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
  created_at: string;
  updated_at: string;
  published_at?: string;
  thumbnail_url?: string;
  tags: string[];
}

interface TemplateSearchResponse {
  templates: Template[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export const TemplateManager: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [sortBy, setSortBy] = useState('usage_count');
  const [sortOrder, setSortOrder] = useState('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const categories = [
    { value: '', label: 'All Categories' },
    { value: 'governance', label: 'Governance' },
    { value: 'policy', label: 'Policy' },
    { value: 'procedure', label: 'Procedure' },
    { value: 'report', label: 'Report' },
    { value: 'meeting', label: 'Meeting' },
    { value: 'legal', label: 'Legal' },
    { value: 'financial', label: 'Financial' },
    { value: 'custom', label: 'Custom' }
  ];

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Published' },
    { value: 'archived', label: 'Archived' }
  ];

  const sortOptions = [
    { value: 'name', label: 'Name' },
    { value: 'created_at', label: 'Created Date' },
    { value: 'updated_at', label: 'Updated Date' },
    { value: 'usage_count', label: 'Usage Count' },
    { value: 'rating', label: 'Rating' }
  ];

  useEffect(() => {
    searchTemplates();
  }, [searchQuery, selectedCategory, selectedStatus, sortBy, sortOrder, currentPage]);

  const searchTemplates = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '12',
        sort_by: sortBy,
        sort_order: sortOrder
      });

      if (searchQuery) params.append('query', searchQuery);
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedStatus) params.append('status', selectedStatus);

      const response = await fetch(`/api/v1/templates/?${params}`);
      const data: TemplateSearchResponse = await response.json();

      setTemplates(data.templates);
      setTotalPages(data.total_pages);
    } catch (error) {
      console.error('Failed to search templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await fetch(`/api/v1/templates/${templateId}`, {
        method: 'DELETE'
      });
      searchTemplates(); // Refresh the list
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  const handlePublishTemplate = async (templateId: string) => {
    try {
      await fetch(`/api/v1/templates/${templateId}/publish`, {
        method: 'POST'
      });
      searchTemplates(); // Refresh the list
    } catch (error) {
      console.error('Failed to publish template:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
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

  const renderTemplateCard = (template: Template) => (
    <Card key={template.id} className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-medium truncate">
              {template.name}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {template.description}
            </p>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.location.href = `/templates/${template.id}`}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.location.href = `/templates/${template.id}/edit`}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDeleteTemplate(template.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-1 mb-3">
          <Badge variant="secondary" className={cn("text-xs", getCategoryColor(template.category))}>
            {template.category}
          </Badge>
          <Badge variant="secondary" className={cn("text-xs", getStatusColor(template.status))}>
            {template.status}
          </Badge>
        </div>
        
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Used {template.usage_count} times</span>
          <span>v{template.version}</span>
        </div>
        
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
          <span>{formatDate(template.created_at)}</span>
          {template.status === 'draft' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handlePublishTemplate(template.id)}
            >
              Publish
            </Button>
          )}
        </div>

        {template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {template.tags.slice(0, 3).map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {template.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{template.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderTemplateRow = (template: Template) => (
    <Card key={template.id} className="mb-2">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <FileText className="h-8 w-8 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <h3 className="font-medium truncate">{template.name}</h3>
              <p className="text-sm text-muted-foreground truncate">
                {template.description}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex gap-1">
              <Badge variant="secondary" className={cn("text-xs", getCategoryColor(template.category))}>
                {template.category}
              </Badge>
              <Badge variant="secondary" className={cn("text-xs", getStatusColor(template.status))}>
                {template.status}
              </Badge>
            </div>
            
            <div className="text-sm text-muted-foreground min-w-0">
              <div>Used {template.usage_count} times</div>
              <div>v{template.version} • {formatDate(template.created_at)}</div>
            </div>
            
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => window.location.href = `/templates/${template.id}`}
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => window.location.href = `/templates/${template.id}/edit`}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDeleteTemplate(template.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Document Templates</h1>
          <p className="text-muted-foreground">
            Create and manage reusable document templates for your organization
          </p>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Template</DialogTitle>
              <DialogDescription>
                Choose how you'd like to create your new template.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Button
                onClick={() => {
                  setShowCreateDialog(false);
                  window.location.href = '/templates/create';
                }}
                className="justify-start"
              >
                <FileText className="h-4 w-4 mr-2" />
                Start from scratch
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  window.location.href = '/templates/create-from-document';
                }}
                className="justify-start"
              >
                <FileText className="h-4 w-4 mr-2" />
                Create from existing document
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </Button>
              
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-none rounded-l-md"
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-none rounded-r-md"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates Grid/List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No templates found</h3>
            <p className="text-muted-foreground text-center mb-4">
              Get started by creating your first document template
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className={
          viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
            : 'space-y-2'
        }>
          {templates.map(template => 
            viewMode === 'grid' ? renderTemplateCard(template) : renderTemplateRow(template)
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNumber = Math.max(1, currentPage - 2) + i;
              if (pageNumber > totalPages) return null;
              
              return (
                <Button
                  key={pageNumber}
                  variant={currentPage === pageNumber ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPage(pageNumber)}
                  className="w-8 h-8 p-0"
                >
                  {pageNumber}
                </Button>
              );
            })}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};