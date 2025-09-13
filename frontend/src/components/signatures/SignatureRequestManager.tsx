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
  Alert,
  Stepper,
  Step,
  StepLabel,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Grid,
  Paper,
  LinearProgress,
  Tooltip,
  Badge
} from '@mui/material';
import {
  Add as AddIcon,
  Send as SendIcon,
  Visibility as ViewIcon,
  Cancel as CancelIcon,
  Download as DownloadIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Pending as PendingIcon,
  Email as EmailIcon,
  Security as SecurityIcon,
  Assignment as AssignmentIcon
} from '@mui/icons-material';

interface SignatureRequest {
  id: string;
  document_id: string;
  provider_id: string;
  title: string;
  message?: string;
  status: 'pending' | 'requested' | 'signed' | 'declined' | 'expired' | 'cancelled' | 'error';
  require_all_signatures: boolean;
  expiration_days: number;
  reminder_frequency_days: number;
  compliance_framework: string;
  authentication_required: boolean;
  requested_at: string;
  expires_at?: string;
  completed_at?: string;
  signatures: Signature[];
  events: SignatureEvent[];
  provider: SignatureProvider;
}

interface Signature {
  id: string;
  signer_name: string;
  signer_email: string;
  signer_role?: string;
  signing_order: number;
  status: 'pending' | 'requested' | 'signed' | 'declined' | 'expired' | 'cancelled';
  signed_at?: string;
  decline_reason?: string;
}

interface SignatureEvent {
  id: string;
  event_type: string;
  event_description?: string;
  occurred_at: string;
  user_id?: string;
}

interface SignatureProvider {
  id: string;
  name: string;
  provider_type: string;
}

interface NewSignatureRequest {
  document_id: string;
  provider_id: string;
  title: string;
  message: string;
  signers: {
    name: string;
    email: string;
    role?: string;
    signing_order: number;
  }[];
  expiration_days: number;
  reminder_frequency_days: number;
  compliance_framework: 'esign_act' | 'ueta' | 'eidas' | 'common_law' | 'custom';
  authentication_required: boolean;
  require_all_signatures: boolean;
}

const SignatureRequestManager: React.FC = () => {
  const [requests, setRequests] = useState<SignatureRequest[]>([]);
  const [providers, setProviders] = useState<SignatureProvider[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<SignatureRequest | null>(null);

  const [newRequest, setNewRequest] = useState<NewSignatureRequest>({
    document_id: '',
    provider_id: '',
    title: '',
    message: '',
    signers: [{ name: '', email: '', role: '', signing_order: 1 }],
    expiration_days: 30,
    reminder_frequency_days: 3,
    compliance_framework: 'esign_act',
    authentication_required: true,
    require_all_signatures: true
  });

  useEffect(() => {
    loadRequests();
    loadProviders();
    loadDocuments();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/digital-signatures/requests', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load signature requests');
      }

      const data = await response.json();
      setRequests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const loadProviders = async () => {
    try {
      const response = await fetch('/api/v1/digital-signatures/providers', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setProviders(data);
      }
    } catch (err) {
      console.error('Failed to load providers:', err);
    }
  };

  const loadDocuments = async () => {
    try {
      const response = await fetch('/api/v1/documents', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  };

  const handleCreateRequest = async () => {
    try {
      const response = await fetch('/api/v1/digital-signatures/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(newRequest)
      });

      if (!response.ok) {
        throw new Error('Failed to create signature request');
      }

      setCreateDialogOpen(false);
      loadRequests();

      // Reset form
      setNewRequest({
        document_id: '',
        provider_id: '',
        title: '',
        message: '',
        signers: [{ name: '', email: '', role: '', signing_order: 1 }],
        expiration_days: 30,
        reminder_frequency_days: 3,
        compliance_framework: 'esign_act',
        authentication_required: true,
        require_all_signatures: true
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create request');
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      const response = await fetch(`/api/v1/digital-signatures/requests/${requestId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ reason: 'Cancelled by user' })
      });

      if (!response.ok) {
        throw new Error('Failed to cancel request');
      }

      loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel request');
    }
  };

  const addSigner = () => {
    setNewRequest({
      ...newRequest,
      signers: [
        ...newRequest.signers,
        {
          name: '',
          email: '',
          role: '',
          signing_order: newRequest.signers.length + 1
        }
      ]
    });
  };

  const removeSigner = (index: number) => {
    const newSigners = newRequest.signers.filter((_, i) => i !== index);
    // Reorder signing orders
    newSigners.forEach((signer, i) => {
      signer.signing_order = i + 1;
    });
    setNewRequest({ ...newRequest, signers: newSigners });
  };

  const updateSigner = (index: number, field: string, value: string | number) => {
    const newSigners = [...newRequest.signers];
    (newSigners[index] as any)[field] = value;
    setNewRequest({ ...newRequest, signers: newSigners });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'signed':
        return <CheckCircleIcon color="success" />;
      case 'declined':
      case 'error':
        return <ErrorIcon color="error" />;
      case 'pending':
      case 'requested':
        return <PendingIcon color="warning" />;
      case 'cancelled':
      case 'expired':
        return <CancelIcon color="disabled" />;
      default:
        return <PendingIcon />;
    }
  };

  const getStatusChip = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pending', color: 'default' as const },
      requested: { label: 'Requested', color: 'info' as const },
      signed: { label: 'Signed', color: 'success' as const },
      declined: { label: 'Declined', color: 'error' as const },
      expired: { label: 'Expired', color: 'warning' as const },
      cancelled: { label: 'Cancelled', color: 'default' as const },
      error: { label: 'Error', color: 'error' as const }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

    return (
      <Chip
        label={config.label}
        color={config.color}
        size="small"
        icon={getStatusIcon(status)}
      />
    );
  };

  const getSignatureProgress = (signatures: Signature[]) => {
    const signed = signatures.filter(s => s.status === 'signed').length;
    const total = signatures.length;
    return { signed, total, progress: total > 0 ? (signed / total) * 100 : 0 };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading signature requests...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Digital Signature Requests
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          New Request
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Document</TableCell>
              <TableCell>Provider</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Progress</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Expires</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {requests.map((request) => {
              const progress = getSignatureProgress(request.signatures);
              return (
                <TableRow key={request.id}>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight="bold">
                      {request.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {request.signatures.length} signer(s)
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {request.provider?.name || 'Unknown'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {getStatusChip(request.status)}
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <LinearProgress
                        variant="determinate"
                        value={progress.progress}
                        sx={{ width: 60, height: 6 }}
                      />
                      <Typography variant="caption">
                        {progress.signed}/{progress.total}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(request.requested_at)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color={
                      request.expires_at && new Date(request.expires_at) < new Date()
                        ? 'error'
                        : 'text.secondary'
                    }>
                      {request.expires_at ? formatDate(request.expires_at) : 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" gap={0.5}>
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedRequest(request);
                            setViewDialogOpen(true);
                          }}
                        >
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      {request.status === 'pending' || request.status === 'requested' ? (
                        <Tooltip title="Cancel Request">
                          <IconButton
                            size="small"
                            onClick={() => handleCancelRequest(request.id)}
                            color="error"
                          >
                            <CancelIcon />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                      {request.status === 'signed' ? (
                        <Tooltip title="Download Signed Document">
                          <IconButton size="small" color="primary">
                            <DownloadIcon />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Request Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Signature Request</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Document</InputLabel>
                <Select
                  value={newRequest.document_id}
                  onChange={(e) => setNewRequest({ ...newRequest, document_id: e.target.value })}
                  label="Document"
                >
                  {documents.map((doc) => (
                    <MenuItem key={doc.id} value={doc.id}>
                      {doc.title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Signature Provider</InputLabel>
                <Select
                  value={newRequest.provider_id}
                  onChange={(e) => setNewRequest({ ...newRequest, provider_id: e.target.value })}
                  label="Signature Provider"
                >
                  {providers.map((provider) => (
                    <MenuItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Compliance Framework</InputLabel>
                <Select
                  value={newRequest.compliance_framework}
                  onChange={(e) => setNewRequest({ ...newRequest, compliance_framework: e.target.value as any })}
                  label="Compliance Framework"
                >
                  <MenuItem value="esign_act">US ESIGN Act</MenuItem>
                  <MenuItem value="ueta">UETA</MenuItem>
                  <MenuItem value="eidas">EU eIDAS</MenuItem>
                  <MenuItem value="common_law">Common Law</MenuItem>
                  <MenuItem value="custom">Custom</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Request Title"
                value={newRequest.title}
                onChange={(e) => setNewRequest({ ...newRequest, title: e.target.value })}
                required
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Message to Signers"
                value={newRequest.message}
                onChange={(e) => setNewRequest({ ...newRequest, message: e.target.value })}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Signers
              </Typography>
              {newRequest.signers.map((signer, index) => (
                <Paper key={index} sx={{ p: 2, mb: 2 }}>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={3}>
                      <TextField
                        fullWidth
                        label="Name"
                        value={signer.name}
                        onChange={(e) => updateSigner(index, 'name', e.target.value)}
                        required
                      />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <TextField
                        fullWidth
                        type="email"
                        label="Email"
                        value={signer.email}
                        onChange={(e) => updateSigner(index, 'email', e.target.value)}
                        required
                      />
                    </Grid>
                    <Grid item xs={12} sm={2}>
                      <TextField
                        fullWidth
                        label="Role"
                        value={signer.role}
                        onChange={(e) => updateSigner(index, 'role', e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={2}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Order"
                        value={signer.signing_order}
                        onChange={(e) => updateSigner(index, 'signing_order', parseInt(e.target.value))}
                        inputProps={{ min: 1 }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={2}>
                      {newRequest.signers.length > 1 && (
                        <Button
                          color="error"
                          onClick={() => removeSigner(index)}
                          fullWidth
                        >
                          Remove
                        </Button>
                      )}
                    </Grid>
                  </Grid>
                </Paper>
              ))}
              <Button
                startIcon={<AddIcon />}
                onClick={addSigner}
                variant="outlined"
              >
                Add Signer
              </Button>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Expiration (days)"
                value={newRequest.expiration_days}
                onChange={(e) => setNewRequest({ ...newRequest, expiration_days: parseInt(e.target.value) })}
                inputProps={{ min: 1, max: 365 }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Reminder Frequency (days)"
                value={newRequest.reminder_frequency_days}
                onChange={(e) => setNewRequest({ ...newRequest, reminder_frequency_days: parseInt(e.target.value) })}
                inputProps={{ min: 1, max: 30 }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateRequest} variant="contained" startIcon={<SendIcon />}>
            Send for Signature
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Request Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Signature Request Details
        </DialogTitle>
        <DialogContent>
          {selectedRequest && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Request Information
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon><AssignmentIcon /></ListItemIcon>
                      <ListItemText
                        primary="Title"
                        secondary={selectedRequest.title}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><SecurityIcon /></ListItemIcon>
                      <ListItemText
                        primary="Compliance Framework"
                        secondary={selectedRequest.compliance_framework.toUpperCase()}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><ScheduleIcon /></ListItemIcon>
                      <ListItemText
                        primary="Expires"
                        secondary={selectedRequest.expires_at ? formatDate(selectedRequest.expires_at) : 'N/A'}
                      />
                    </ListItem>
                  </List>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Signers ({selectedRequest.signatures.length})
                  </Typography>
                  <List dense>
                    {selectedRequest.signatures.map((signature) => (
                      <ListItem key={signature.id}>
                        <ListItemIcon>
                          <Badge
                            badgeContent={signature.signing_order}
                            color="primary"
                          >
                            <PersonIcon />
                          </Badge>
                        </ListItemIcon>
                        <ListItemText
                          primary={signature.signer_name}
                          secondary={
                            <Box>
                              <Typography variant="body2" component="span">
                                {signature.signer_email}
                              </Typography>
                              <br />
                              {getStatusChip(signature.status)}
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Activity Timeline
                  </Typography>
                  <List>
                    {selectedRequest.events.map((event, index) => (
                      <React.Fragment key={event.id}>
                        <ListItem>
                          <ListItemIcon>
                            <ScheduleIcon />
                          </ListItemIcon>
                          <ListItemText
                            primary={event.event_type.replace(/_/g, ' ').toUpperCase()}
                            secondary={
                              <Box>
                                <Typography variant="body2">
                                  {event.event_description}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {formatDate(event.occurred_at)}
                                </Typography>
                              </Box>
                            }
                          />
                        </ListItem>
                        {index < selectedRequest.events.length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                </Paper>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SignatureRequestManager;