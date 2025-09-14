import React, { useMemo } from 'react'
import { FileText, Clock, Eye, BarChart3 } from 'lucide-react'

interface DocumentStatsProps {
  content: string
  title: string
  className?: string
  showDetailed?: boolean
}

interface DocumentStatistics {
  characterCount: number
  characterCountNoSpaces: number
  wordCount: number
  paragraphCount: number
  sentenceCount: number
  readingTimeMinutes: number
  speakingTimeMinutes: number
  avgWordsPerSentence: number
  avgSentencesPerParagraph: number
}

export const DocumentStats: React.FC<DocumentStatsProps> = ({
  content,
  title,
  className = '',
  showDetailed = false
}) => {
  const stats = useMemo((): DocumentStatistics => {
    // Parse Quill Delta content to plain text
    let plainText = ''
    try {
      const delta = typeof content === 'string' ? JSON.parse(content) : content
      if (delta?.ops) {
        plainText = delta.ops
          .map((op: any) => {
            if (typeof op.insert === 'string') {
              return op.insert
            }
            return '' // Skip non-text content like images, placeholders
          })
          .join('')
      } else {
        plainText = content
      }
    } catch {
      plainText = content
    }

    // Basic counts
    const characterCount = plainText.length
    const characterCountNoSpaces = plainText.replace(/\s/g, '').length

    // Word count (split by whitespace and filter empty)
    const words = plainText.trim().split(/\s+/).filter(word => word.length > 0)
    const wordCount = words.length

    // Paragraph count (split by double newlines or single newlines)
    const paragraphs = plainText.split(/\n\s*\n/).filter(p => p.trim().length > 0)
    const paragraphCount = Math.max(paragraphs.length, 1)

    // Sentence count (approximate using periods, exclamation marks, question marks)
    const sentences = plainText.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const sentenceCount = Math.max(sentences.length, 1)

    // Reading time (average 200 words per minute)
    const readingTimeMinutes = Math.max(Math.ceil(wordCount / 200), 1)

    // Speaking time (average 150 words per minute)
    const speakingTimeMinutes = Math.max(Math.ceil(wordCount / 150), 1)

    // Averages
    const avgWordsPerSentence = Math.round(wordCount / sentenceCount)
    const avgSentencesPerParagraph = Math.round(sentenceCount / paragraphCount)

    return {
      characterCount,
      characterCountNoSpaces,
      wordCount,
      paragraphCount,
      sentenceCount,
      readingTimeMinutes,
      speakingTimeMinutes,
      avgWordsPerSentence,
      avgSentencesPerParagraph
    }
  }, [content])

  const formatTime = (minutes: number): string => {
    if (minutes < 1) return '< 1 min'
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }

  if (showDetailed) {
    return (
      <div className={`document-stats-detailed bg-white border rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-blue-600" />
          <h3 className="font-medium text-gray-900">Document Statistics</h3>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          {/* Basic counts */}
          <div className="space-y-2">
            <h4 className="font-medium text-gray-700">Counts</h4>
            <div className="space-y-1 text-gray-600">
              <div className="flex justify-between">
                <span>Characters:</span>
                <span className="font-mono">{stats.characterCount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Characters (no spaces):</span>
                <span className="font-mono">{stats.characterCountNoSpaces.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Words:</span>
                <span className="font-mono">{stats.wordCount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Sentences:</span>
                <span className="font-mono">{stats.sentenceCount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Paragraphs:</span>
                <span className="font-mono">{stats.paragraphCount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Time estimates */}
          <div className="space-y-2">
            <h4 className="font-medium text-gray-700">Time</h4>
            <div className="space-y-1 text-gray-600">
              <div className="flex justify-between">
                <span>Reading time:</span>
                <span className="font-mono">{formatTime(stats.readingTimeMinutes)}</span>
              </div>
              <div className="flex justify-between">
                <span>Speaking time:</span>
                <span className="font-mono">{formatTime(stats.speakingTimeMinutes)}</span>
              </div>
            </div>

            <h4 className="font-medium text-gray-700 mt-3">Averages</h4>
            <div className="space-y-1 text-gray-600">
              <div className="flex justify-between">
                <span>Words/sentence:</span>
                <span className="font-mono">{stats.avgWordsPerSentence}</span>
              </div>
              <div className="flex justify-between">
                <span>Sentences/paragraph:</span>
                <span className="font-mono">{stats.avgSentencesPerParagraph}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Document readability indicator */}
        <div className="mt-4 pt-3 border-t">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Document complexity:</span>
            <span className={`px-2 py-1 rounded ${
              stats.avgWordsPerSentence < 15
                ? 'bg-green-100 text-green-800'
                : stats.avgWordsPerSentence < 25
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
            }`}>
              {stats.avgWordsPerSentence < 15 ? 'Simple' : stats.avgWordsPerSentence < 25 ? 'Moderate' : 'Complex'}
            </span>
          </div>
        </div>
      </div>
    )
  }

  // Compact view for toolbar or status bar
  return (
    <div className={`document-stats-compact flex items-center gap-4 text-xs text-gray-600 ${className}`}>
      <div className="flex items-center gap-1" title="Word count">
        <FileText className="h-3 w-3" />
        <span className="font-mono">{stats.wordCount.toLocaleString()}</span>
      </div>

      <div className="flex items-center gap-1" title="Reading time">
        <Clock className="h-3 w-3" />
        <span>{formatTime(stats.readingTimeMinutes)}</span>
      </div>

      <div className="flex items-center gap-1" title="Characters">
        <Eye className="h-3 w-3" />
        <span className="font-mono">{stats.characterCount.toLocaleString()}</span>
      </div>
    </div>
  )
}

// Hook for document statistics
export const useDocumentStats = (content: string) => {
  return useMemo(() => {
    let plainText = ''
    try {
      const delta = typeof content === 'string' ? JSON.parse(content) : content
      if (delta?.ops) {
        plainText = delta.ops
          .map((op: any) => typeof op.insert === 'string' ? op.insert : '')
          .join('')
      } else {
        plainText = content
      }
    } catch {
      plainText = content
    }

    const words = plainText.trim().split(/\s+/).filter(word => word.length > 0)
    const wordCount = words.length
    const characterCount = plainText.length
    const readingTimeMinutes = Math.max(Math.ceil(wordCount / 200), 1)

    return {
      wordCount,
      characterCount,
      readingTimeMinutes,
      plainText
    }
  }, [content])
}