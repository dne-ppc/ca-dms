import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuHeader, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Bell, 
  BellRing,
  Mail, 
  MessageSquare, 
  Smartphone, 
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Settings,
  MoreHorizontal
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RecentNotification {
  id: number;
  type: 'email' | 'sms' | 'push' | 'slack' | 'teams';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  subject?: string;
  content: string;
  status: 'pending' | 'sent' | 'failed' | 'delivered';
  created_at: string;
  context_data?: {
    event_type?: string;
    document_title?: string;
  };
}

const NotificationBell: React.FC = () => {
  const [recentNotifications, setRecentNotifications] = useState<RecentNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const notificationIcons = {
    email: Mail,
    sms: Smartphone,
    push: Bell,
    slack: MessageSquare,
    teams: Users
  };

  const statusIcons = {
    pending: Clock,
    sent: CheckCircle2,
    failed: XCircle,
    delivered: CheckCircle2
  };

  const priorityColors = {
    low: 'text-gray-500',
    normal: 'text-blue-500',
    high: 'text-orange-500',
    urgent: 'text-red-500'
  };

  useEffect(() => {
    fetchRecentNotifications();
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchRecentNotifications, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchRecentNotifications = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const response = await fetch('/api/v1/notifications/?page=1&per_page=10', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRecentNotifications(data.notifications || []);
        
        // Count pending/recent notifications as "unread"
        const recentTime = new Date();
        recentTime.setHours(recentTime.getHours() - 24); // Last 24 hours
        
        const unread = data.notifications?.filter((notif: RecentNotification) => 
          new Date(notif.created_at) > recentTime
        ).length || 0;
        
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const truncateText = (text: string, maxLength: number = 60) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const getEventTypeLabel = (notification: RecentNotification) => {
    const eventType = notification.context_data?.event_type;
    const documentTitle = notification.context_data?.document_title;

    switch (eventType) {
      case 'workflow_assigned':
        return `Workflow assigned${documentTitle ? ` - ${documentTitle}` : ''}`;
      case 'workflow_completed':
        return `Workflow completed${documentTitle ? ` - ${documentTitle}` : ''}`;
      case 'workflow_rejected':
        return `Workflow rejected${documentTitle ? ` - ${documentTitle}` : ''}`;
      case 'document_shared':
        return `Document shared${documentTitle ? ` - ${documentTitle}` : ''}`;
      case 'document_updated':
        return `Document updated${documentTitle ? ` - ${documentTitle}` : ''}`;
      default:
        return notification.subject || 'Notification';
    }
  };

  const handleViewAll = () => {
    setIsOpen(false);
    navigate('/notifications');
  };

  const handleSettings = () => {
    setIsOpen(false);
    navigate('/notifications?tab=preferences');
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          {unreadCount > 0 ? (
            <BellRing className="h-5 w-5" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-96 p-0">
        <div className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary">
                {unreadCount} new
              </Badge>
            )}
          </div>
        </div>
        
        <Separator />
        
        <ScrollArea className="h-96">
          {recentNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No recent notifications</p>
            </div>
          ) : (
            <div className="p-2">
              {recentNotifications.map((notification, index) => {
                const TypeIcon = notificationIcons[notification.type];
                const StatusIcon = statusIcons[notification.status];
                
                return (
                  <div 
                    key={notification.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-1 mt-0.5">
                      <TypeIcon className="h-4 w-4 text-muted-foreground" />
                      <StatusIcon className={`h-3 w-3 ${
                        notification.status === 'sent' || notification.status === 'delivered' 
                          ? 'text-green-500' 
                          : notification.status === 'failed'
                          ? 'text-red-500'
                          : 'text-yellow-500'
                      }`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="text-sm font-medium truncate">
                          {getEventTypeLabel(notification)}
                        </h4>
                        <div className={`h-2 w-2 rounded-full ${priorityColors[notification.priority]} opacity-60`} />
                      </div>
                      
                      <p className="text-xs text-muted-foreground mb-1 line-clamp-2">
                        {truncateText(notification.content)}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(notification.created_at)}
                        </span>
                        <Badge 
                          variant="outline" 
                          className="text-xs px-1.5 py-0.5 h-auto"
                        >
                          {notification.type}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        
        <Separator />
        
        <div className="p-2 flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleSettings}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleViewAll}
          >
            View All
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationBell;