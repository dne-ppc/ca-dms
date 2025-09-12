import React, { useEffect, useRef } from 'react';
import Quill from 'quill';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DocumentVersion, DocumentComparisonResponse } from './DocumentComparison';
import { ArrowRight, FileText, Clock, User } from 'lucide-react';

interface SideBySideViewProps {
  comparison: DocumentComparisonResponse;
  oldVersionInfo?: DocumentVersion;
  newVersionInfo?: DocumentVersion;
}

export const SideBySideView: React.FC<SideBySideViewProps> = ({
  comparison,
  oldVersionInfo,
  newVersionInfo
}) => {
  const leftEditorRef = useRef<HTMLDivElement>(null);
  const rightEditorRef = useRef<HTMLDivElement>(null);
  const leftQuillRef = useRef<Quill | null>(null);
  const rightQuillRef = useRef<Quill | null>(null);

  useEffect(() => {
    if (!leftEditorRef.current || !rightEditorRef.current) return;

    // Initialize read-only Quill editors for both sides
    const commonOptions = {
      theme: 'snow',
      readOnly: true,
      modules: {
        toolbar: false,
        history: false
      }
    };

    // Initialize left editor (old version)
    leftQuillRef.current = new Quill(leftEditorRef.current, commonOptions);
    
    // Initialize right editor (new version with changes highlighted)
    rightQuillRef.current = new Quill(rightEditorRef.current, commonOptions);

    // Load diff content with highlighting
    if (comparison.diff_delta) {
      rightQuillRef.current.setContents(comparison.diff_delta);
    }

    // Set up synchronized scrolling
    const syncScroll = (sourceQuill: Quill, targetQuill: Quill) => {
      const sourceScrollContainer = sourceQuill.scrollingContainer;
      const targetScrollContainer = targetQuill.scrollingContainer;

      sourceScrollContainer.addEventListener('scroll', () => {
        const scrollTop = sourceScrollContainer.scrollTop;
        const scrollRatio = scrollTop / (sourceScrollContainer.scrollHeight - sourceScrollContainer.clientHeight);
        
        const targetMaxScroll = targetScrollContainer.scrollHeight - targetScrollContainer.clientHeight;
        targetScrollContainer.scrollTop = scrollRatio * targetMaxScroll;
      });
    };

    if (leftQuillRef.current && rightQuillRef.current) {
      syncScroll(leftQuillRef.current, rightQuillRef.current);
      syncScroll(rightQuillRef.current, leftQuillRef.current);
    }

    return () => {
      leftQuillRef.current = null;
      rightQuillRef.current = null;
    };
  }, [comparison]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getChangesSummary = () => {
    const { added_text, deleted_text, modified_text, total_changes } = comparison.comparison_result;
    const changes = [];
    
    if (added_text > 0) changes.push(`+${added_text} added`);
    if (deleted_text > 0) changes.push(`-${deleted_text} deleted`);
    if (modified_text > 0) changes.push(`~${modified_text} modified`);
    
    return changes.length > 0 ? changes.join(', ') : 'No changes detected';
  };

  return (
    <div className="space-y-4">
      {/* Header with version information */}
      <div className="grid grid-cols-2 gap-4">
        {/* Old Version Info */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-gray-500" />
              <span className="font-semibold">Version {comparison.old_version}</span>
              <Badge variant="secondary">Original</Badge>
            </div>
          </div>
          
          {oldVersionInfo && (
            <div className="space-y-2 text-sm text-gray-600">
              <div className="font-medium text-gray-900">{oldVersionInfo.title}</div>
              {oldVersionInfo.change_summary && (
                <div>{oldVersionInfo.change_summary}</div>
              )}
              <div className="flex items-center space-x-4">
                {oldVersionInfo.created_at && (
                  <div className="flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatDate(oldVersionInfo.created_at)}
                  </div>
                )}
                {oldVersionInfo.created_by && (
                  <div className="flex items-center">
                    <User className="w-3 h-3 mr-1" />
                    {oldVersionInfo.created_by}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* New Version Info */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-gray-500" />
              <span className="font-semibold">Version {comparison.new_version}</span>
              <Badge variant="default">Updated</Badge>
            </div>
          </div>
          
          {newVersionInfo && (
            <div className="space-y-2 text-sm text-gray-600">
              <div className="font-medium text-gray-900">{newVersionInfo.title}</div>
              {newVersionInfo.change_summary && (
                <div>{newVersionInfo.change_summary}</div>
              )}
              <div className="flex items-center space-x-4">
                {newVersionInfo.created_at && (
                  <div className="flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatDate(newVersionInfo.created_at)}
                  </div>
                )}
                {newVersionInfo.created_by && (
                  <div className="flex items-center">
                    <User className="w-3 h-3 mr-1" />
                    {newVersionInfo.created_by}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Changes Summary */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <span className="font-medium">Changes Summary:</span>
            <span className="text-sm text-gray-600">{getChangesSummary()}</span>
          </div>
          <Badge variant="outline">
            {comparison.comparison_result.total_changes} total changes
          </Badge>
        </div>
      </Card>

      {/* Legend */}
      <Card className="p-4">
        <div className="flex items-center space-x-6 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-100 border border-green-200 rounded"></div>
            <span>Added content</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-red-100 border border-red-200 rounded"></div>
            <span>Deleted content</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-yellow-100 border border-yellow-200 rounded"></div>
            <span>Modified content</span>
          </div>
        </div>
      </Card>

      {/* Side by Side Editors */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left Editor - Original Version */}
        <Card className="overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b">
            <h3 className="font-medium text-sm">Original Version {comparison.old_version}</h3>
          </div>
          <div className="h-96">
            <ScrollArea className="h-full">
              <div ref={leftEditorRef} className="h-full" />
            </ScrollArea>
          </div>
        </Card>

        {/* Right Editor - Updated Version with Changes */}
        <Card className="overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b">
            <h3 className="font-medium text-sm">Updated Version {comparison.new_version}</h3>
          </div>
          <div className="h-96">
            <ScrollArea className="h-full">
              <div ref={rightEditorRef} className="h-full" />
            </ScrollArea>
          </div>
        </Card>
      </div>

      {/* Placeholder Changes Summary */}
      {Object.keys(comparison.placeholder_changes).some(key => 
        comparison.placeholder_changes[key].length > 0
      ) && (
        <Card className="p-4">
          <h3 className="font-medium mb-3">Placeholder Changes</h3>
          <div className="space-y-2">
            {Object.entries(comparison.placeholder_changes).map(([type, changes]) => 
              changes.length > 0 && (
                <div key={type} className="text-sm">
                  <span className="font-medium capitalize">{type}:</span>
                  <span className="ml-2 text-gray-600">{changes.length} changes</span>
                </div>
              )
            )}
          </div>
        </Card>
      )}
    </div>
  );
};