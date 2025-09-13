import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Shield, Smartphone, Mail, Key, Copy, Check, AlertTriangle } from 'lucide-react';

interface TwoFactorSetupProps {
  onSetupComplete?: () => void;
  onCancel?: () => void;
}

interface TOTPSetupData {
  secret: string;
  qr_code_url: string;
  backup_codes: string[];
}

export function TwoFactorSetup({ onSetupComplete, onCancel }: TwoFactorSetupProps) {
  const [currentStep, setCurrentStep] = useState<'select' | 'setup' | 'verify'>('select');
  const [selectedMethod, setSelectedMethod] = useState<'totp' | 'sms' | null>(null);
  const [setupData, setSetupData] = useState<TOTPSetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  const handleMethodSelect = (method: 'totp' | 'sms') => {
    setSelectedMethod(method);
    setCurrentStep('setup');
    if (method === 'totp') {
      setupTOTP();
    }
  };

  const setupTOTP = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/security/2fa/totp/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Failed to setup TOTP');
      }

      const data: TOTPSetupData = await response.json();
      setSetupData(data);
      setCurrentStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setIsLoading(false);
    }
  };

  const setupSMS = async () => {
    if (!phoneNumber) {
      setError('Phone number is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/security/2fa/sms/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({ phone_number: phoneNumber }),
      });

      if (!response.ok) {
        throw new Error('Failed to setup SMS 2FA');
      }

      setCurrentStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SMS setup not yet implemented');
    } finally {
      setIsLoading(false);
    }
  };

  const verifySetup = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const endpoint = selectedMethod === 'totp'
        ? '/api/v1/security/2fa/totp/verify'
        : '/api/v1/security/2fa/sms/verify';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({ code: verificationCode }),
      });

      if (!response.ok) {
        throw new Error('Verification failed');
      }

      onSetupComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates(prev => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [key]: false }));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const renderMethodSelection = () => (
    <div className="space-y-4">
      <div className="text-center">
        <Shield className="h-12 w-12 mx-auto text-blue-600 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Choose 2FA Method</h3>
        <p className="text-gray-600 mb-6">
          Select your preferred two-factor authentication method to secure your account.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-blue-300"
          onClick={() => handleMethodSelect('totp')}
        >
          <CardContent className="p-6 text-center">
            <Smartphone className="h-8 w-8 mx-auto text-blue-600 mb-3" />
            <h4 className="font-semibold mb-2">Authenticator App</h4>
            <p className="text-sm text-gray-600 mb-3">
              Use Google Authenticator, Authy, or other TOTP apps
            </p>
            <Badge variant="secondary">Recommended</Badge>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-blue-300 opacity-50"
          onClick={() => handleMethodSelect('sms')}
        >
          <CardContent className="p-6 text-center">
            <Mail className="h-8 w-8 mx-auto text-blue-600 mb-3" />
            <h4 className="font-semibold mb-2">SMS Messages</h4>
            <p className="text-sm text-gray-600 mb-3">
              Receive codes via text message
            </p>
            <Badge variant="outline">Coming Soon</Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderTOTPSetup = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Key className="h-12 w-12 mx-auto text-blue-600 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Setup Authenticator App</h3>
        <p className="text-gray-600">
          Scan the QR code or enter the secret key manually in your authenticator app.
        </p>
      </div>

      {setupData && (
        <Tabs defaultValue="qr" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="qr">QR Code</TabsTrigger>
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
          </TabsList>

          <TabsContent value="qr" className="space-y-4">
            <div className="flex justify-center">
              <div className="bg-white p-4 rounded-lg border">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupData.qr_code_url)}`}
                  alt="2FA QR Code"
                  className="w-48 h-48"
                />
              </div>
            </div>
            <p className="text-sm text-gray-600 text-center">
              Scan this QR code with your authenticator app
            </p>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
            <div>
              <Label htmlFor="secret">Secret Key</Label>
              <div className="flex mt-1">
                <Input
                  id="secret"
                  value={setupData.secret}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ml-2"
                  onClick={() => copyToClipboard(setupData.secret, 'secret')}
                >
                  {copiedStates.secret ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              Enter this secret key manually in your authenticator app if you can't scan the QR code.
            </p>
          </TabsContent>
        </Tabs>
      )}

      {/* Backup Codes */}
      {setupData && (
        <div className="mt-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> Save these backup codes in a secure location.
              You can use them to access your account if you lose your authenticator device.
            </AlertDescription>
          </Alert>

          <div className="mt-4">
            <Label>Backup Recovery Codes</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {setupData.backup_codes.map((code, index) => (
                <div key={index} className="flex items-center">
                  <Input
                    value={code}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="ml-2"
                    onClick={() => copyToClipboard(code, `backup-${index}`)}
                  >
                    {copiedStates[`backup-${index}`] ?
                      <Check className="h-4 w-4" /> :
                      <Copy className="h-4 w-4" />
                    }
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderSMSSetup = () => (
    <div className="space-y-4">
      <div className="text-center">
        <Mail className="h-12 w-12 mx-auto text-blue-600 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Setup SMS 2FA</h3>
        <p className="text-gray-600">
          Enter your phone number to receive verification codes via SMS.
        </p>
      </div>

      <div>
        <Label htmlFor="phone">Phone Number</Label>
        <Input
          id="phone"
          type="tel"
          placeholder="+1234567890"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          className="mt-1"
        />
        <p className="text-xs text-gray-500 mt-1">
          Include country code (e.g., +1 for US)
        </p>
      </div>

      <Button
        onClick={setupSMS}
        disabled={isLoading || !phoneNumber}
        className="w-full"
      >
        {isLoading ? 'Setting up...' : 'Send Verification Code'}
      </Button>
    </div>
  );

  const renderVerification = () => (
    <div className="space-y-4">
      <div className="text-center">
        <Shield className="h-12 w-12 mx-auto text-green-600 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Verify Setup</h3>
        <p className="text-gray-600">
          {selectedMethod === 'totp'
            ? 'Enter the 6-digit code from your authenticator app'
            : 'Enter the 6-digit code sent to your phone'
          }
        </p>
      </div>

      <div>
        <Label htmlFor="code">Verification Code</Label>
        <Input
          id="code"
          type="text"
          placeholder="123456"
          value={verificationCode}
          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="mt-1 text-center text-lg tracking-widest"
          maxLength={6}
        />
      </div>

      <Button
        onClick={verifySetup}
        disabled={isLoading || verificationCode.length !== 6}
        className="w-full"
      >
        {isLoading ? 'Verifying...' : 'Verify & Enable 2FA'}
      </Button>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'select':
        return renderMethodSelection();
      case 'setup':
        return selectedMethod === 'totp' ? renderTOTPSetup() : renderSMSSetup();
      case 'verify':
        return renderVerification();
      default:
        return null;
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Enable Two-Factor Authentication</CardTitle>
        <CardDescription>
          Add an extra layer of security to your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {renderCurrentStep()}

        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>

          {currentStep !== 'select' && (
            <Button
              variant="outline"
              onClick={() => {
                if (currentStep === 'verify') {
                  setCurrentStep('setup');
                } else {
                  setCurrentStep('select');
                  setSelectedMethod(null);
                  setSetupData(null);
                }
                setError(null);
                setVerificationCode('');
              }}
              disabled={isLoading}
            >
              Back
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}