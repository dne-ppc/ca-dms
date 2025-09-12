import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DocumentComparisonResponse } from './DocumentComparison';
import { 
  BarChart3, 
  TrendingUp, 
  FileText, 
  Edit, 
  Plus, 
  Minus, 
  RotateCcw,
  Target,
  Activity
} from 'lucide-react';

interface ComparisonStatsProps {
  comparison: DocumentComparisonResponse;
  documentId: string;
}

export const ComparisonStats: React.FC<ComparisonStatsProps> = ({
  comparison,
  documentId
}) => {
  const { comparison_result, placeholder_changes } = comparison;

  // Calculate percentages
  const totalCharacterChanges = comparison_result.added_text + comparison_result.deleted_text + comparison_result.modified_text;
  const addedPercentage = totalCharacterChanges > 0 ? (comparison_result.added_text / totalCharacterChanges) * 100 : 0;
  const deletedPercentage = totalCharacterChanges > 0 ? (comparison_result.deleted_text / totalCharacterChanges) * 100 : 0;
  const modifiedPercentage = totalCharacterChanges > 0 ? (comparison_result.modified_text / totalCharacterChanges) * 100 : 0;

  // Categorize changes by type
  const changesByType = comparison_result.changes.reduce((acc, change) => {
    acc[change.type] = (acc[change.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Calculate placeholder statistics
  const placeholderStats = Object.entries(placeholder_changes).reduce((stats, [type, changes]) => {
    stats[type] = changes.length;
    return stats;
  }, {} as Record<string, number>);

  const totalPlaceholderChanges = Object.values(placeholderStats).reduce((sum, count) => sum + count, 0);

  // Determine change impact level
  const getImpactLevel = () => {
    const changePercentage = (1 - comparison_result.similarity_score) * 100;
    if (changePercentage < 5) return { level: 'Minimal', color: 'text-green-600', bgColor: 'bg-green-100' };
    if (changePercentage < 20) return { level: 'Minor', color: 'text-blue-600', bgColor: 'bg-blue-100' };
    if (changePercentage < 50) return { level: 'Moderate', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
    return { level: 'Major', color: 'text-red-600', bgColor: 'bg-red-100' };
  };

  const impactLevel = getImpactLevel();

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="w-5 h-5 text-blue-500" />
              <div className="flex-1">
                <div className="text-2xl font-bold text-blue-600">
                  {(comparison_result.similarity_score * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">Similarity Score</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-purple-500" />
              <div className="flex-1">
                <div className="text-2xl font-bold text-purple-600">
                  {comparison_result.total_changes}
                </div>
                <div className="text-sm text-gray-600">Total Changes</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-gray-500" />
              <div className="flex-1">
                <div className="text-2xl font-bold text-gray-600">
                  {totalCharacterChanges}
                </div>
                <div className="text-sm text-gray-600">Characters Changed</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Edit className="w-5 h-5 text-orange-500" />
              <div className="flex-1">
                <div className="text-2xl font-bold text-orange-600">
                  {totalPlaceholderChanges}
                </div>
                <div className="text-sm text-gray-600">Placeholder Changes</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Impact Assessment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5" />
            <span>Change Impact Assessment</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium">Impact Level:</span>
            <Badge className={`${impactLevel.color} ${impactLevel.bgColor}`}>
              {impactLevel.level}
            </Badge>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Document Similarity</span>
              <span>{(comparison_result.similarity_score * 100).toFixed(1)}%</span>
            </div>
            <Progress value={comparison_result.similarity_score * 100} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Character Changes Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5" />
            <span>Character Changes Breakdown</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <Plus className="w-4 h-4 text-green-600" />
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span>Added</span>
                  <span>{comparison_result.added_text} characters ({addedPercentage.toFixed(1)}%)</span>
                </div>
                <Progress value={addedPercentage} className="h-2 bg-gray-200">
                  <div className="h-full bg-green-500 rounded-full transition-all" style={{width: `${addedPercentage}%`}} />
                </Progress>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Minus className="w-4 h-4 text-red-600" />
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span>Deleted</span>
                  <span>{comparison_result.deleted_text} characters ({deletedPercentage.toFixed(1)}%)</span>
                </div>
                <Progress value={deletedPercentage} className="h-2 bg-gray-200">
                  <div className="h-full bg-red-500 rounded-full transition-all" style={{width: `${deletedPercentage}%`}} />
                </Progress>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Edit className="w-4 h-4 text-orange-600" />
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span>Modified</span>
                  <span>{comparison_result.modified_text} characters ({modifiedPercentage.toFixed(1)}%)</span>
                </div>
                <Progress value={modifiedPercentage} className="h-2 bg-gray-200">
                  <div className="h-full bg-orange-500 rounded-full transition-all" style={{width: `${modifiedPercentage}%`}} />
                </Progress>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Types Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Change Types Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(changesByType).map(([type, count]) => {
              const getTypeIcon = () => {
                switch (type) {
                  case 'insert': return <Plus className="w-4 h-4 text-green-600" />;
                  case 'delete': return <Minus className="w-4 h-4 text-red-600" />;
                  case 'modify': return <Edit className="w-4 h-4 text-orange-600" />;
                  case 'retain': return <RotateCcw className="w-4 h-4 text-gray-400" />;
                  default: return <FileText className="w-4 h-4 text-gray-400" />;
                }
              };

              return (
                <div key={type} className="text-center p-3 border rounded-lg">
                  <div className="flex justify-center mb-2">
                    {getTypeIcon()}
                  </div>
                  <div className="text-lg font-semibold">{count}</div>
                  <div className="text-xs text-gray-600 capitalize">{type}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Placeholder Changes */}
      {totalPlaceholderChanges > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Placeholder Changes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(placeholderStats).map(([type, count]) => 
                count > 0 && (
                  <div key={type} className="text-center p-3 border rounded-lg">
                    <div className="text-lg font-semibold">{count}</div>
                    <div className="text-xs text-gray-600 capitalize">{type}</div>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comparison Details</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Document ID:</span>
              <span className="font-mono">{documentId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Old Version:</span>
              <span>{comparison.old_version}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">New Version:</span>
              <span>{comparison.new_version}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Compared At:</span>
              <span>{new Date(comparison.created_at).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Change Summary</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Net Character Change:</span>
              <span className={
                (comparison_result.added_text - comparison_result.deleted_text) > 0 
                  ? 'text-green-600' 
                  : (comparison_result.added_text - comparison_result.deleted_text) < 0 
                    ? 'text-red-600' 
                    : 'text-gray-600'
              }>
                {comparison_result.added_text - comparison_result.deleted_text > 0 ? '+' : ''}
                {comparison_result.added_text - comparison_result.deleted_text}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Change Density:</span>
              <span>
                {totalCharacterChanges > 0 
                  ? `${(comparison_result.total_changes / totalCharacterChanges * 100).toFixed(2)} changes/char`
                  : 'N/A'
                }
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};