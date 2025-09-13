import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Separator } from '../ui/separator';
import { Shield, Globe, Building, Github, Mail, AlertTriangle } from 'lucide-react';

interface SSOProvider {
  id: string;
  name: string;
  provider_type: string;
  is_enabled: boolean;
  redirect_uri: string;
  allowed_domains?: string[];
}

interface SSOLoginProps {
  onSuccess?: (user: any) => void;
  onError?: (error: string) => void;
  redirectUrl?: string;
}

export function SSOLogin({ onSuccess, onError, redirectUrl }: SSOLoginProps) {
  const [providers, setProviders] = useState<SSOProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      const response = await fetch('/api/v1/security/sso/providers');

      if (!response.ok) {
        throw new Error('Failed to load SSO providers');
      }

      const data = await response.json();
      setProviders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load providers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSSOLogin = async (providerId: string) => {
    setLoadingProvider(providerId);
    setError(null);

    try {
      // Initiate SSO login
      const response = await fetch('/api/v1/security/sso/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider_id: providerId,
          redirect_url: redirectUrl,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to initiate SSO login');
      }

      const data = await response.json();

      // Redirect to SSO provider
      window.location.href = data.authorization_url;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'SSO login failed';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoadingProvider(null);
    }
  };

  const getProviderIcon = (providerType: string) => {
    switch (providerType.toLowerCase()) {
      case 'oauth2_google':
        return <Globe className="h-5 w-5" />;
      case 'oauth2_microsoft':
        return <Building className="h-5 w-5" />;
      case 'oauth2_github':
        return <Github className="h-5 w-5" />;
      case 'saml':
        return <Shield className="h-5 w-5" />;
      default:
        return <Shield className="h-5 w-5" />;
    }
  };

  const getProviderDisplayName = (providerType: string, name: string) => {
    switch (providerType.toLowerCase()) {
      case 'oauth2_google':
        return 'Google';
      case 'oauth2_microsoft':
        return 'Microsoft';
      case 'oauth2_github':
        return 'GitHub';
      case 'saml':
        return name || 'SAML Provider';
      default:
        return name;
    }
  };

  const getProviderDescription = (providerType: string, allowedDomains?: string[]) => {
    const baseDescription = (() => {
      switch (providerType.toLowerCase()) {
        case 'oauth2_google':
          return 'Sign in with your Google account';
        case 'oauth2_microsoft':
          return 'Sign in with your Microsoft account';
        case 'oauth2_github':
          return 'Sign in with your GitHub account';
        case 'saml':
          return 'Sign in with your organization\'s SAML provider';
        default:
          return 'Sign in with single sign-on';
      }
    })();

    if (allowedDomains && allowedDomains.length > 0) {
      return `${baseDescription} (${allowedDomains.join(', ')})`;
    }

    return baseDescription;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Loading sign-in options...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (providers.length === 0) {
    return null; // Don't show SSO section if no providers are configured
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Single Sign-On
        </CardTitle>
        <CardDescription>
          Sign in using your organization's identity provider
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          {providers.map((provider, index) => (
            <div key={provider.id}>
              <Button
                variant="outline"
                className="w-full justify-start h-auto p-4"
                onClick={() => handleSSOLogin(provider.id)}
                disabled={loadingProvider === provider.id}
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="flex-shrink-0">
                    {getProviderIcon(provider.provider_type)}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium">
                      {getProviderDisplayName(provider.provider_type, provider.name)}
                    </div>
                    <div className="text-sm text-gray-600">
                      {getProviderDescription(provider.provider_type, provider.allowed_domains)}
                    </div>
                  </div>
                  {loadingProvider === provider.id && (
                    <div className="flex-shrink-0">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                </div>
              </Button>
              {index < providers.length - 1 && <div className="my-2" />}
            </div>
          ))}
        </div>

        {providers.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-gray-500 text-center">
              By signing in with SSO, you agree to your organization's access policies
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// SSO Callback Handler Component
export function SSOCallbackHandler() {
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');
    const providerId = urlParams.get('provider_id') || sessionStorage.getItem('sso_provider_id');

    if (error) {
      setError(`SSO Error: ${error}`);
      setIsProcessing(false);
      return;
    }

    if (!code || !providerId) {
      setError('Missing required SSO parameters');
      setIsProcessing(false);
      return;
    }

    try {
      const response = await fetch('/api/v1/security/sso/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider_id: providerId,
          code,
          state,
        }),
      });

      if (!response.ok) {
        throw new Error('SSO authentication failed');
      }

      const data = await response.json();

      // Store tokens
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);

      // Clean up session storage
      sessionStorage.removeItem('sso_provider_id');

      // Redirect to dashboard or intended page
      const redirectUrl = sessionStorage.getItem('redirect_after_login') || '/dashboard';
      sessionStorage.removeItem('redirect_after_login');
      window.location.href = redirectUrl;

    } catch (err) {
      setError(err instanceof Error ? err.message : 'SSO authentication failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          {isProcessing ? (
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold mb-2">Completing Sign-In</h3>
              <p className="text-gray-600">Please wait while we verify your credentials...</p>
            </div>
          ) : error ? (
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 mx-auto text-red-600 mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-red-600">Sign-In Failed</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={() => window.location.href = '/login'}>
                Return to Login
              </Button>
            </div>
          ) : (
            <div className="text-center">
              <Shield className="h-12 w-12 mx-auto text-green-600 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Sign-In Successful</h3>
              <p className="text-gray-600">Redirecting you now...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}