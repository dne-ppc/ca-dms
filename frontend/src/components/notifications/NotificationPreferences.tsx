import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, Mail, MessageSquare, Smartphone, Users, AlertCircle, CheckCircle2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface NotificationPreference {
  workflow_assigned: boolean;
  workflow_completed: boolean;
  workflow_rejected: boolean;
  workflow_escalated: boolean;
  document_shared: boolean;
  document_updated: boolean;
  document_commented: boolean;
  system_maintenance: boolean;
  security_alerts: boolean;
  email_address?: string;
  phone_number?: string;
  slack_user_id?: string;
  teams_user_id?: string;
  is_active: boolean;
}

interface UserNotificationPreferences {
  email: NotificationPreference;
  sms: NotificationPreference;
  push: NotificationPreference;
  slack: NotificationPreference;
  teams: NotificationPreference;
}

const NotificationPreferences: React.FC = () => {
  const [preferences, setPreferences] = useState<UserNotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  const notificationTypes = [
    { key: 'email', label: 'Email', icon: Mail, description: 'Email notifications to your inbox' },
    { key: 'sms', label: 'SMS', icon: Smartphone, description: 'Text messages to your phone' },
    { key: 'push', label: 'Push', icon: Bell, description: 'Browser push notifications' },
    { key: 'slack', label: 'Slack', icon: MessageSquare, description: 'Messages in Slack channels' },
    { key: 'teams', label: 'Teams', icon: Users, description: 'Microsoft Teams notifications' }
  ];

  const eventTypes = [
    { key: 'workflow_assigned', label: 'Workflow Assigned', description: 'When a workflow is assigned to you', priority: 'high' },
    { key: 'workflow_completed', label: 'Workflow Completed', description: 'When your workflow is completed', priority: 'medium' },
    { key: 'workflow_rejected', label: 'Workflow Rejected', description: 'When your workflow is rejected', priority: 'high' },
    { key: 'workflow_escalated', label: 'Workflow Escalated', description: 'When a workflow is escalated', priority: 'high' },
    { key: 'document_shared', label: 'Document Shared', description: 'When a document is shared with you', priority: 'medium' },
    { key: 'document_updated', label: 'Document Updated', description: 'When a shared document is updated', priority: 'low' },
    { key: 'document_commented', label: 'Document Commented', description: 'When someone comments on your document', priority: 'medium' },
    { key: 'system_maintenance', label: 'System Maintenance', description: 'System maintenance notifications', priority: 'low' },
    { key: 'security_alerts', label: 'Security Alerts', description: 'Important security notifications', priority: 'high' }
  ];

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/v1/notifications/preferences/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences);
      } else {
        // Initialize with defaults if no preferences exist
        const defaultPrefs: UserNotificationPreferences = {
          email: createDefaultPreference(),
          sms: createDefaultPreference(false),
          push: createDefaultPreference(),
          slack: createDefaultPreference(false),
          teams: createDefaultPreference(false)
        };
        setPreferences(defaultPrefs);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
      toast({
        title: "Error",
        description: "Failed to load notification preferences",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createDefaultPreference = (isActive = true): NotificationPreference => ({
    workflow_assigned: true,
    workflow_completed: true,
    workflow_rejected: true,
    workflow_escalated: true,
    document_shared: true,
    document_updated: false,
    document_commented: true,
    system_maintenance: true,
    security_alerts: true,
    is_active: isActive
  });

  const handlePreferenceChange = (
    notificationType: keyof UserNotificationPreferences,
    field: keyof NotificationPreference,
    value: boolean | string
  ) => {
    if (!preferences) return;

    setPreferences(prev => ({
      ...prev!,
      [notificationType]: {
        ...prev![notificationType],
        [field]: value
      }
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!preferences || !hasChanges) return;

    setSaving(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/v1/notifications/preferences/me', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(preferences)
      });

      if (response.ok) {
        setHasChanges(false);
        toast({
          title: "Success",
          description: "Notification preferences updated successfully"
        });
      } else {
        throw new Error('Failed to update preferences');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        title: "Error",
        description: "Failed to save notification preferences",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load notification preferences. Please refresh the page.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Notification Preferences</h2>
          <p className="text-muted-foreground">
            Manage how you receive notifications from the system
          </p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={!hasChanges || saving}
          className="flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {hasChanges && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            You have unsaved changes. Click "Save Changes" to apply them.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="email" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          {notificationTypes.map(type => {
            const Icon = type.icon;
            const isActive = preferences[type.key as keyof UserNotificationPreferences]?.is_active;
            
            return (
              <TabsTrigger 
                key={type.key} 
                value={type.key}
                className="flex items-center gap-2"
              >
                <Icon className="h-4 w-4" />
                {type.label}
                {isActive && <div className="w-2 h-2 bg-green-500 rounded-full" />}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {notificationTypes.map(type => {
          const preference = preferences[type.key as keyof UserNotificationPreferences];
          const Icon = type.icon;

          return (
            <TabsContent key={type.key} value={type.key}>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className="h-6 w-6" />
                      <div>
                        <CardTitle>{type.label} Notifications</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {type.description}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={preference.is_active}
                      onCheckedChange={(checked) => 
                        handlePreferenceChange(type.key as keyof UserNotificationPreferences, 'is_active', checked)
                      }
                    />
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  {preference.is_active && (
                    <>
                      {/* Delivery Settings */}
                      <div className="space-y-4">
                        <h4 className="font-medium">Delivery Settings</h4>
                        
                        {type.key === 'email' && (
                          <div className="space-y-2">
                            <Label htmlFor={`${type.key}-address`}>Email Address (optional)</Label>
                            <Input
                              id={`${type.key}-address`}
                              type="email"
                              placeholder="Use account email if empty"
                              value={preference.email_address || ''}
                              onChange={(e) => 
                                handlePreferenceChange(type.key as keyof UserNotificationPreferences, 'email_address', e.target.value)
                              }
                            />
                          </div>
                        )}

                        {type.key === 'sms' && (
                          <div className="space-y-2">
                            <Label htmlFor={`${type.key}-phone`}>Phone Number</Label>
                            <Input
                              id={`${type.key}-phone`}
                              type="tel"
                              placeholder="+1 (555) 123-4567"
                              value={preference.phone_number || ''}
                              onChange={(e) => 
                                handlePreferenceChange(type.key as keyof UserNotificationPreferences, 'phone_number', e.target.value)
                              }
                            />
                          </div>
                        )}

                        {type.key === 'slack' && (
                          <div className="space-y-2">
                            <Label htmlFor={`${type.key}-user`}>Slack User ID</Label>
                            <Input
                              id={`${type.key}-user`}
                              placeholder="@username or user ID"
                              value={preference.slack_user_id || ''}
                              onChange={(e) => 
                                handlePreferenceChange(type.key as keyof UserNotificationPreferences, 'slack_user_id', e.target.value)
                              }
                            />
                          </div>
                        )}

                        {type.key === 'teams' && (
                          <div className="space-y-2">
                            <Label htmlFor={`${type.key}-user`}>Teams User ID</Label>
                            <Input
                              id={`${type.key}-user`}
                              placeholder="Teams user ID or email"
                              value={preference.teams_user_id || ''}
                              onChange={(e) => 
                                handlePreferenceChange(type.key as keyof UserNotificationPreferences, 'teams_user_id', e.target.value)
                              }
                            />
                          </div>
                        )}
                      </div>

                      {/* Event Preferences */}
                      <div className="space-y-4">
                        <h4 className="font-medium">Event Preferences</h4>
                        <p className="text-sm text-muted-foreground">
                          Choose which events trigger {type.label.toLowerCase()} notifications
                        </p>
                        
                        <div className="grid gap-4">
                          {eventTypes.map(event => (
                            <div key={event.key} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center gap-3">
                                <Switch
                                  checked={preference[event.key as keyof NotificationPreference] as boolean}
                                  onCheckedChange={(checked) => 
                                    handlePreferenceChange(
                                      type.key as keyof UserNotificationPreferences,
                                      event.key as keyof NotificationPreference,
                                      checked
                                    )
                                  }
                                />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{event.label}</span>
                                    <Badge variant={getPriorityColor(event.priority)}>
                                      {event.priority}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {event.description}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {!preference.is_active && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Icon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>{type.label} notifications are disabled</p>
                      <p className="text-sm">Enable them using the switch above</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
};

export default NotificationPreferences;