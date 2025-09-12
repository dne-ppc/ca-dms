import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  History,
  GitBranch,
  RotateCcw,
  Eye,
  Download,
  Clock,
  User,
  FileText,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  ArrowRight
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from '@/lib/utils';

interface TemplateVersion {
  id: string;
  template_id: string;
  version_number: number;
  title: string;
  content: any;
  placeholders?: any;
  change_summary?: string;
  parent_version?: number;
  created_by: string;
  created_at: string;
}

interface TemplateVersionHistoryProps {
  templateId: string;
  currentVersion: number;
  onVersionRestore?: (versionNumber: number) => void;
}

export const TemplateVersionHistory: React.FC<TemplateVersionHistoryProps> = ({
  templateId,
  currentVersion,
  onVersionRestore
}) => {
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [compareVersions, setCompareVersions] = useState<{
    from: TemplateVersion | null;
    to: TemplateVersion | null;
  }>({ from: null, to: null });
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadVersionHistory();
  }, [templateId]);

  const loadVersionHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/templates/${templateId}/versions`);
      if (response.ok) {
        const data = await response.json();
        setVersions(data);
      }
    } catch (error) {
      console.error('Failed to load version history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreVersion = async (version: TemplateVersion) => {
    if (!confirm(`Are you sure you want to restore to version ${version.version_number}? This will create a new version with the restored content.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/templates/${templateId}/restore-version`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version_number: version.version_number
        }),
      });

      if (response.ok) {
        onVersionRestore?.(version.version_number);
        loadVersionHistory(); // Refresh the history
      } else {
        throw new Error('Failed to restore version');
      }
    } catch (error) {
      console.error('Error restoring version:', error);
      alert('Failed to restore version. Please try again.');
    }
  };

  const handleCompareVersions = (fromVersion: TemplateVersion, toVersion: TemplateVersion) => {
    setCompareVersions({ from: fromVersion, to: toVersion });
    setShowCompareDialog(true);
  };

  const toggleVersionExpansion = (versionId: string) => {
    setExpandedVersions(prev => {
      const next = new Set(prev);
      if (next.has(versionId)) {
        next.delete(versionId);
      } else {
        next.add(versionId);
      }
      return next;
    });
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

  const getVersionBadgeColor = (version: TemplateVersion) => {
    if (version.version_number === currentVersion) {
      return 'bg-green-100 text-green-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  const calculateChanges = (version: TemplateVersion) => {
    // This would calculate content changes between versions
    // For demo purposes, returning mock data
    return {
      added: Math.floor(Math.random() * 100),
      removed: Math.floor(Math.random() * 50),
      modified: Math.floor(Math.random() * 75)
    };
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Version History ({versions.length})
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        {versions.length === 0 ? (
          <div className="text-center py-8">
            <GitBranch className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No version history</h3>
            <p className="text-muted-foreground">
              Version history will appear here as you make changes to the template
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {versions.map((version, index) => {
              const isExpanded = expandedVersions.has(version.id);
              const changes = calculateChanges(version);
              const isLatest = version.version_number === currentVersion;
              const previousVersion = versions.find(v => v.version_number === version.parent_version);

              return (
                <div
                  key={version.id}
                  className={cn(
                    "border rounded-lg",
                    isLatest && "border-green-200 bg-green-50/50"
                  )}
                >
                  <Collapsible>
                    <CollapsibleTrigger 
                      className="w-full"
                      onClick={() => toggleVersionExpansion(version.id)}
                    >
                      <div className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                            <Badge className={cn("text-xs", getVersionBadgeColor(version))}>
                              v{version.version_number}
                              {isLatest && " (Current)"}
                            </Badge>
                          </div>
                          
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              {version.created_by.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="text-left">
                            <p className="font-medium text-sm">{version.title}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{formatDate(version.created_at)}</span>
                              <span>by {version.created_by}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {version.change_summary && (
                            <div className="text-xs text-muted-foreground max-w-xs truncate">
                              {version.change_summary}
                            </div>
                          )}
                          
                          <div className="flex items-center gap-1 text-xs">
                            {changes.added > 0 && (
                              <span className="text-green-600">+{changes.added}</span>
                            )}
                            {changes.removed > 0 && (
                              <span className="text-red-600">-{changes.removed}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="px-4 pb-4 border-t">
                        <div className="pt-4 space-y-4">
                          {version.change_summary && (
                            <div>
                              <h4 className="text-sm font-medium mb-2">Changes</h4>
                              <p className="text-sm text-muted-foreground">
                                {version.change_summary}
                              </p>
                            </div>
                          )}

                          <div>
                            <h4 className="text-sm font-medium mb-2">Statistics</h4>
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span>{changes.added} additions</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                <span>{changes.removed} deletions</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <span>{changes.modified} modifications</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Navigate to version preview
                                window.open(`/templates/${templateId}/versions/${version.version_number}`, '_blank');
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                            
                            {previousVersion && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCompareVersions(previousVersion, version);
                                }}
                              >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Compare
                              </Button>
                            )}
                            
                            {!isLatest && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRestoreVersion(version);
                                }}
                              >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Restore
                              </Button>
                            )}
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Export version
                                alert('Export version functionality would be implemented here');
                              }}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Export
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Compare Versions Dialog */}
      <Dialog open={showCompareDialog} onOpenChange={setShowCompareDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Compare Versions</DialogTitle>
            <DialogDescription>
              {compareVersions.from && compareVersions.to && (
                <>
                  Comparing v{compareVersions.from.version_number} with v{compareVersions.to.version_number}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-4">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Badge variant="outline">v{compareVersions.from?.version_number}</Badge>
                  Previous Version
                </h4>
                <div className="text-xs text-muted-foreground">
                  {compareVersions.from && formatDate(compareVersions.from.created_at)}
                </div>
              </div>
              <div className="border rounded-lg p-4 bg-red-50 min-h-[300px]">
                <p className="text-center text-muted-foreground">
                  Previous version content would be displayed here
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Badge variant="outline">v{compareVersions.to?.version_number}</Badge>
                  Current Version
                </h4>
                <div className="text-xs text-muted-foreground">
                  {compareVersions.to && formatDate(compareVersions.to.created_at)}
                </div>
              </div>
              <div className="border rounded-lg p-4 bg-green-50 min-h-[300px]">
                <p className="text-center text-muted-foreground">
                  Current version content would be displayed here with changes highlighted
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompareDialog(false)}>
              Close
            </Button>
            {compareVersions.from && (
              <Button 
                onClick={() => {
                  setShowCompareDialog(false);
                  if (compareVersions.from) {
                    handleRestoreVersion(compareVersions.from);
                  }
                }}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Restore v{compareVersions.from.version_number}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};