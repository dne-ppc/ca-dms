import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Separator } from '../ui/separator';
import { Shield, ShieldCheck, ShieldX, Smartphone, Mail, Key, AlertTriangle, Settings } from 'lucide-react';
import { TwoFactorSetup } from './TwoFactorSetup';

interface TwoFactorMethod {
  method: string;
  is_enabled: boolean;
  is_verified: boolean;
  last_used_at: string | null;
}

interface TwoFactorStatus {
  is_enabled: boolean;
  methods: TwoFactorMethod[];
  backup_codes_remaining: number;
}

export function TwoFactorManager() {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/security/2fa/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load 2FA status');
      }

      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupComplete = () => {
    setShowSetup(false);
    loadStatus(); // Reload status
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'totp':
        return <Smartphone className="h-4 w-4" />;
      case 'sms':
        return <Mail className="h-4 w-4" />;
      case 'backup_codes':
        return <Key className="h-4 w-4" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  const getMethodName = (method: string) => {
    switch (method) {
      case 'totp':
        return 'Authenticator App';
      case 'sms':
        return 'SMS Messages';
      case 'backup_codes':
        return 'Backup Codes';
      default:
        return method;
    }
  };

  const formatLastUsed = (lastUsed: string | null) => {
    if (!lastUsed) return 'Never';
    return new Date(lastUsed).toLocaleDateString();
  };

  if (isLoading && !status) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Loading 2FA settings...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (showSetup) {
    return (
      <TwoFactorSetup
        onSetupComplete={handleSetupComplete}
        onCancel={() => setShowSetup(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {status?.is_enabled ? (
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                ) : (
                  <ShieldX className="h-5 w-5 text-red-600" />
                )}
                Two-Factor Authentication
              </CardTitle>
              <CardDescription>
                {status?.is_enabled
                  ? 'Your account is protected with 2FA'
                  : 'Add an extra layer of security to your account'
                }
              </CardDescription>
            </div>
            <Badge variant={status?.is_enabled ? 'default' : 'destructive'}>
              {status?.is_enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!status?.is_enabled ? (
            <div className="text-center py-6">
              <Shield className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Two-Factor Authentication is Disabled</h3>
              <p className="text-gray-600 mb-6">
                Protect your account by enabling 2FA. This adds an extra layer of security
                by requiring a second form of verification when signing in.
              </p>
              <Button onClick={() => setShowSetup(true)}>
                <Shield className="h-4 w-4 mr-2" />
                Enable 2FA
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-green-600">2FA is Active</h4>
                  <p className="text-sm text-gray-600">
                    Your account is protected with two-factor authentication
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDisableDialog(true)}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Manage
                </Button>
              </div>

              {/* Backup Codes Warning */}
              {status.backup_codes_remaining <= 2 && status.backup_codes_remaining > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    You have {status.backup_codes_remaining} backup codes remaining.
                    Consider generating new ones soon.
                  </AlertDescription>
                </Alert>
              )}

              {status.backup_codes_remaining === 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    You have no backup codes remaining. Generate new ones to ensure
                    you can access your account if you lose your device.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Methods */}
      {status?.is_enabled && status.methods.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active 2FA Methods</CardTitle>
            <CardDescription>
              Methods you can use for two-factor authentication
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {status.methods
                .filter(method => method.is_enabled)
                .map((method, index) => (
                  <div key={index}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getMethodIcon(method.method)}
                        <div>
                          <div className="font-medium">{getMethodName(method.method)}</div>
                          <div className="text-sm text-gray-600">
                            Last used: {formatLastUsed(method.last_used_at)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={method.is_verified ? 'default' : 'secondary'}>
                          {method.is_verified ? 'Active' : 'Pending'}
                        </Badge>
                      </div>
                    </div>
                    {index < status.methods.filter(m => m.is_enabled).length - 1 && (
                      <Separator className="mt-4" />
                    )}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Additional Options */}
      {status?.is_enabled && (
        <Card>
          <CardHeader>
            <CardTitle>Additional Options</CardTitle>
            <CardDescription>
              Manage your 2FA settings and backup options
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Backup Codes</div>
                <div className="text-sm text-gray-600">
                  {status.backup_codes_remaining} codes remaining
                </div>
              </div>
              <Button variant="outline" size="sm">
                View Codes
              </Button>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Add Another Method</div>
                <div className="text-sm text-gray-600">
                  Set up additional 2FA methods for backup
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSetup(true)}
              >
                Add Method
              </Button>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-red-600">Disable 2FA</div>
                <div className="text-sm text-gray-600">
                  Remove two-factor authentication from your account
                </div>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDisableDialog(true)}
              >
                Disable
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Disable Dialog (simplified) */}
      {showDisableDialog && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Disable Two-Factor Authentication</CardTitle>
            <CardDescription>
              This will remove the extra security layer from your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> Disabling 2FA will make your account less secure.
                You'll only need your password to sign in.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDisableDialog(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  // Handle disable logic here
                  setShowDisableDialog(false);
                }}
              >
                Disable 2FA
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}