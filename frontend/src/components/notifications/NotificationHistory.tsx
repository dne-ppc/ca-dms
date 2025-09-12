import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Bell, 
  Mail, 
  MessageSquare, 
  Smartphone, 
  Users, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Search,
  Filter,
  Trash2,
  MoreHorizontal
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

interface Notification {
  id: number;
  user_id: string;
  type: 'email' | 'sms' | 'push' | 'slack' | 'teams';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  subject?: string;
  content: string;
  recipient: string;
  status: 'pending' | 'sent' | 'failed' | 'delivered';
  sent_at?: string;
  delivered_at?: string;
  error_message?: string;
  retry_count: number;
  max_retries: number;
  created_at: string;
  updated_at: string;
  template?: {
    id: number;
    name: string;
    type: string;
  };
  context_data?: Record<string, any>;
}

interface NotificationHistoryResponse {
  notifications: Notification[];
  total: number;
  page: number;
  per_page: number;
}

const NotificationHistory: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const { toast } = useToast();

  const notificationTypes = {
    email: { label: 'Email', icon: Mail, color: 'blue' },
    sms: { label: 'SMS', icon: Smartphone, color: 'green' },
    push: { label: 'Push', icon: Bell, color: 'purple' },
    slack: { label: 'Slack', icon: MessageSquare, color: 'purple' },
    teams: { label: 'Teams', icon: Users, color: 'blue' }
  };

  const statusIcons = {
    pending: { icon: Clock, color: 'yellow', label: 'Pending' },
    sent: { icon: CheckCircle2, color: 'green', label: 'Sent' },
    failed: { icon: XCircle, color: 'red', label: 'Failed' },
    delivered: { icon: CheckCircle2, color: 'green', label: 'Delivered' }
  };

  const priorityColors = {
    low: 'secondary',
    normal: 'default',
    high: 'destructive',
    urgent: 'destructive'
  };

  useEffect(() => {
    fetchNotifications();
  }, [currentPage, statusFilter, typeFilter]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const params = new URLSearchParams({
        page: currentPage.toString(),
        per_page: perPage.toString()
      });

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (typeFilter !== 'all') {
        params.append('notification_type', typeFilter);
      }

      const response = await fetch(`/api/v1/notifications/?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data: NotificationHistoryResponse = await response.json();
        setNotifications(data.notifications);
        setTotalCount(data.total);
      } else {
        throw new Error('Failed to fetch notifications');
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast({
        title: "Error",
        description: "Failed to load notification history",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (notificationId: number) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        toast({
          title: "Success",
          description: "Notification deleted successfully"
        });
      } else {
        throw new Error('Failed to delete notification');
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast({
        title: "Error",
        description: "Failed to delete notification",
        variant: "destructive"
      });
    }
  };

  const handleResend = async (notificationId: number) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/v1/notifications/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notification_ids: [notificationId]
        })
      });

      if (response.ok) {
        fetchNotifications(); // Refresh the list
        toast({
          title: "Success",
          description: "Notification sent successfully"
        });
      } else {
        throw new Error('Failed to resend notification');
      }
    } catch (error) {
      console.error('Error resending notification:', error);
      toast({
        title: "Error",
        description: "Failed to resend notification",
        variant: "destructive"
      });
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        notification.subject?.toLowerCase().includes(searchLower) ||
        notification.content.toLowerCase().includes(searchLower) ||
        notification.recipient.toLowerCase().includes(searchLower) ||
        notification.template?.name.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const totalPages = Math.ceil(totalCount / perPage);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Notification History</h2>
        <p className="text-muted-foreground">
          View and manage your notification history
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search notifications..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="push">Push</SelectItem>
                <SelectItem value="slack">Slack</SelectItem>
                <SelectItem value="teams">Teams</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No notifications found</h3>
            <p className="text-muted-foreground">
              {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'No notifications have been sent yet'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredNotifications.map((notification) => {
            const typeConfig = notificationTypes[notification.type];
            const statusConfig = statusIcons[notification.status];
            const TypeIcon = typeConfig?.icon || Bell;
            const StatusIcon = statusConfig?.icon || AlertCircle;

            return (
              <Card key={notification.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="flex items-center gap-2">
                        <TypeIcon className={`h-5 w-5 text-${typeConfig?.color}-600`} />
                        <StatusIcon className={`h-4 w-4 text-${statusConfig?.color}-600`} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={priorityColors[notification.priority] as any}>
                            {notification.priority}
                          </Badge>
                          <Badge variant="outline">
                            {typeConfig?.label || notification.type}
                          </Badge>
                          <Badge variant="outline">
                            {statusConfig?.label || notification.status}
                          </Badge>
                        </div>
                        
                        {notification.subject && (
                          <h4 className="font-medium text-sm mb-1 truncate">
                            {notification.subject}
                          </h4>
                        )}
                        
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {notification.content}
                        </p>
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>To: {notification.recipient}</span>
                          <span>Created: {formatDate(notification.created_at)}</span>
                          {notification.sent_at && (
                            <span>Sent: {formatDate(notification.sent_at)}</span>
                          )}
                          {notification.template && (
                            <span>Template: {notification.template.name}</span>
                          )}
                          {notification.retry_count > 0 && (
                            <span className="text-orange-600">
                              Retries: {notification.retry_count}/{notification.max_retries}
                            </span>
                          )}
                        </div>
                        
                        {notification.error_message && (
                          <Alert className="mt-2">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                              {notification.error_message}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {(notification.status === 'failed' || notification.status === 'pending') && (
                          <DropdownMenuItem onClick={() => handleResend(notification.id)}>
                            <Bell className="h-4 w-4 mr-2" />
                            Resend
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          onClick={() => handleDelete(notification.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * perPage + 1} to {Math.min(currentPage * perPage, totalCount)} of {totalCount} notifications
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationHistory;