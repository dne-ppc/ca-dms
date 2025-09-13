import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Button,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Alert,
  AlertDescription,
  Progress,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui';
import {
  Plus,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react';

interface IntegrationSetupProps {
  onComplete?: () => void;
}

interface OAuthConfig {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  scope: string;
}

interface IntegrationFormData {
  integration_type: string;
  name: string;
  description: string;
  sync_enabled: boolean;
  auto_sync_interval: string;
  oauth_config: OAuthConfig;
}

const IntegrationSetup: React.FC<IntegrationSetupProps> = ({ onComplete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<IntegrationFormData>({
    integration_type: '',
    name: '',
    description: '',
    sync_enabled: true,
    auto_sync_interval: '24h',
    oauth_config: {
      client_id: '',
      client_secret: '',
      redirect_uri: `${window.location.origin}/oauth/callback`,
      scope: ''
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string>('');
  const [showSecret, setShowSecret] = useState(false);

  const integrationTypes = [
    {
      value: 'sharepoint',
      label: 'SharePoint',
      icon: '📁',
      description: 'Connect to Microsoft SharePoint for document management',
      scope: 'https://graph.microsoft.com/Sites.ReadWrite.All Files.ReadWrite.All',
      instructions: 'Register an app in Azure AD with SharePoint permissions'
    },
    {
      value: 'onedrive',
      label: 'OneDrive',
      icon: '☁️',
      description: 'Connect to Microsoft OneDrive for personal storage',
      scope: 'https://graph.microsoft.com/Files.ReadWrite.All',
      instructions: 'Register an app in Azure AD with OneDrive permissions'
    },
    {
      value: 'google_drive',
      label: 'Google Drive',
      icon: '🗄️',
      description: 'Connect to Google Drive for cloud storage',
      scope: 'https://www.googleapis.com/auth/drive',
      instructions: 'Create a project in Google Cloud Console with Drive API'
    },
    {
      value: 'google_workspace',
      label: 'Google Workspace',
      icon: '📊',
      description: 'Connect to Google Workspace for business documents',
      scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/documents',
      instructions: 'Create a project in Google Cloud Console with Workspace APIs'
    },
    {
      value: 'box',
      label: 'Box',
      icon: '📦',
      description: 'Connect to Box for enterprise content management',
      scope: 'root_readwrite',
      instructions: 'Create a Box app with OAuth 2.0 authentication'
    },
    {
      value: 'dropbox',
      label: 'Dropbox',
      icon: '🔵',
      description: 'Connect to Dropbox for file storage and sharing',
      scope: 'files.content.write files.content.read',
      instructions: 'Create a Dropbox app with appropriate permissions'
    }
  ];

  const syncIntervals = [
    { value: '15m', label: '15 minutes' },
    { value: '1h', label: '1 hour' },
    { value: '6h', label: '6 hours' },
    { value: '24h', label: '24 hours' },
    { value: '7d', label: '7 days' }
  ];

  const selectedType = integrationTypes.find(t => t.value === formData.integration_type);

  useEffect(() => {
    if (selectedType && !formData.oauth_config.scope) {
      setFormData(prev => ({
        ...prev,
        oauth_config: {
          ...prev.oauth_config,
          scope: selectedType.scope
        }
      }));
    }
  }, [selectedType, formData.oauth_config.scope]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleOAuthConfigChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      oauth_config: {
        ...prev.oauth_config,
        [field]: value
      }
    }));
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleGetAuthUrl = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/v1/external-integrations/oauth/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          integration_type: formData.integration_type,
          client_id: formData.oauth_config.client_id,
          redirect_uri: formData.oauth_config.redirect_uri,
          scope: formData.oauth_config.scope
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get authorization URL');
      }

      const data = await response.json();
      setAuthUrl(data.authorization_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateIntegration = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/v1/external-integrations/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          integration_type: formData.integration_type,
          name: formData.name,
          description: formData.description,
          client_id: formData.oauth_config.client_id,
          client_secret: formData.oauth_config.client_secret,
          redirect_uri: formData.oauth_config.redirect_uri,
          scope: formData.oauth_config.scope,
          sync_enabled: formData.sync_enabled,
          auto_sync_interval: formData.auto_sync_interval
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create integration');
      }

      setCurrentStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Choose Integration Type</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {integrationTypes.map(type => (
                  <Card
                    key={type.value}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      formData.integration_type === type.value ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => handleInputChange('integration_type', type.value)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-3">
                        <span className="text-2xl">{type.icon}</span>
                        <div>
                          <h4 className="font-semibold">{type.label}</h4>
                          <p className="text-sm text-gray-600 mt-1">{type.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Integration Details</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Integration Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder={`My ${selectedType?.label} Integration`}
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Optional description for this integration"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Auto Sync Interval</Label>
                    <Select
                      value={formData.auto_sync_interval}
                      onValueChange={(value) => handleInputChange('auto_sync_interval', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {syncIntervals.map(interval => (
                          <SelectItem key={interval.value} value={interval.value}>
                            {interval.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2 pt-6">
                    <input
                      type="checkbox"
                      id="sync_enabled"
                      checked={formData.sync_enabled}
                      onChange={(e) => handleInputChange('sync_enabled', e.target.checked)}
                    />
                    <Label htmlFor="sync_enabled">Enable automatic sync</Label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">OAuth Configuration</h3>
              {selectedType && (
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {selectedType.instructions}. You'll need to register CA-DMS as an authorized application.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <div>
                  <Label htmlFor="client_id">Client ID *</Label>
                  <Input
                    id="client_id"
                    value={formData.oauth_config.client_id}
                    onChange={(e) => handleOAuthConfigChange('client_id', e.target.value)}
                    placeholder="Your application's client ID"
                  />
                </div>

                <div>
                  <Label htmlFor="client_secret">Client Secret *</Label>
                  <div className="relative">
                    <Input
                      id="client_secret"
                      type={showSecret ? 'text' : 'password'}
                      value={formData.oauth_config.client_secret}
                      onChange={(e) => handleOAuthConfigChange('client_secret', e.target.value)}
                      placeholder="Your application's client secret"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowSecret(!showSecret)}
                    >
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="redirect_uri">Redirect URI</Label>
                  <div className="flex">
                    <Input
                      id="redirect_uri"
                      value={formData.oauth_config.redirect_uri}
                      onChange={(e) => handleOAuthConfigChange('redirect_uri', e.target.value)}
                      readOnly
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => copyToClipboard(formData.oauth_config.redirect_uri)}
                      className="ml-2"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Use this URL when configuring your OAuth application
                  </p>
                </div>

                <div>
                  <Label htmlFor="scope">Scope</Label>
                  <Textarea
                    id="scope"
                    value={formData.oauth_config.scope}
                    onChange={(e) => handleOAuthConfigChange('scope', e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold mb-2">Integration Created Successfully!</h3>
              <p className="text-gray-600">
                Your {selectedType?.label} integration has been created. You can now authorize
                the connection to start syncing documents.
              </p>
            </div>

            {authUrl && (
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Click the button below to authorize CA-DMS to access your {selectedType?.label} account.
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={() => window.open(authUrl, '_blank')}
                  className="w-full"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Authorize {selectedType?.label} Access
                </Button>
              </div>
            )}

            <Button
              onClick={() => {
                setIsOpen(false);
                onComplete?.();
              }}
              variant="outline"
              className="w-full"
            >
              Complete Setup
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return formData.integration_type !== '';
      case 2:
        return formData.name.trim() !== '';
      case 3:
        return formData.oauth_config.client_id.trim() !== '' &&
               formData.oauth_config.client_secret.trim() !== '';
      default:
        return true;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Integration
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add External Integration</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Step {currentStep} of 4</span>
              <span>{Math.round((currentStep / 4) * 100)}% Complete</span>
            </div>
            <Progress value={(currentStep / 4) * 100} />
          </div>

          {/* Step Indicators */}
          <div className="flex justify-between">
            {['Type', 'Details', 'OAuth', 'Complete'].map((step, index) => (
              <div
                key={step}
                className={`flex items-center ${
                  index + 1 <= currentStep ? 'text-blue-600' : 'text-gray-400'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    index + 1 <= currentStep ? 'bg-blue-600 text-white' : 'bg-gray-200'
                  }`}
                >
                  {index + 1}
                </div>
                <span className="ml-2 text-sm hidden sm:block">{step}</span>
              </div>
            ))}
          </div>

          {/* Error Alert */}
          {error && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Step Content */}
          {renderStepContent()}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-6">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1}
            >
              Back
            </Button>

            <div className="flex gap-2">
              {currentStep === 3 && (
                <Button
                  variant="outline"
                  onClick={handleGetAuthUrl}
                  disabled={loading || !isStepValid()}
                >
                  Get Auth URL
                </Button>
              )}

              {currentStep < 3 ? (
                <Button
                  onClick={handleNext}
                  disabled={!isStepValid()}
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : currentStep === 3 ? (
                <Button
                  onClick={handleCreateIntegration}
                  disabled={loading || !isStepValid()}
                >
                  {loading ? 'Creating...' : 'Create Integration'}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IntegrationSetup;