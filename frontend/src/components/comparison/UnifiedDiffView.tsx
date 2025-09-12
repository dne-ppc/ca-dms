import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DocumentComparisonResponse } from './DocumentComparison';
import { Plus, Minus, Edit, RotateCcw } from 'lucide-react';

interface UnifiedDiffViewProps {
  comparison: DocumentComparisonResponse;
}

export const UnifiedDiffView: React.FC<UnifiedDiffViewProps> = ({
  comparison
}) => {
  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case 'insert':
        return <Plus className="w-4 h-4 text-green-600" />;
      case 'delete':
        return <Minus className="w-4 h-4 text-red-600" />;
      case 'modify':
        return <Edit className="w-4 h-4 text-orange-600" />;
      case 'retain':
        return <RotateCcw className="w-4 h-4 text-gray-400" />;
      default:
        return null;
    }
  };

  const getChangeColorClass = (changeType: string) => {
    switch (changeType) {
      case 'insert':
        return 'bg-green-50 border-l-4 border-green-400 text-green-900';
      case 'delete':
        return 'bg-red-50 border-l-4 border-red-400 text-red-900';
      case 'modify':
        return 'bg-orange-50 border-l-4 border-orange-400 text-orange-900';
      case 'retain':
        return 'bg-gray-50 border-l-4 border-gray-300 text-gray-700';
      default:
        return 'bg-white';
    }
  };

  const getChangeLabel = (changeType: string) => {
    switch (changeType) {
      case 'insert':
        return 'Added';
      case 'delete':
        return 'Removed';
      case 'modify':
        return 'Modified';
      case 'retain':
        return 'Unchanged';
      default:
        return 'Unknown';
    }
  };

  const renderOperationContent = (op: any) => {
    if (!op) return 'N/A';
    
    if (typeof op.insert === 'string') {
      // Handle text content
      const text = op.insert.length > 100 ? op.insert.substring(0, 100) + '...' : op.insert;
      return (
        <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
          {JSON.stringify(text)}
        </code>
      );
    } else if (typeof op.insert === 'object') {
      // Handle placeholder objects
      const objectType = Object.keys(op.insert)[0];
      return (
        <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
          {objectType.toUpperCase()} Placeholder
        </span>
      );
    } else if (op.attributes) {
      // Handle attribute changes
      return (
        <div className="text-xs">
          <span className="font-medium">Attributes:</span>
          {Object.entries(op.attributes).map(([key, value]) => (
            <span key={key} className="ml-2 px-1 bg-gray-100 rounded">
              {key}: {String(value)}
            </span>
          ))}
        </div>
      );
    }
    
    return 'Content change';
  };

  const groupedChanges = comparison.comparison_result.changes.reduce((groups, change, index) => {
    const groupKey = `${change.position}-${change.type}`;
    if (!groups[groupKey]) {
      groups[groupKey] = {
        type: change.type,
        position: change.position,
        changes: []
      };
    }
    groups[groupKey].changes.push({ ...change, index });
    return groups;
  }, {} as Record<string, any>);

  const sortedGroups = Object.values(groupedChanges).sort((a: any, b: any) => a.position - b.position);

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Unified Diff View</h3>
          <div className="flex items-center space-x-4">
            <Badge variant="outline" className="text-green-700 bg-green-50">
              +{comparison.comparison_result.added_text} added
            </Badge>
            <Badge variant="outline" className="text-red-700 bg-red-50">
              -{comparison.comparison_result.deleted_text} removed
            </Badge>
            <Badge variant="outline" className="text-orange-700 bg-orange-50">
              ~{comparison.comparison_result.modified_text} modified
            </Badge>
          </div>
        </div>
      </Card>

      {/* Diff Content */}
      <Card className="overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">
              Changes (Version {comparison.old_version} → {comparison.new_version})
            </span>
            <span className="text-xs text-gray-600">
              {sortedGroups.length} change groups
            </span>
          </div>
        </div>
        
        <ScrollArea className="h-96">
          <div className="divide-y divide-gray-200">
            {sortedGroups.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No changes detected between the selected versions.
              </div>
            ) : (
              sortedGroups.map((group: any, groupIndex) => (
                <div key={groupIndex} className={`p-4 ${getChangeColorClass(group.type)}`}>
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {getChangeIcon(group.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="text-xs">
                            {getChangeLabel(group.type)}
                          </Badge>
                          <span className="text-xs text-gray-600">
                            Position: {group.position}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {group.changes.length} change{group.changes.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      
                      {group.changes.map((change: any, changeIndex: number) => (
                        <div key={changeIndex} className="space-y-2">
                          {change.old_op && group.type !== 'insert' && (
                            <div className="bg-white bg-opacity-50 p-2 rounded border-l-2 border-red-300">
                              <div className="text-xs font-medium text-red-700 mb-1">Before:</div>
                              <div>{renderOperationContent(change.old_op)}</div>
                            </div>
                          )}
                          
                          {change.new_op && group.type !== 'delete' && (
                            <div className="bg-white bg-opacity-50 p-2 rounded border-l-2 border-green-300">
                              <div className="text-xs font-medium text-green-700 mb-1">After:</div>
                              <div>{renderOperationContent(change.new_op)}</div>
                            </div>
                          )}
                          
                          {change.attributes_changed && change.attributes_changed.length > 0 && (
                            <div className="bg-white bg-opacity-50 p-2 rounded border-l-2 border-orange-300">
                              <div className="text-xs font-medium text-orange-700 mb-1">
                                Changed Attributes:
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {change.attributes_changed.map((attr: string, attrIndex: number) => (
                                  <Badge key={attrIndex} variant="outline" className="text-xs">
                                    {attr}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {change.length > 0 && (
                            <div className="text-xs text-gray-600">
                              Length: {change.length} characters
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Context Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h4 className="font-medium mb-2 text-sm">Document Context</h4>
          <div className="space-y-1 text-sm text-gray-600">
            <div>Document ID: {comparison.document_id}</div>
            <div>Comparison created: {new Date(comparison.created_at).toLocaleString()}</div>
            <div>
              Similarity: {(comparison.comparison_result.similarity_score * 100).toFixed(1)}%
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <h4 className="font-medium mb-2 text-sm">Change Statistics</h4>
          <div className="space-y-1 text-sm text-gray-600">
            <div>Total changes: {comparison.comparison_result.total_changes}</div>
            <div>Added text: {comparison.comparison_result.added_text} chars</div>
            <div>Removed text: {comparison.comparison_result.deleted_text} chars</div>
            <div>Modified text: {comparison.comparison_result.modified_text} chars</div>
          </div>
        </Card>
      </div>

      {/* Legend */}
      <Card className="p-4">
        <h4 className="font-medium mb-3 text-sm">Legend</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="flex items-center space-x-2">
            <Plus className="w-4 h-4 text-green-600" />
            <span>Added content</span>
          </div>
          <div className="flex items-center space-x-2">
            <Minus className="w-4 h-4 text-red-600" />
            <span>Removed content</span>
          </div>
          <div className="flex items-center space-x-2">
            <Edit className="w-4 h-4 text-orange-600" />
            <span>Modified content</span>
          </div>
          <div className="flex items-center space-x-2">
            <RotateCcw className="w-4 h-4 text-gray-400" />
            <span>Unchanged content</span>
          </div>
        </div>
      </Card>
    </div>
  );
};