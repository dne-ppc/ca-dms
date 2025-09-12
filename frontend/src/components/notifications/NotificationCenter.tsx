import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, Settings, History, BarChart3, Send } from 'lucide-react';
import NotificationPreferences from './NotificationPreferences';
import NotificationHistory from './NotificationHistory';
import { useToast } from '@/hooks/use-toast';

interface NotificationStats {
  total_notifications: number;
  pending_notifications: number;
  sent_notifications: number;
  failed_notifications: number;
  delivery_rate: number;
}

const NotificationCenter: React.FC = () => {
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [sendingPending, setSendingPending] = useState(false);
  const { toast } = useToast();

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/v1/notifications/stats/overview', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        throw new Error('Failed to fetch stats');
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast({
        title: "Error",
        description: "Failed to load notification statistics",
        variant: "destructive"
      });
    } finally {
      setLoadingStats(false);
    }
  };

  const sendPendingNotifications = async () => {
    setSendingPending(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/v1/notifications/send-pending', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Success",
          description: `${data.sent_count} notifications sent successfully`
        });
        
        // Refresh stats
        if (stats) {
          fetchStats();
        }
      } else {
        throw new Error('Failed to send notifications');
      }
    } catch (error) {
      console.error('Error sending notifications:', error);
      toast({
        title: "Error",
        description: "Failed to send pending notifications",
        variant: "destructive"
      });
    } finally {
      setSendingPending(false);
    }
  };

  React.useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold">Notification Center</h1>
          <p className="text-muted-foreground">
            Manage your notification preferences and view history
          </p>
        </div>
      </div>

      {/* Statistics Overview */}
      {stats && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Notification Statistics (Last 30 days)
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchStats}
                  disabled={loadingStats}
                >
                  {loadingStats ? 'Loading...' : 'Refresh'}
                </Button>
                {stats.pending_notifications > 0 && (
                  <Button
                    size="sm"
                    onClick={sendPendingNotifications}
                    disabled={sendingPending}
                    className="flex items-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    {sendingPending ? 'Sending...' : `Send ${stats.pending_notifications} Pending`}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {stats.total_notifications.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {stats.pending_notifications.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {stats.sent_notifications.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Sent</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {stats.failed_notifications.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {stats.delivery_rate}%
                </div>
                <div className="text-sm text-muted-foreground">Delivery Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="preferences" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="preferences" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
            {stats && stats.total_notifications > 0 && (
              <Badge variant="secondary" className="ml-2">
                {stats.total_notifications}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preferences">
          <NotificationPreferences />
        </TabsContent>

        <TabsContent value="history">
          <NotificationHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NotificationCenter;