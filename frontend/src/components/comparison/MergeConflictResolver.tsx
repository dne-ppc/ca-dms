import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertTriangle, 
  GitMerge, 
  Check, 
  X, 
  ArrowLeft, 
  ArrowRight,
  ArrowDown,
  FileText,
  User,
  Clock,
  Settings
} from 'lucide-react';

export interface MergeConflict {
  id: string;
  document_id: string;
  base_version: number;
  left_version: number;
  right_version: number;
  conflict_type: string;
  conflict_position: number;
  conflict_length: number;
  base_content?: any;
  left_content?: any;
  right_content?: any;
  is_resolved: boolean;
  resolved_content?: any;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
  created_by?: string;
}

interface MergeConflictResolverProps {
  documentId: string;
  conflicts: MergeConflict[];
  onConflictResolved: (conflictId: string, resolution: any) => void;
  onClose?: () => void;
}

export const MergeConflictResolver: React.FC<MergeConflictResolverProps> = ({
  documentId,
  conflicts,
  onConflictResolved,
  onClose
}) => {
  const [selectedConflict, setSelectedConflict] = useState<MergeConflict | null>(null);
  const [resolutionStrategy, setResolutionStrategy] = useState<string>('manual');
  const [customResolution, setCustomResolution] = useState<string>('');
  const [resolving, setResolving] = useState(false);

  const unresolvedConflicts = conflicts.filter(c => !c.is_resolved);
  const resolvedConflicts = conflicts.filter(c => c.is_resolved);

  useEffect(() => {
    if (unresolvedConflicts.length > 0 && !selectedConflict) {
      setSelectedConflict(unresolvedConflicts[0]);
    }
  }, [unresolvedConflicts, selectedConflict]);

  const handleConflictSelect = (conflict: MergeConflict) => {
    setSelectedConflict(conflict);
    setResolutionStrategy('manual');
    setCustomResolution('');
  };

  const getConflictTypeIcon = (type: string) => {
    switch (type) {
      case 'content_conflict':
        return <FileText className="w-4 h-4" />;
      case 'placeholder_conflict':
        return <Settings className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getConflictTypeLabel = (type: string) => {
    switch (type) {
      case 'content_conflict':
        return 'Content Conflict';
      case 'placeholder_conflict':
        return 'Placeholder Conflict';
      case 'attribute_conflict':
        return 'Attribute Conflict';
      default:
        return 'Unknown Conflict';
    }
  };

  const renderConflictContent = (content: any, label: string, icon: React.ReactNode) => {
    if (!content) return null;

    const displayContent = typeof content === 'string' 
      ? content 
      : JSON.stringify(content, null, 2);

    return (
      <Card className="bg-gray-50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center space-x-2 text-sm">
            {icon}
            <span>{label}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-24">
            <pre className="text-xs font-mono whitespace-pre-wrap break-words">
              {displayContent}
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  };

  const handleStrategyChange = (strategy: string) => {
    setResolutionStrategy(strategy);
    
    if (selectedConflict) {
      switch (strategy) {
        case 'base':
          setCustomResolution(
            typeof selectedConflict.base_content === 'string' 
              ? selectedConflict.base_content 
              : JSON.stringify(selectedConflict.base_content || {})
          );
          break;
        case 'left':
          setCustomResolution(
            typeof selectedConflict.left_content === 'string' 
              ? selectedConflict.left_content 
              : JSON.stringify(selectedConflict.left_content || {})
          );
          break;
        case 'right':
          setCustomResolution(
            typeof selectedConflict.right_content === 'string' 
              ? selectedConflict.right_content 
              : JSON.stringify(selectedConflict.right_content || {})
          );
          break;
        case 'manual':
          setCustomResolution('');
          break;
      }
    }
  };

  const handleResolveConflict = async () => {
    if (!selectedConflict || !customResolution.trim()) return;

    setResolving(true);
    try {
      let resolvedContent: any;
      
      // Try to parse as JSON, fallback to string
      try {
        resolvedContent = JSON.parse(customResolution);
      } catch {
        resolvedContent = customResolution;
      }

      await onConflictResolved(selectedConflict.id, {
        conflict_id: selectedConflict.id,
        resolved_content: resolvedContent,
        resolution_strategy: resolutionStrategy
      });

      // Move to next unresolved conflict or clear selection
      const remainingConflicts = unresolvedConflicts.filter(c => c.id !== selectedConflict.id);
      if (remainingConflicts.length > 0) {
        setSelectedConflict(remainingConflicts[0]);
      } else {
        setSelectedConflict(null);
      }
      
      setCustomResolution('');
      setResolutionStrategy('manual');
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
    } finally {
      setResolving(false);
    }
  };

  if (conflicts.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Check className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Conflicts</h3>
          <p className="text-gray-600">All changes have been merged successfully without conflicts.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <GitMerge className="w-6 h-6 text-orange-600" />
          <div>
            <h2 className="text-xl font-semibold">Merge Conflict Resolution</h2>
            <p className="text-sm text-gray-600">
              {unresolvedConflicts.length} unresolved conflicts, {resolvedConflicts.length} resolved
            </p>
          </div>
        </div>
        {onClose && (
          <Button onClick={onClose} variant="outline" size="sm">
            Close
          </Button>
        )}
      </div>

      {/* Progress Alert */}
      {unresolvedConflicts.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Manual resolution required for {unresolvedConflicts.length} conflicts before the merge can be completed.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conflict List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conflicts List</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {unresolvedConflicts.map((conflict) => (
                    <div
                      key={conflict.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedConflict?.id === conflict.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                      onClick={() => handleConflictSelect(conflict)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2">
                          {getConflictTypeIcon(conflict.conflict_type)}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">
                              {getConflictTypeLabel(conflict.conflict_type)}
                            </div>
                            <div className="text-xs text-gray-600">
                              Position: {conflict.conflict_position}
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          Unresolved
                        </Badge>
                      </div>
                    </div>
                  ))}
                  
                  {resolvedConflicts.map((conflict) => (
                    <div
                      key={conflict.id}
                      className="p-3 rounded-lg border border-green-200 bg-green-50 opacity-75"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2">
                          <Check className="w-4 h-4 text-green-600" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">
                              {getConflictTypeLabel(conflict.conflict_type)}
                            </div>
                            <div className="text-xs text-gray-600">
                              Resolved by {conflict.resolved_by}
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs bg-green-100 text-green-800">
                          Resolved
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Conflict Resolution */}
        <div className="lg:col-span-2">
          {selectedConflict ? (
            <div className="space-y-4">
              {/* Conflict Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    {getConflictTypeIcon(selectedConflict.conflict_type)}
                    <span>{getConflictTypeLabel(selectedConflict.conflict_type)}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Position:</span>
                      <span className="ml-2 font-mono">{selectedConflict.conflict_position}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Length:</span>
                      <span className="ml-2 font-mono">{selectedConflict.conflict_length}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Created:</span>
                      <span className="ml-2">{new Date(selectedConflict.created_at).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Versions:</span>
                      <span className="ml-2">
                        {selectedConflict.base_version} → {selectedConflict.left_version} | {selectedConflict.right_version}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Conflicting Versions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {renderConflictContent(
                  selectedConflict.base_content,
                  `Base (v${selectedConflict.base_version})`,
                  <ArrowDown className="w-4 h-4 text-gray-500" />
                )}
                
                {renderConflictContent(
                  selectedConflict.left_content,
                  `Left (v${selectedConflict.left_version})`,
                  <ArrowLeft className="w-4 h-4 text-blue-500" />
                )}
                
                {renderConflictContent(
                  selectedConflict.right_content,
                  `Right (v${selectedConflict.right_version})`,
                  <ArrowRight className="w-4 h-4 text-purple-500" />
                )}
              </div>

              {/* Resolution Strategy */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Resolution Strategy</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Select value={resolutionStrategy} onValueChange={handleStrategyChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose resolution strategy" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual Resolution</SelectItem>
                        <SelectItem value="base">Use Base Version</SelectItem>
                        <SelectItem value="left">Use Left Version</SelectItem>
                        <SelectItem value="right">Use Right Version</SelectItem>
                      </SelectContent>
                    </Select>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Resolved Content
                      </label>
                      <Textarea
                        value={customResolution}
                        onChange={(e) => setCustomResolution(e.target.value)}
                        placeholder="Enter the resolved content..."
                        className="min-h-32 font-mono text-sm"
                        disabled={resolutionStrategy !== 'manual'}
                      />
                    </div>

                    <div className="flex justify-between">
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <User className="w-4 h-4" />
                        <span>Resolving as current user</span>
                      </div>
                      
                      <Button
                        onClick={handleResolveConflict}
                        disabled={!customResolution.trim() || resolving}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {resolving ? 'Resolving...' : 'Resolve Conflict'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                {unresolvedConflicts.length === 0 ? (
                  <>
                    <Check className="w-12 h-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">All Conflicts Resolved</h3>
                    <p className="text-gray-600">
                      Great work! All merge conflicts have been successfully resolved.
                    </p>
                  </>
                ) : (
                  <>
                    <GitMerge className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Select a Conflict</h3>
                    <p className="text-gray-600">
                      Choose a conflict from the list to begin resolution.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};