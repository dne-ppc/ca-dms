import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Alert, AlertDescription } from '../ui/alert';
import { Separator } from '../ui/separator';
import {
  Shield,
  ShieldCheck,
  ShieldX,
  Key,
  Eye,
  AlertTriangle,
  Activity,
  Lock,
  Unlock,
  Clock,
  Globe,
  Settings
} from 'lucide-react';
import { TwoFactorManager } from './TwoFactorManager';
import { SSOLogin } from './SSOLogin';

interface SecurityDashboardProps {
  className?: string;
}

interface SecurityMetrics {
  last_login: string;
  login_attempts_today: number;
  active_sessions: number;
  password_last_changed: string;
  account_created: string;
}

export function SecurityDashboard({ className }: SecurityDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [metrics, setMetrics] = useState<SecurityMetrics>({
    last_login: '2024-01-15T10:30:00Z',
    login_attempts_today: 3,
    active_sessions: 2,
    password_last_changed: '2023-12-01T15:20:00Z',
    account_created: '2023-06-15T09:00:00Z'
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPasswordAge = () => {
    const lastChanged = new Date(metrics.password_last_changed);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - lastChanged.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff;
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Security Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Overview
          </CardTitle>
          <CardDescription>
            Your account security status and recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <ShieldCheck className="h-8 w-8 mx-auto text-green-600 mb-2" />
              <div className="font-semibold text-green-600">Strong</div>
              <div className="text-sm text-gray-600">Security Level</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <Key className="h-8 w-8 mx-auto text-blue-600 mb-2" />
              <div className="font-semibold text-blue-600">2FA Enabled</div>
              <div className="text-sm text-gray-600">Two-Factor Auth</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <Globe className="h-8 w-8 mx-auto text-purple-600 mb-2" />
              <div className="font-semibold text-purple-600">SSO Ready</div>
              <div className="text-sm text-gray-600">Single Sign-On</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-blue-600" />
              <div>
                <div className="font-semibold">Last Login</div>
                <div className="text-sm text-gray-600">
                  {formatDate(metrics.last_login)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Activity className="h-8 w-8 text-green-600" />
              <div>
                <div className="font-semibold">{metrics.login_attempts_today}</div>
                <div className="text-sm text-gray-600">Login Attempts Today</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Unlock className="h-8 w-8 text-orange-600" />
              <div>
                <div className="font-semibold">{metrics.active_sessions}</div>
                <div className="text-sm text-gray-600">Active Sessions</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Lock className="h-8 w-8 text-purple-600" />
              <div>
                <div className="font-semibold">{getPasswordAge()} days</div>
                <div className="text-sm text-gray-600">Password Age</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Security Recommendations</CardTitle>
          <CardDescription>
            Actions to improve your account security
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {getPasswordAge() > 90 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Your password is {getPasswordAge()} days old. Consider changing it for better security.
                  <Button variant="link" className="p-0 h-auto ml-2">
                    Change Password
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-green-600" />
                <div>
                  <div className="font-medium">Two-Factor Authentication</div>
                  <div className="text-sm text-gray-600">Enabled and active</div>
                </div>
              </div>
              <Badge variant="default">Complete</Badge>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Eye className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-medium">Account Activity Review</div>
                  <div className="text-sm text-gray-600">Check recent login activity</div>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Review
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-purple-600" />
                <div>
                  <div className="font-medium">Session Management</div>
                  <div className="text-sm text-gray-600">Manage active sessions</div>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Manage
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Security Activity</CardTitle>
          <CardDescription>
            Recent security-related actions on your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              <div className="flex-1">
                <div className="font-medium">Successful login</div>
                <div className="text-sm text-gray-600">
                  {formatDate(metrics.last_login)} • Chrome on Windows
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <Key className="h-5 w-5 text-blue-600" />
              <div className="flex-1">
                <div className="font-medium">2FA verification successful</div>
                <div className="text-sm text-gray-600">
                  {formatDate(metrics.last_login)} • TOTP authenticator
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Activity className="h-5 w-5 text-gray-600" />
              <div className="flex-1">
                <div className="font-medium">Session started</div>
                <div className="text-sm text-gray-600">
                  {formatDate(metrics.last_login)} • Web browser
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t">
            <Button variant="outline" className="w-full">
              View Full Activity Log
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className={className}>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Security Settings</h1>
        <p className="text-gray-600 mt-2">
          Manage your account security settings and monitor activity
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="two-factor">Two-Factor Auth</TabsTrigger>
          <TabsTrigger value="sso">Single Sign-On</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          {renderOverview()}
        </TabsContent>

        <TabsContent value="two-factor" className="mt-6">
          <TwoFactorManager />
        </TabsContent>

        <TabsContent value="sso" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Single Sign-On</CardTitle>
              <CardDescription>
                Manage SSO connections and settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4">
                <Globe className="h-4 w-4" />
                <AlertDescription>
                  SSO (Single Sign-On) allows you to sign in using your organization's
                  identity provider like Google, Microsoft, or SAML.
                </AlertDescription>
              </Alert>

              <SSOLogin
                onSuccess={() => console.log('SSO Success')}
                onError={(error) => console.error('SSO Error:', error)}
              />

              <Separator className="my-6" />

              <div className="space-y-4">
                <h4 className="font-semibold">Connected Accounts</h4>
                <p className="text-sm text-gray-600">
                  You haven't connected any SSO accounts yet. Use the options above
                  to link your organization's identity provider.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}