import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  UserPlus, 
  Users, 
  Mail, 
  Check, 
  X, 
  Crown,
  Edit,
  Eye,
  Settings,
  Trash2,
  Link
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';

interface Collaborator {
  id: string;
  template_id: string;
  user_id: string;
  can_view: boolean;
  can_edit: boolean;
  can_manage: boolean;
  can_publish: boolean;
  invited_by?: string;
  invited_at: string;
  accepted_at?: string;
}

interface TemplateCollaborationProps {
  templateId: string;
  collaborators: Collaborator[];
  onCollaboratorAdded?: () => void;
  onCollaboratorUpdated?: () => void;
  onCollaboratorRemoved?: () => void;
}

export const TemplateCollaboration: React.FC<TemplateCollaborationProps> = ({
  templateId,
  collaborators,
  onCollaboratorAdded,
  onCollaboratorUpdated,
  onCollaboratorRemoved
}) => {
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePermissions, setInvitePermissions] = useState({
    can_view: true,
    can_edit: false,
    can_manage: false,
    can_publish: false
  });
  const [loading, setLoading] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [showShareLink, setShowShareLink] = useState(false);

  const handleInviteCollaborator = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/templates/${templateId}/collaborators`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: inviteEmail, // In a real app, this would be resolved from email
          ...invitePermissions
        }),
      });

      if (response.ok) {
        setShowInviteDialog(false);
        setInviteEmail('');
        setInvitePermissions({
          can_view: true,
          can_edit: false,
          can_manage: false,
          can_publish: false
        });
        onCollaboratorAdded?.();
      } else {
        throw new Error('Failed to invite collaborator');
      }
    } catch (error) {
      console.error('Error inviting collaborator:', error);
      alert('Failed to invite collaborator. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePermissions = async (collaboratorId: string, permissions: any) => {
    try {
      const response = await fetch(`/api/v1/templates/${templateId}/collaborators/${collaboratorId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(permissions),
      });

      if (response.ok) {
        onCollaboratorUpdated?.();
      } else {
        throw new Error('Failed to update permissions');
      }
    } catch (error) {
      console.error('Error updating permissions:', error);
      alert('Failed to update permissions. Please try again.');
    }
  };

  const handleRemoveCollaborator = async (collaboratorId: string) => {
    if (!confirm('Are you sure you want to remove this collaborator?')) return;

    try {
      const response = await fetch(`/api/v1/templates/${templateId}/collaborators/${collaboratorId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        onCollaboratorRemoved?.();
      } else {
        throw new Error('Failed to remove collaborator');
      }
    } catch (error) {
      console.error('Error removing collaborator:', error);
      alert('Failed to remove collaborator. Please try again.');
    }
  };

  const generateShareLink = () => {
    const link = `${window.location.origin}/templates/${templateId}`;
    setShareLink(link);
    setShowShareLink(true);
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    alert('Share link copied to clipboard!');
  };

  const getPermissionIcon = (collaborator: Collaborator) => {
    if (collaborator.can_manage) return <Crown className="h-4 w-4 text-yellow-600" />;
    if (collaborator.can_edit) return <Edit className="h-4 w-4 text-blue-600" />;
    return <Eye className="h-4 w-4 text-gray-600" />;
  };

  const getPermissionText = (collaborator: Collaborator) => {
    if (collaborator.can_manage) return 'Manager';
    if (collaborator.can_edit) return 'Editor';
    return 'Viewer';
  };

  const getPermissionColor = (collaborator: Collaborator) => {
    if (collaborator.can_manage) return 'bg-yellow-100 text-yellow-800';
    if (collaborator.can_edit) return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Collaboration ({collaborators.length})
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={generateShareLink}
            >
              <Link className="h-4 w-4 mr-2" />
              Share Link
            </Button>
            <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Collaborator</DialogTitle>
                  <DialogDescription>
                    Invite someone to collaborate on this template
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="user@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Permissions</Label>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4 text-gray-600" />
                          <div>
                            <p className="text-sm font-medium">View</p>
                            <p className="text-xs text-muted-foreground">Can view the template</p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={invitePermissions.can_view}
                          onChange={(e) => setInvitePermissions(prev => ({
                            ...prev,
                            can_view: e.target.checked
                          }))}
                          disabled={true} // Always required
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Edit className="h-4 w-4 text-blue-600" />
                          <div>
                            <p className="text-sm font-medium">Edit</p>
                            <p className="text-xs text-muted-foreground">Can edit template content</p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={invitePermissions.can_edit}
                          onChange={(e) => setInvitePermissions(prev => ({
                            ...prev,
                            can_edit: e.target.checked
                          }))}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Settings className="h-4 w-4 text-purple-600" />
                          <div>
                            <p className="text-sm font-medium">Publish</p>
                            <p className="text-xs text-muted-foreground">Can publish template</p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={invitePermissions.can_publish}
                          onChange={(e) => setInvitePermissions(prev => ({
                            ...prev,
                            can_publish: e.target.checked
                          }))}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Crown className="h-4 w-4 text-yellow-600" />
                          <div>
                            <p className="text-sm font-medium">Manage</p>
                            <p className="text-xs text-muted-foreground">Can manage collaborators and settings</p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={invitePermissions.can_manage}
                          onChange={(e) => setInvitePermissions(prev => ({
                            ...prev,
                            can_manage: e.target.checked
                          }))}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleInviteCollaborator}
                    disabled={loading || !inviteEmail.trim()}
                  >
                    {loading ? 'Inviting...' : 'Send Invite'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {collaborators.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No collaborators yet</h3>
            <p className="text-muted-foreground mb-4">
              Invite others to collaborate on this template
            </p>
            <Button onClick={() => setShowInviteDialog(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Collaborator
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {collaborators.map((collaborator) => (
              <div key={collaborator.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {collaborator.user_id.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{collaborator.user_id}</p>
                      {!collaborator.accepted_at && (
                        <Badge variant="outline" className="text-xs">Pending</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {getPermissionIcon(collaborator)}
                      <span>{getPermissionText(collaborator)}</span>
                      <span>•</span>
                      <span>Invited {formatDate(collaborator.invited_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge className={cn("text-xs", getPermissionColor(collaborator))}>
                    {getPermissionText(collaborator)}
                  </Badge>
                  
                  <Select
                    value={getPermissionText(collaborator).toLowerCase()}
                    onValueChange={(value) => {
                      const permissions = {
                        can_view: true,
                        can_edit: value === 'editor' || value === 'manager',
                        can_publish: value === 'manager',
                        can_manage: value === 'manager'
                      };
                      handleUpdatePermissions(collaborator.id, permissions);
                    }}
                  >
                    <SelectTrigger className="w-24 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveCollaborator(collaborator.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Share Link Dialog */}
      <Dialog open={showShareLink} onOpenChange={setShowShareLink}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Template</DialogTitle>
            <DialogDescription>
              Anyone with this link can view the template
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="flex items-center gap-2">
              <Input
                value={shareLink}
                readOnly
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={copyShareLink}
              >
                <Link className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
            
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> This link allows view access only. To give someone edit access, 
                use the invite feature above.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowShareLink(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};