import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Clock, User, Tag, Star } from 'lucide-react';
import { DocumentVersion } from './DocumentComparison';

interface VersionSelectorProps {
  versions: DocumentVersion[];
  selectedVersion: number | null;
  onVersionSelect: (version: number) => void;
  placeholder?: string;
  excludeVersion?: number | null;
}

export const VersionSelector: React.FC<VersionSelectorProps> = ({
  versions,
  selectedVersion,
  onVersionSelect,
  placeholder = "Select a version",
  excludeVersion
}) => {
  const availableVersions = versions.filter(v => v.version_number !== excludeVersion);
  const sortedVersions = [...availableVersions].sort((a, b) => b.version_number - a.version_number);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const truncateText = (text: string, maxLength: number = 30) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <Select
      value={selectedVersion?.toString() || ''}
      onValueChange={(value) => onVersionSelect(parseInt(value))}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-w-lg">
        {sortedVersions.map((version) => (
          <SelectItem
            key={version.version_number}
            value={version.version_number.toString()}
            className="py-3"
          >
            <div className="flex items-start justify-between w-full">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="font-medium">v{version.version_number}</span>
                  {version.is_major_version && (
                    <Badge variant="secondary" className="text-xs">
                      <Star className="w-3 h-3 mr-1" />
                      Major
                    </Badge>
                  )}
                </div>
                
                <div className="text-sm font-medium text-gray-900 mt-1">
                  {truncateText(version.title)}
                </div>
                
                {version.change_summary && (
                  <div className="text-xs text-gray-600 mt-1">
                    {truncateText(version.change_summary, 50)}
                  </div>
                )}
                
                <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                  <div className="flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatDate(version.created_at)}
                  </div>
                  
                  {version.created_by && (
                    <div className="flex items-center">
                      <User className="w-3 h-3 mr-1" />
                      {version.created_by}
                    </div>
                  )}
                </div>
                
                {version.tags && version.tags.length > 0 && (
                  <div className="flex items-center space-x-1 mt-2">
                    <Tag className="w-3 h-3 text-gray-400" />
                    {version.tags.slice(0, 3).map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs px-1 py-0">
                        {tag}
                      </Badge>
                    ))}
                    {version.tags.length > 3 && (
                      <span className="text-xs text-gray-400">
                        +{version.tags.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </SelectItem>
        ))}
        
        {sortedVersions.length === 0 && (
          <SelectItem value="no-versions" disabled>
            No versions available
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
};