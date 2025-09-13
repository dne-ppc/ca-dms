import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  Alert,
  Tabs,
  Tab,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Settings as SettingsIcon,
  CloudQueue as CloudIcon,
  Security as SecurityIcon,
  Assessment as AssessmentIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

interface SignatureProvider {
  id: string;
  name: string;
  provider_type: 'docusign' | 'adobe_sign' | 'certificate_based' | 'internal';
  is_active: boolean;
  api_endpoint?: string;
  client_id?: string;
  configuration?: Record<string, any>;
  supported_file_types?: string[];
  max_file_size_mb: number;
  compliance_frameworks?: string[];
  requests_per_minute: number;
  requests_per_day: number;
  created_at: string;
  updated_at: string;
}

interface ProviderStats {
  provider_id: string;
  provider_name: string;
  total_requests: number;
  success_rate: number;
  average_response_time_seconds?: number;
  last_used?: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`provider-tabpanel-${index}`}
      aria-labelledby={`provider-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const SignatureProviderManager: React.FC = () => {
  const [providers, setProviders] = useState<SignatureProvider[]>([]);
  const [stats, setStats] = useState<ProviderStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<SignatureProvider | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  const [formData, setFormData] = useState({
    name: '',
    provider_type: 'docusign' as const,
    is_active: true,
    api_endpoint: '',
    client_id: '',
    api_key: '',
    max_file_size_mb: 10,
    requests_per_minute: 60,
    requests_per_day: 1000,
    compliance_frameworks: [] as string[],
    supported_file_types: ['pdf'] as string[]
  });

  useEffect(() => {
    loadProviders();
    loadStats();
  }, []);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/digital-signatures/providers', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load providers');
      }

      const data = await response.json();
      setProviders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load providers');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/v1/digital-signatures/providers/statistics', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to load provider statistics:', err);
    }
  };

  const handleCreate = () => {
    setEditingProvider(null);
    setFormData({
      name: '',
      provider_type: 'docusign',
      is_active: true,
      api_endpoint: '',
      client_id: '',
      api_key: '',
      max_file_size_mb: 10,
      requests_per_minute: 60,
      requests_per_day: 1000,
      compliance_frameworks: [],
      supported_file_types: ['pdf']
    });
    setDialogOpen(true);
  };

  const handleEdit = (provider: SignatureProvider) => {
    setEditingProvider(provider);
    setFormData({
      name: provider.name,
      provider_type: provider.provider_type,
      is_active: provider.is_active,
      api_endpoint: provider.api_endpoint || '',
      client_id: provider.client_id || '',
      api_key: '',
      max_file_size_mb: provider.max_file_size_mb,
      requests_per_minute: provider.requests_per_minute,
      requests_per_day: provider.requests_per_day,
      compliance_frameworks: provider.compliance_frameworks || [],
      supported_file_types: provider.supported_file_types || ['pdf']
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const url = editingProvider
        ? `/api/v1/digital-signatures/providers/${editingProvider.id}`
        : '/api/v1/digital-signatures/providers';

      const method = editingProvider ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        configuration: getProviderConfiguration(formData.provider_type)
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to save provider');
      }

      setDialogOpen(false);
      loadProviders();
      loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save provider');
    }
  };

  const getProviderConfiguration = (providerType: string) => {
    switch (providerType) {
      case 'docusign':
        return {
          webhook_endpoint: '/api/v1/digital-signatures/webhook/docusign',
          sandbox_mode: true,
          authentication_method: 'jwt'
        };
      case 'adobe_sign':
        return {
          webhook_endpoint: '/api/v1/digital-signatures/webhook/adobe-sign',
          sandbox_mode: true,
          api_version: 'v6'
        };
      case 'certificate_based':
        return {
          certificate_store: '/app/certificates',
          validation_level: 'standard',
          timestamp_server: 'http://timestamp.digicert.com'
        };
      default:
        return {};
    }
  };

  const getProviderIcon = (type: string) => {
    switch (type) {
      case 'docusign':
        return <CloudIcon color="primary" />;
      case 'adobe_sign':
        return <CloudIcon color="secondary" />;
      case 'certificate_based':
        return <SecurityIcon color="warning" />;
      case 'internal':
        return <SettingsIcon color="action" />;
      default:
        return <SettingsIcon />;
    }
  };

  const getStatusChip = (isActive: boolean) => {
    return (
      <Chip
        label={isActive ? 'Active' : 'Inactive'}
        color={isActive ? 'success' : 'default'}
        size="small"
        icon={isActive ? <CheckCircleIcon /> : <ErrorIcon />}
      />
    );
  };

  const formatProviderType = (type: string) => {
    const types: Record<string, string> = {
      docusign: 'DocuSign',
      adobe_sign: 'Adobe Sign',
      certificate_based: 'Certificate-based',
      internal: 'Internal'
    };
    return types[type] || type;
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 0.9) return 'success';
    if (rate >= 0.7) return 'warning';
    return 'error';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading signature providers...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Digital Signature Providers
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreate}
        >
          Add Provider
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="Providers" />
          <Tab label="Statistics" />
          <Tab label="Configuration" />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Provider</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>File Types</TableCell>
                  <TableCell>Rate Limits</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {providers.map((provider) => (
                  <TableRow key={provider.id}>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        {getProviderIcon(provider.provider_type)}
                        <Typography variant="subtitle2">
                          {provider.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {formatProviderType(provider.provider_type)}
                    </TableCell>
                    <TableCell>
                      {getStatusChip(provider.is_active)}
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={0.5}>
                        {provider.supported_file_types?.map((type) => (
                          <Chip key={type} label={type.toUpperCase()} size="small" variant="outlined" />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {provider.requests_per_minute}/min
                        <br />
                        {provider.requests_per_day}/day
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(provider)}
                        title="Edit Provider"
                      >
                        <EditIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <Grid container spacing={3}>
            {stats.map((stat) => (
              <Grid item xs={12} md={6} lg={4} key={stat.provider_id}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    {stat.provider_name}
                  </Typography>
                  <Box display="flex" flexDirection="column" gap={1}>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        Total Requests:
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {stat.total_requests}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        Success Rate:
                      </Typography>
                      <Chip
                        label={`${(stat.success_rate * 100).toFixed(1)}%`}
                        size="small"
                        color={getSuccessRateColor(stat.success_rate)}
                      />
                    </Box>
                    {stat.average_response_time_seconds && (
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Avg Response:
                        </Typography>
                        <Typography variant="body2">
                          {stat.average_response_time_seconds.toFixed(2)}s
                        </Typography>
                      </Box>
                    )}
                    {stat.last_used && (
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Last Used:
                        </Typography>
                        <Typography variant="body2">
                          {new Date(stat.last_used).toLocaleDateString()}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <List>
            <ListItem>
              <ListItemIcon>
                <SecurityIcon />
              </ListItemIcon>
              <ListItemText
                primary="Compliance Frameworks"
                secondary="ESIGN Act, UETA, eIDAS compliance validation enabled"
              />
            </ListItem>
            <Divider />
            <ListItem>
              <ListItemIcon>
                <AssessmentIcon />
              </ListItemIcon>
              <ListItemText
                primary="Audit Logging"
                secondary="Comprehensive audit trail for all signature events"
              />
            </ListItem>
            <Divider />
            <ListItem>
              <ListItemIcon>
                <WarningIcon />
              </ListItemIcon>
              <ListItemText
                primary="Rate Limiting"
                secondary="Automatic rate limiting and throttling protection"
              />
            </ListItem>
          </List>
        </TabPanel>
      </Card>

      {/* Provider Creation/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingProvider ? 'Edit Provider' : 'Create New Provider'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Provider Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Provider Type</InputLabel>
                <Select
                  value={formData.provider_type}
                  onChange={(e) => setFormData({ ...formData, provider_type: e.target.value as any })}
                  label="Provider Type"
                >
                  <MenuItem value="docusign">DocuSign</MenuItem>
                  <MenuItem value="adobe_sign">Adobe Sign</MenuItem>
                  <MenuItem value="certificate_based">Certificate-based</MenuItem>
                  <MenuItem value="internal">Internal</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="API Endpoint"
                value={formData.api_endpoint}
                onChange={(e) => setFormData({ ...formData, api_endpoint: e.target.value })}
                helperText="Leave empty for default endpoint"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Client ID"
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="API Key"
                type="password"
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                helperText={editingProvider ? "Leave empty to keep existing key" : ""}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Max File Size (MB)"
                type="number"
                value={formData.max_file_size_mb}
                onChange={(e) => setFormData({ ...formData, max_file_size_mb: parseInt(e.target.value) })}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Requests per Minute"
                type="number"
                value={formData.requests_per_minute}
                onChange={(e) => setFormData({ ...formData, requests_per_minute: parseInt(e.target.value) })}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Requests per Day"
                type="number"
                value={formData.requests_per_day}
                onChange={(e) => setFormData({ ...formData, requests_per_day: parseInt(e.target.value) })}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                }
                label="Active"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            {editingProvider ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SignatureProviderManager;