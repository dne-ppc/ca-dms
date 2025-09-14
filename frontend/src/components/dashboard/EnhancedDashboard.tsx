/**
 * EnhancedDashboard Component
 * Integrates intro page components with existing dashboard functionality
 * Supports view toggling, personalization, and responsive design
 */
import React, { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { introPageService } from '@/services/introPageService'
import { IntroPage } from '@/components/intro/IntroPage'
import { PersonalizationPanel } from '@/components/intro/PersonalizationPanel'
import type { TransformedIntroPageData } from '@/services/introPageService'

interface Document {
  id: string
  title: string
  document_type: string
  version: number
  created_at: string
  updated_at: string
}

interface EnhancedDashboardProps {
  userId: string
  className?: string
}

type DashboardView = 'overview' | 'documents'
type Theme = 'light' | 'dark'
type Layout = 'compact' | 'standard' | 'expanded'

export const EnhancedDashboard: React.FC<EnhancedDashboardProps> = ({
  userId,
  className
}) => {
  // State management
  const [currentView, setCurrentView] = useState<DashboardView>('overview')
  const [introData, setIntroData] = useState<TransformedIntroPageData | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [introLoading, setIntroLoading] = useState(true)
  const [documentsLoading, setDocumentsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fallbackMode, setFallbackMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Responsive design state
  const [screenSize, setScreenSize] = useState<'mobile' | 'desktop'>('desktop')

  // Current theme and layout from intro data
  const currentTheme: Theme = introData?.personalization?.theme || 'light'
  const currentLayout: Layout = introData?.personalization?.dashboard_layout || 'standard'

  // Handle window resize for responsive design
  useEffect(() => {
    const handleResize = () => {
      setScreenSize(window.innerWidth < 768 ? 'mobile' : 'desktop')
    }

    handleResize() // Set initial size
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Fetch intro page data
  const fetchIntroData = useCallback(async () => {
    try {
      setIntroLoading(true)
      setError(null)
      setFallbackMode(false)

      const data = await introPageService.getIntroPageData(userId)
      setIntroData(data)
    } catch (error) {
      console.error('Failed to fetch intro data, trying fallback:', error)

      try {
        const fallbackData = await introPageService.getIntroPageDataWithFallback(userId)
        setIntroData({ ...fallbackData, fallback_mode: true })
        setFallbackMode(true)
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError)
        setError('Unable to load dashboard data')
      }
    } finally {
      setIntroLoading(false)
    }
  }, [userId])

  // Fetch documents data
  const fetchDocuments = useCallback(async () => {
    try {
      setDocumentsLoading(true)
      const response = await fetch('http://localhost:8000/api/v1/documents/')
      if (!response.ok) {
        throw new Error('Failed to fetch documents')
      }
      const data = await response.json()
      setDocuments(data.documents || [])
    } catch (err) {
      console.error('Failed to fetch documents:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch documents')
    } finally {
      setDocumentsLoading(false)
    }
  }, [])

  // Initial data fetch
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      await Promise.all([fetchIntroData(), fetchDocuments()])
      setLoading(false)
    }

    fetchData()
  }, [fetchIntroData, fetchDocuments])

  // Filter and sort documents
  useEffect(() => {
    let filtered = [...documents]

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(doc =>
        doc.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(doc => doc.document_type === filterType)
    }

    // Sort by updated_at (most recent first)
    filtered.sort((a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )

    setFilteredDocuments(filtered)
  }, [documents, searchQuery, filterType])

  // Handle personalization updates
  const handlePersonalizationUpdate = useCallback(async (updates: any) => {
    if (!introData) return

    try {
      await introPageService.updatePersonalization(userId, updates)

      // Update local state
      setIntroData(prev => prev ? {
        ...prev,
        personalization: { ...prev.personalization, ...updates }
      } : null)
    } catch (error) {
      console.error('Failed to update personalization:', error)
      setError('Failed to update preferences')
    }
  }, [userId, introData])

  // Handle dashboard refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    await Promise.all([fetchIntroData(), fetchDocuments()])
    setIsRefreshing(false)
  }, [fetchIntroData, fetchDocuments])

  // Handle view toggle
  const handleViewToggle = useCallback(() => {
    setCurrentView(prev => prev === 'overview' ? 'documents' : 'overview')
  }, [])

  // Handle keyboard navigation (Tab key)
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Tab') {
      // Allow default Tab behavior
    }
  }, [])

  // Handle document type click from statistics
  const handleDocumentTypeClick = useCallback((documentType: string) => {
    const typeMapping: Record<string, string> = {
      'meeting_minutes': 'meeting',
      'policies': 'policy',
      'notices': 'notice'
    }

    setFilterType(typeMapping[documentType] || documentType)
    setCurrentView('documents')
  }, [])

  // Handle actionable item click
  const handleActionableItemClick = useCallback(() => {
    setCurrentView('documents')
  }, [])

  // Generate CSS classes for theming and layout
  const containerClasses = cn(
    'enhanced-dashboard',
    `theme-${currentTheme}`,
    `layout-${currentLayout}`,
    `responsive-${screenSize}`,
    className
  )

  // Loading skeleton for intro section
  const IntroLoadingSkeleton = () => (
    <div data-testid="intro-loading-skeleton" className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-24 bg-gray-200 rounded animate-pulse" />
      ))}
    </div>
  )

  // Fallback indicator
  const FallbackIndicator = () => (
    <div data-testid="fallback-indicator" className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
      <p className="text-sm">
        <strong>Fallback Mode:</strong> Some features may be limited due to service availability.
      </p>
    </div>
  )

  // Quick access navigation
  const QuickAccessBar = () => (
    <nav data-testid="quick-access-bar" className="flex space-x-4 mb-6" role="navigation" aria-label="Quick access navigation">
      <button
        data-testid="quick-access-create-document"
        onClick={() => window.location.pathname = '/editor'}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
        tabIndex={1}
      >
        Create Document
      </button>
      <button
        data-testid="quick-access-pending-tasks"
        onClick={() => setCurrentView('overview')}
        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors"
        tabIndex={2}
      >
        Pending Tasks ({introData?.actionableItems?.pending_approvals || 0})
      </button>
    </nav>
  )

  // Widget customization panel
  const WidgetCustomizationPanel = () => (
    <div data-testid="widget-customization-panel" className="bg-white rounded-lg shadow p-4 mb-4">
      <h3 className="text-lg font-semibold mb-3">Customize Dashboard</h3>
      <div className="space-y-2">
        {['recent_documents', 'pending_tasks', 'system_stats', 'activity_feed'].map((widget) => (
          <label key={widget} className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={introData?.personalization?.widgets?.includes(widget) || false}
              onChange={() => {
                const currentWidgets = introData?.personalization?.widgets || []
                const newWidgets = currentWidgets.includes(widget)
                  ? currentWidgets.filter(w => w !== widget)
                  : [...currentWidgets, widget]
                handlePersonalizationUpdate({ widgets: newWidgets })
              }}
              role="checkbox"
              aria-label={`${widget.replace('_', ' ')} widget`}
            />
            <span className="text-sm capitalize">{widget.replace('_', ' ')}</span>
          </label>
        ))}
      </div>
    </div>
  )

  // Documents section
  const DocumentsSection = () => (
    <div data-testid="documents-section">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Documents ({filteredDocuments.length})</h2>
        <div className="flex space-x-4">
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded"
            role="combobox"
            aria-label="Filter documents"
          >
            <option value="all">All Types</option>
            <option value="meeting">Meeting Minutes</option>
            <option value="policy">Policies</option>
            <option value="notice">Notices</option>
          </select>
        </div>
      </div>

      {documentsLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDocuments.map((doc) => (
            <div key={doc.id} className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{doc.title}</h3>
                  <p className="text-sm text-gray-500">
                    {doc.document_type} • v{doc.version} • Updated {new Date(doc.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => window.location.pathname = `/editor/${doc.id}`}
                    className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // Skip to content link for accessibility
  const SkipLink = () => (
    <a
      href="#main-content"
      data-testid="skip-to-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-500 text-white px-4 py-2 rounded z-50"
    >
      Skip to main content
    </a>
  )

  if (loading) {
    return (
      <div className={containerClasses}>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div data-testid="dashboard-container" className={containerClasses}>
      <SkipLink />

      <main role="main" id="main-content">
        {fallbackMode && <FallbackIndicator />}

        <div className="dashboard-header mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">CA-DMS Dashboard</h1>
              <p className="text-gray-600">Welcome to your personalized dashboard</p>
            </div>

            <div className="flex items-center space-x-4">
              <button
                data-testid="dashboard-view-toggle"
                onClick={handleViewToggle}
                onKeyDown={handleKeyDown}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
                tabIndex={0}
              >
                {currentView === 'overview' ? 'View Documents' : 'View Overview'}
              </button>

              <button
                data-testid="dashboard-refresh"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        <QuickAccessBar />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            {currentView === 'overview' ? (
              <>
                <div data-testid="intro-page-section">
                  {introLoading ? (
                    <IntroLoadingSkeleton />
                  ) : introData ? (
                    <>
                      {/* User Statistics Display */}
                      <div className="bg-white rounded-lg shadow p-6 mb-6">
                        <h2 className="text-xl font-semibold mb-4">User Statistics</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">{introData.userStatistics?.documentCount || 0}</div>
                            <div className="text-sm text-gray-600">Documents</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">{introData.userStatistics?.templateCount || 0}</div>
                            <div className="text-sm text-gray-600">Templates</div>
                          </div>
                        </div>

                        {/* Document Type Breakdown */}
                        <div className="mt-6">
                          <h3 className="text-lg font-medium mb-3">Document Types</h3>
                          <div className="space-y-2">
                            {Object.entries(introData.userStatistics?.documentTypes || {}).map(([type, count]) => (
                              <div
                                key={type}
                                className="flex justify-between items-center cursor-pointer hover:bg-gray-50 p-2 rounded"
                                onClick={() => handleDocumentTypeClick(type)}
                              >
                                <span className="capitalize">
                                {type === 'meeting_minutes' ? 'Meeting Minutes' :
                                 type === 'policies' ? 'Policies' :
                                 type === 'notices' ? 'Notices' :
                                 type.replace('_', ' ')}: {count}
                              </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <IntroPage
                        data={introData}
                        onDocumentTypeClick={handleDocumentTypeClick}
                        onActionableItemClick={handleActionableItemClick}
                      />
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500">Unable to load dashboard overview</p>
                    </div>
                  )}
                </div>

                <DocumentsSection />
              </>
            ) : (
              <DocumentsSection />
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="space-y-6">
              {/* Widget Customization */}
              <WidgetCustomizationPanel />

              {/* Personalization Panel */}
              <div data-testid="personalization-panel">
                <PersonalizationPanel
                  personalization={introData?.personalization || null}
                  onUpdate={handlePersonalizationUpdate}
                  isLoading={introLoading}
                />
              </div>

              {/* Recent Documents Widget */}
              {introData?.personalization?.widgets?.includes('recent_documents') && (
                <div data-testid="recent-documents-widget" className="bg-white rounded-lg shadow p-4">
                  <h3 className="text-lg font-semibold mb-3">Recent Documents</h3>
                  <div className="space-y-2">
                    {introData?.userStatistics?.recentDocuments?.slice(0, 3).map((doc) => (
                      <div key={doc.id} className="text-sm">
                        <p className="font-medium truncate">{doc.title}</p>
                        <p className="text-gray-500 text-xs">
                          {new Date(doc.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg">
            <p className="text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-2 text-red-700 hover:text-red-900"
            >
              ×
            </button>
          </div>
        )}
      </main>
    </div>
  )
}