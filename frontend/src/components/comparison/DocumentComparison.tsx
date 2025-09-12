import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SideBySideView } from './SideBySideView';
import { UnifiedDiffView } from './UnifiedDiffView';
import { ComparisonStats } from './ComparisonStats';
import { VersionSelector } from './VersionSelector';
import { 
  FileText, 
  GitCompare, 
  BarChart3, 
  Clock, 
  User,
  ArrowLeftRight,
  Loader2
} from 'lucide-react';

export interface DocumentVersion {
  id: string;
  version_number: number;
  title: string;
  created_at: string;
  created_by?: string;
  change_summary?: string;
  is_major_version: boolean;
  tags?: string[];
}

export interface ComparisonResult {
  changes: Array<{
    type: string;
    position: number;
    length: number;
    old_op?: any;
    new_op?: any;
    attributes_changed?: string[];
  }>;
  added_text: number;
  deleted_text: number;
  modified_text: number;
  total_changes: number;
  similarity_score: number;
}

export interface DocumentComparisonResponse {
  document_id: string;
  old_version: number;
  new_version: number;
  comparison_result: ComparisonResult;
  diff_delta?: any;
  placeholder_changes: Record<string, any[]>;
  created_at: string;
}

interface DocumentComparisonProps {
  documentId: string;
  onClose?: () => void;
}

export const DocumentComparison: React.FC<DocumentComparisonProps> = ({
  documentId,
  onClose
}) => {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [selectedOldVersion, setSelectedOldVersion] = useState<number | null>(null);
  const [selectedNewVersion, setSelectedNewVersion] = useState<number | null>(null);
  const [comparison, setComparison] = useState<DocumentComparisonResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [versionsLoading, setVersionsLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState('side-by-side');
  const [error, setError] = useState<string | null>(null);

  // Fetch document versions on mount
  useEffect(() => {
    fetchVersions();
  }, [documentId]);

  // Auto-select most recent two versions when versions are loaded
  useEffect(() => {
    if (versions.length >= 2 && !selectedOldVersion && !selectedNewVersion) {
      const sortedVersions = [...versions].sort((a, b) => b.version_number - a.version_number);
      setSelectedNewVersion(sortedVersions[0].version_number);
      setSelectedOldVersion(sortedVersions[1].version_number);
    }
  }, [versions]);

  // Auto-compare when both versions are selected
  useEffect(() => {
    if (selectedOldVersion && selectedNewVersion && selectedOldVersion !== selectedNewVersion) {
      compareVersions();
    }
  }, [selectedOldVersion, selectedNewVersion]);

  const fetchVersions = async () => {
    try {
      setVersionsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/v1/documents/${documentId}/versions`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch versions: ${response.statusText}`);
      }

      const data = await response.json();
      setVersions(data.versions || []);
    } catch (error) {
      console.error('Error fetching versions:', error);
      setError('Failed to load document versions');
    } finally {
      setVersionsLoading(false);
    }
  };

  const compareVersions = async () => {
    if (!selectedOldVersion || !selectedNewVersion) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/v1/documents/${documentId}/compare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          document_id: documentId,
          old_version: selectedOldVersion,
          new_version: selectedNewVersion,
          include_placeholders: true,
          generate_diff_delta: true
        })
      });

      if (!response.ok) {
        throw new Error(`Comparison failed: ${response.statusText}`);
      }

      const comparisonData = await response.json();
      setComparison(comparisonData);
    } catch (error) {
      console.error('Error comparing versions:', error);
      setError('Failed to compare document versions');
    } finally {
      setLoading(false);
    }
  };

  const getVersionInfo = (versionNumber: number) => {
    return versions.find(v => v.version_number === versionNumber);
  };

  const formatSimilarityScore = (score: number) => {
    return `${(score * 100).toFixed(1)}%`;
  };

  const getChangeTypeColor = (changeCount: number) => {
    if (changeCount === 0) return 'bg-gray-100 text-gray-800';
    if (changeCount < 10) return 'bg-green-100 text-green-800';
    if (changeCount < 50) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  if (versionsLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading document versions...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-red-600 mb-4">{error}</div>
          <Button onClick={fetchVersions} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (versions.length < 2) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Versions to Compare</h3>
          <p className="text-gray-600">
            This document needs at least 2 versions to perform a comparison.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <GitCompare className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold">Document Comparison</h2>
        </div>
        {onClose && (
          <Button onClick={onClose} variant="outline" size="sm">
            Close
          </Button>
        )}
      </div>

      {/* Version Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Versions to Compare</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Original Version</label>
              <VersionSelector
                versions={versions}
                selectedVersion={selectedOldVersion}
                onVersionSelect={setSelectedOldVersion}
                placeholder="Select original version"
                excludeVersion={selectedNewVersion}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Compare With</label>
              <VersionSelector
                versions={versions}
                selectedVersion={selectedNewVersion}
                onVersionSelect={setSelectedNewVersion}
                placeholder="Select version to compare"
                excludeVersion={selectedOldVersion}
              />
            </div>
          </div>

          {selectedOldVersion && selectedNewVersion && (
            <div className="mt-4 flex items-center justify-center">
              <ArrowLeftRight className="w-4 h-4 text-gray-400" />
              <span className="ml-2 text-sm text-gray-600">
                Comparing version {selectedOldVersion} with version {selectedNewVersion}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparison Results */}
      {comparison && (
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5" />
                <span>Comparison Summary</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    +{comparison.comparison_result.added_text}
                  </div>
                  <div className="text-sm text-gray-600">Characters Added</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    -{comparison.comparison_result.deleted_text}
                  </div>
                  <div className="text-sm text-gray-600">Characters Deleted</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    ~{comparison.comparison_result.modified_text}
                  </div>
                  <div className="text-sm text-gray-600">Characters Modified</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatSimilarityScore(comparison.comparison_result.similarity_score)}
                  </div>
                  <div className="text-sm text-gray-600">Similarity</div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-center space-x-4">
                <Badge className={getChangeTypeColor(comparison.comparison_result.total_changes)}>
                  {comparison.comparison_result.total_changes} Total Changes
                </Badge>
                
                <div className="flex items-center text-sm text-gray-600">
                  <Clock className="w-4 h-4 mr-1" />
                  {new Date(comparison.created_at).toLocaleString()}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Comparison Views */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="side-by-side">Side by Side</TabsTrigger>
                  <TabsTrigger value="unified">Unified Diff</TabsTrigger>
                  <TabsTrigger value="stats">Statistics</TabsTrigger>
                </TabsList>

                <TabsContent value="side-by-side" className="mt-4">
                  <SideBySideView
                    comparison={comparison}
                    oldVersionInfo={getVersionInfo(selectedOldVersion!)}
                    newVersionInfo={getVersionInfo(selectedNewVersion!)}
                  />
                </TabsContent>

                <TabsContent value="unified" className="mt-4">
                  <UnifiedDiffView comparison={comparison} />
                </TabsContent>

                <TabsContent value="stats" className="mt-4">
                  <ComparisonStats 
                    comparison={comparison}
                    documentId={documentId}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Comparing document versions...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};