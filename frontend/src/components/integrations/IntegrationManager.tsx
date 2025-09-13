import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Alert,
  AlertDescription
} from '@/components/ui';
import {
  Plus,
  Settings,
  Trash2,
  RefreshCw,
  ExternalLink,
  Cloud,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

interface ExternalIntegration {
  id: string;
  integration_type: 'sharepoint' | 'onedrive' | 'google_drive' | 'google_workspace' | 'box' | 'dropbox';
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'error' | 'expired' | 'pending';
  sync_enabled: boolean;
  auto_sync_interval: string;
  last_sync_at?: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

interface IntegrationManagerProps {
  onIntegrationSelect?: (integration: ExternalIntegration) => void;
}

const IntegrationManager: React.FC<IntegrationManagerProps> = ({ onIntegrationSelect }) => {
  const [integrations, setIntegrations] = useState<ExternalIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const integrationTypes = [
    { value: 'sharepoint', label: 'SharePoint', icon: '📁' },
    { value: 'onedrive', label: 'OneDrive', icon: '☁️' },
    { value: 'google_drive', label: 'Google Drive', icon: '🗄️' },
    { value: 'google_workspace', label: 'Google Workspace', icon: '📊' },
    { value: 'box', label: 'Box', icon: '📦' },
    { value: 'dropbox', label: 'Dropbox', icon: '🔵' }
  ];

  const statusColors = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
    error: 'bg-red-100 text-red-800',
    expired: 'bg-yellow-100 text-yellow-800',
    pending: 'bg-blue-100 text-blue-800'
  };

  const statusIcons = {
    active: <CheckCircle className="w-4 h-4" />,
    inactive: <XCircle className="w-4 h-4" />,
    error: <XCircle className="w-4 h-4" />,
    expired: <AlertCircle className="w-4 h-4" />,
    pending: <RefreshCw className="w-4 h-4" />
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/external-integrations/', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch integrations');
      }

      const data = await response.json();
      setIntegrations(data.integrations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteIntegration = async (integrationId: string) => {
    if (!confirm('Are you sure you want to delete this integration?')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/external-integrations/${integrationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete integration');
      }

      await fetchIntegrations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleRefreshToken = async (integrationId: string) => {
    try {
      const response = await fetch(`/api/v1/external-integrations/${integrationId}/oauth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      await fetchIntegrations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const filteredIntegrations = integrations.filter(integration => {
    const matchesType = selectedType === 'all' || integration.integration_type === selectedType;
    const matchesStatus = selectedStatus === 'all' || integration.status === selectedStatus;
    const matchesSearch = integration.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         integration.integration_type.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesType && matchesStatus && matchesSearch;
  });

  const getTypeInfo = (type: string) => {
    return integrationTypes.find(t => t.value === type) || { value: type, label: type, icon: '🔌' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        Loading integrations...
      </div>
    );
  }

  if (error) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Error loading integrations: {error}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">External Integrations</h2>
          <p className="text-gray-600">Connect CA-DMS with external cloud storage services</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Integration
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
            <Input
              placeholder="Search integrations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-xs"
            />
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {integrationTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.icon} {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredIntegrations.map(integration => {
          const typeInfo = getTypeInfo(integration.integration_type);

          return (
            <Card
              key={integration.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => onIntegrationSelect?.(integration)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">{typeInfo.icon}</span>
                    <div>
                      <CardTitle className="text-lg">{integration.name}</CardTitle>
                      <p className="text-sm text-gray-500">{typeInfo.label}</p>
                    </div>
                  </div>
                  <Badge
                    className={`${statusColors[integration.status]} flex items-center gap-1`}
                  >
                    {statusIcons[integration.status]}
                    {integration.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {integration.description && (
                    <p className="text-sm text-gray-600">{integration.description}</p>
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Sync Enabled:</span>
                    <Badge variant={integration.sync_enabled ? "default" : "secondary"}>
                      {integration.sync_enabled ? 'Yes' : 'No'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Auto Sync:</span>
                    <span>{integration.auto_sync_interval}</span>
                  </div>

                  {integration.last_sync_at && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Last Sync:</span>
                      <span>{new Date(integration.last_sync_at).toLocaleDateString()}</span>
                    </div>
                  )}

                  {integration.last_error && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        {integration.last_error}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Open settings modal
                      }}
                    >
                      <Settings className="w-3 h-3 mr-1" />
                      Settings
                    </Button>

                    {integration.status === 'expired' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRefreshToken(integration.id);
                        }}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Refresh
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteIntegration(integration.id);
                      }}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredIntegrations.length === 0 && (
        <Card>
          <CardContent className="text-center p-8">
            <Cloud className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No integrations found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || selectedType !== 'all' || selectedStatus !== 'all'
                ? 'No integrations match your current filters.'
                : 'Connect external services to sync your documents.'
              }
            </p>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Integration
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats Summary */}
      {integrations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Integration Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{integrations.length}</div>
                <div className="text-sm text-gray-500">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {integrations.filter(i => i.status === 'active').length}
                </div>
                <div className="text-sm text-gray-500">Active</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {integrations.filter(i => i.status === 'pending').length}
                </div>
                <div className="text-sm text-gray-500">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {integrations.filter(i => i.status === 'error').length}
                </div>
                <div className="text-sm text-gray-500">Errors</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {integrations.filter(i => i.sync_enabled).length}
                </div>
                <div className="text-sm text-gray-500">Sync Enabled</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default IntegrationManager;