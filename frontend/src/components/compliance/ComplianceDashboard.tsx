import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Users,
  Download,
  Trash2,
  BarChart3
} from 'lucide-react';

interface ComplianceMetrics {
  consent_statistics: {
    total_users: number;
    users_with_consent: number;
    consent_by_type: Record<string, { granted: number; denied: number; total: number }>;
    recent_withdrawals: number;
  };
  retention_compliance: {
    active_policies: number;
    items_pending_deletion: number;
    automated_deletions_last_30_days: number;
  };
  pia_status: {
    total_pias: number;
    draft: number;
    approved: number;
    overdue_reviews: number;
  };
  deletion_requests: {
    pending: number;
    completed_last_30_days: number;
    average_processing_time_days: number;
  };
  data_exports: {
    requests_last_30_days: number;
    average_export_size_mb: number;
    most_requested_categories: string[];
  };
  audit_summary: {
    total_events_last_30_days: number;
    security_events_last_30_days: number;
    compliance_events_last_30_days: number;
  };
  generated_at: string;
}

interface ComplianceDashboardData {
  metrics: ComplianceMetrics;
  pending_tasks: Array<{
    type: string;
    priority: string;
    description: string;
    due_date: string;
  }>;
  recent_activities: Array<{
    type: string;
    description: string;
    timestamp: string;
    status: string;
  }>;
  compliance_score: number;
  recommendations: string[];
  alerts: Array<{
    type: string;
    severity: string;
    message: string;
    created_at: string;
  }>;
}

const ComplianceDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<ComplianceDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/v1/compliance/dashboard');
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      } else {
        setError('Failed to load compliance dashboard');
      }
    } catch (err) {
      setError('Error loading dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreDescription = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Needs Improvement';
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800'
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="bg-red-50 border-red-200">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!dashboardData) {
    return null;
  }

  const { metrics, pending_tasks, recent_activities, compliance_score, recommendations, alerts } = dashboardData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Compliance Dashboard</h1>
          <p className="text-gray-600 mt-1">GDPR/CCPA compliance monitoring and management</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="text-right">
            <div className={`text-2xl font-bold ${getScoreColor(compliance_score)}`}>
              {compliance_score.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">
              {getScoreDescription(compliance_score)}
            </div>
          </div>
          <div className="w-16 h-16">
            <Progress
              value={compliance_score}
              className="h-2 w-full transform rotate-90 origin-center"
            />
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, index) => (
            <Alert
              key={index}
              className={`${
                alert.severity === 'warning' ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{alert.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Consent Coverage</p>
                <p className="text-2xl font-bold text-gray-900">
                  {((metrics.consent_statistics.users_with_consent / metrics.consent_statistics.total_users) * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500">
                  {metrics.consent_statistics.users_with_consent} of {metrics.consent_statistics.total_users} users
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-green-100 rounded-full">
                <Shield className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Active PIAs</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.pia_status.approved}</p>
                <p className="text-xs text-gray-500">
                  {metrics.pia_status.overdue_reviews} overdue for review
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-orange-100 rounded-full">
                <Trash2 className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Deletion Requests</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.deletion_requests.pending}</p>
                <p className="text-xs text-gray-500">Pending processing</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-purple-100 rounded-full">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Retention Policies</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.retention_compliance.active_policies}</p>
                <p className="text-xs text-gray-500">Active policies</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Consent Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Consent Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(metrics.consent_statistics.consent_by_type).map(([type, stats]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">
                    {type.replace('_', ' ')}
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-green-600">{stats.granted}</span>
                    <span className="text-sm text-gray-400">/</span>
                    <span className="text-sm text-red-600">{stats.denied}</span>
                    <div className="w-16">
                      <Progress
                        value={(stats.granted / (stats.granted + stats.denied)) * 100}
                        className="h-2"
                      />
                    </div>
                  </div>
                </div>
              ))}
              {metrics.consent_statistics.recent_withdrawals > 0 && (
                <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    {metrics.consent_statistics.recent_withdrawals} consent withdrawals in the last 30 days
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pending Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Pending Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pending_tasks.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No pending compliance tasks
                </p>
              ) : (
                pending_tasks.map((task, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{task.description}</p>
                      <p className="text-xs text-gray-500">
                        Due: {new Date(task.due_date).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge className={getPriorityBadge(task.priority)}>
                      {task.priority}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Recent Activities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recent_activities.map((activity, index) => (
                <div key={index} className="flex items-start space-x-3 p-2 border-l-2 border-gray-200">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    activity.status === 'info' ? 'bg-blue-500' :
                    activity.status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.description}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle className="h-5 w-5 mr-2" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendations.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No recommendations at this time
                </p>
              ) : (
                recommendations.map((recommendation, index) => (
                  <div key={index} className="flex items-start space-x-2 p-3 bg-blue-50 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-blue-800">{recommendation}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="flex items-center space-x-2">
              <Download className="h-4 w-4" />
              <span>Export Compliance Report</span>
            </Button>
            <Button variant="outline" className="flex items-center space-x-2">
              <Shield className="h-4 w-4" />
              <span>Create PIA</span>
            </Button>
            <Button variant="outline" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Review Consents</span>
            </Button>
            <Button variant="outline" className="flex items-center space-x-2">
              <Trash2 className="h-4 w-4" />
              <span>Process Deletions</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ComplianceDashboard;