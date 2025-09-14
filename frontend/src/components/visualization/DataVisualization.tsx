/**
 * Data Visualization Components
 * Chart and graph components for statistics display
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'

// Type definitions
interface BarData {
  label: string
  value: number
  color: string
}

interface LineData {
  date: string
  value: number
}

interface DonutData {
  label: string
  value: number
  percentage: number
  color: string
}

interface TimelineData {
  date: string
  documents: number
  collaborations: number
  total: number
}

// Common chart props
interface BaseChartProps {
  title?: string
  height?: number
  className?: string
  ariaLabel?: string
  responsive?: boolean
}

// BarChart Component
interface BarChartProps extends BaseChartProps {
  data: BarData[]
  interactive?: boolean
  onBarClick?: (item: BarData) => void
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  title,
  height = 200,
  interactive = false,
  onBarClick,
  ariaLabel,
  responsive = false,
  className
}) => {
  const [hoveredBar, setHoveredBar] = useState<string | null>(null)
  const [containerWidth, setContainerWidth] = useState(400)
  const containerRef = useRef<HTMLDivElement>(null)

  // Handle responsive resizing
  useEffect(() => {
    if (!responsive) return

    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth)
      }
    }

    const resizeObserver = new ResizeObserver(handleResize)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    window.addEventListener('resize', handleResize)
    handleResize()

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', handleResize)
    }
  }, [responsive])

  const maxValue = Math.max(...data.map(item => item.value))
  const barWidth = Math.max(20, (containerWidth - 100) / data.length - 10)

  if (data.length === 0) {
    return (
      <div className={cn('p-4 text-center', className)}>
        {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
        <div data-testid="chart-empty-state" className="bg-gray-50 rounded-lg p-8">
          <p className="text-gray-500">No data available to display</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative', responsive && 'chart-responsive', className)}
      data-testid="chart-container"
    >
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}

      <svg
        data-testid="chart-svg"
        width="100%"
        height={height}
        viewBox={`0 0 ${containerWidth} ${height}`}
        role="img"
        aria-label={ariaLabel || `Bar chart showing ${title || 'data'}`}
        aria-describedby={title ? `chart-desc-${title.replace(/\s+/g, '-').toLowerCase()}` : undefined}
        className="w-full"
      >
        {/* Chart bars */}
        {data.map((item, index) => {
          const barHeight = (item.value / maxValue) * (height - 60)
          const x = 50 + index * (barWidth + 10)
          const y = height - barHeight - 30

          return (
            <g key={item.label}>
              <rect
                data-testid={`bar-${item.label}`}
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={item.color}
                className={cn(
                  'transition-all duration-200',
                  interactive && 'cursor-pointer hover:opacity-80',
                  hoveredBar === item.label && 'opacity-90'
                )}
                tabIndex={interactive ? 0 : -1}
                onMouseEnter={() => interactive && setHoveredBar(item.label)}
                onMouseLeave={() => interactive && setHoveredBar(null)}
                onClick={() => onBarClick?.(item)}
              />
              <text
                x={x + barWidth / 2}
                y={height - 10}
                textAnchor="middle"
                className="text-xs fill-gray-600"
              >
                {item.label}
              </text>
              <text
                x={x + barWidth / 2}
                y={y - 5}
                textAnchor="middle"
                className="text-xs fill-gray-800 font-medium"
              >
                {item.value}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Tooltip */}
      {interactive && hoveredBar && (
        <div
          data-testid="chart-tooltip"
          className="absolute bg-black text-white px-2 py-1 rounded text-sm pointer-events-none"
          style={{ top: 10, left: 10 }}
        >
          {hoveredBar}: {data.find(d => d.label === hoveredBar)?.value}
        </div>
      )}
    </div>
  )
}

// LineChart Component
interface LineChartProps extends BaseChartProps {
  data: LineData[]
  xAxisLabel?: string
  yAxisLabel?: string
  onPointClick?: (date: string, value: number) => void
  enableZoom?: boolean
  enablePan?: boolean
  includeDataTable?: boolean
}

export const LineChart: React.FC<LineChartProps> = ({
  data,
  title,
  height = 200,
  xAxisLabel,
  yAxisLabel,
  onPointClick,
  enableZoom = false,
  enablePan = false,
  includeDataTable = false,
  ariaLabel,
  responsive = false,
  className
}) => {
  const [zoomLevel, setZoomLevel] = useState(100)
  const [containerWidth, setContainerWidth] = useState(400)
  const containerRef = useRef<HTMLDivElement>(null)

  // Handle responsive resizing
  useEffect(() => {
    if (!responsive) return

    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth)
      }
    }

    const resizeObserver = new ResizeObserver(handleResize)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    window.addEventListener('resize', handleResize)
    handleResize()

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', handleResize)
    }
  }, [responsive])

  const maxValue = Math.max(...data.map(item => item.value))
  const minValue = Math.min(...data.map(item => item.value))
  const padding = 50

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getPathData = () => {
    if (data.length === 0) return ''

    const points = data.map((item, index) => {
      const x = padding + (index / (data.length - 1)) * (containerWidth - 2 * padding)
      const y = padding + ((maxValue - item.value) / (maxValue - minValue)) * (height - 2 * padding)
      return `${x},${y}`
    })

    return `M ${points.join(' L ')}`
  }

  const handleZoom = (direction: 'in' | 'out' | 'reset') => {
    if (direction === 'reset') {
      setZoomLevel(100)
    } else {
      const delta = direction === 'in' ? 50 : -50
      setZoomLevel(prev => Math.max(50, Math.min(300, prev + delta)))
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative', responsive && 'chart-responsive', className)}
      data-testid="line-chart-container"
    >
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}

      {/* Zoom controls */}
      {enableZoom && (
        <div className="absolute top-2 right-2 flex space-x-1">
          <button
            data-testid="zoom-in-button"
            onClick={() => handleZoom('in')}
            className="bg-white border rounded px-2 py-1 text-xs hover:bg-gray-50"
          >
            +
          </button>
          <button
            data-testid="zoom-out-button"
            onClick={() => handleZoom('out')}
            className="bg-white border rounded px-2 py-1 text-xs hover:bg-gray-50"
          >
            -
          </button>
          <button
            data-testid="reset-zoom-button"
            onClick={() => handleZoom('reset')}
            className="bg-white border rounded px-2 py-1 text-xs hover:bg-gray-50"
          >
            Reset
          </button>
          <span data-testid="zoom-level-indicator" className="text-xs self-center">
            {zoomLevel}%
          </span>
        </div>
      )}

      <svg
        data-testid="chart-svg"
        width="100%"
        height={height}
        viewBox={`0 0 ${containerWidth} ${height}`}
        role="img"
        aria-label={ariaLabel || `Line chart showing ${title || 'trend data'}`}
        className="w-full"
      >
        {/* Axis labels */}
        {xAxisLabel && (
          <text
            x={containerWidth / 2}
            y={height - 10}
            textAnchor="middle"
            className="text-sm fill-gray-600"
          >
            {xAxisLabel}
          </text>
        )}
        {yAxisLabel && (
          <text
            x={15}
            y={height / 2}
            textAnchor="middle"
            className="text-sm fill-gray-600"
            transform={`rotate(-90, 15, ${height / 2})`}
          >
            {yAxisLabel}
          </text>
        )}

        {/* Line path */}
        <path
          data-testid="line-chart-path"
          d={getPathData()}
          fill="none"
          stroke="#3B82F6"
          strokeWidth="2"
          className="transition-all duration-300"
          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'center' }}
        />

        {/* Data points */}
        {data.map((item, index) => {
          const x = padding + (index / (data.length - 1)) * (containerWidth - 2 * padding)
          const y = padding + ((maxValue - item.value) / (maxValue - minValue)) * (height - 2 * padding)

          return (
            <circle
              key={item.date}
              data-testid={`data-point-${item.date}`}
              cx={x}
              cy={y}
              r="4"
              fill="#3B82F6"
              className="cursor-pointer hover:r-6 transition-all"
              onClick={() => onPointClick?.(item.date, item.value)}
            />
          )
        })}
      </svg>

      {/* Data table for accessibility */}
      {includeDataTable && (
        <table data-testid="chart-data-table" className="sr-only" role="table">
          <thead>
            <tr>
              <th role="columnheader">Date</th>
              <th role="columnheader">Value</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.date}>
                <td>{formatDate(item.date)}</td>
                <td>{item.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// DonutChart Component
interface DonutChartProps extends BaseChartProps {
  data: DonutData[]
  centerText?: string
  size?: number
  interactive?: boolean
}

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  title,
  centerText,
  size = 200,
  interactive = false,
  ariaLabel,
  responsive = false,
  className
}) => {
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null)
  const [focusedSegment, setFocusedSegment] = useState<number>(-1)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const center = size / 2
  const radius = size / 2 - 20
  const innerRadius = radius * 0.6

  const total = data.reduce((sum, item) => sum + item.value, 0)
  let currentAngle = 0

  const segments = data.map((item, index) => {
    const angle = (item.value / total) * 2 * Math.PI
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle += angle

    const x1 = center + radius * Math.cos(startAngle)
    const y1 = center + radius * Math.sin(startAngle)
    const x2 = center + radius * Math.cos(endAngle)
    const y2 = center + radius * Math.sin(endAngle)

    const x3 = center + innerRadius * Math.cos(endAngle)
    const y3 = center + innerRadius * Math.sin(endAngle)
    const x4 = center + innerRadius * Math.cos(startAngle)
    const y4 = center + innerRadius * Math.sin(startAngle)

    const largeArc = angle > Math.PI ? 1 : 0

    const pathData = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}`,
      'Z'
    ].join(' ')

    return {
      ...item,
      pathData,
      index
    }
  })

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      const nextIndex = (index + 1) % data.length
      setFocusedSegment(nextIndex)
      // Focus the next segment
      const nextSegment = document.querySelector(`[data-testid="segment-${data[nextIndex].label}"]`) as HTMLElement
      nextSegment?.focus()
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      const prevIndex = (index - 1 + data.length) % data.length
      setFocusedSegment(prevIndex)
      // Focus the previous segment
      const prevSegment = document.querySelector(`[data-testid="segment-${data[prevIndex].label}"]`) as HTMLElement
      prevSegment?.focus()
    }
  }

  const currentDisplayText = hoveredSegment
    ? (() => {
        const segment = data.find(d => d.label === hoveredSegment)
        return segment ? `${segment.label}\n${segment.value} items (${segment.percentage}%)` : centerText
      })()
    : centerText

  return (
    <div className={cn(
      'relative',
      responsive && 'chart-responsive',
      isMobile && 'chart-mobile',
      className
    )} data-testid="chart-container">
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}

      <div className="flex flex-col items-center">
        <svg
          data-testid="donut-chart-svg"
          width={size}
          height={size}
          role="img"
          aria-label={ariaLabel || `Donut chart showing ${title || 'data distribution'}`}
        >
          {segments.map((segment) => (
            <path
              key={segment.label}
              data-testid={`segment-${segment.label}`}
              d={segment.pathData}
              fill={segment.color}
              className={cn(
                'transition-all duration-200',
                interactive && 'cursor-pointer hover:opacity-80'
              )}
              {...(interactive && { tabIndex: 0 })}
              onMouseEnter={() => interactive && setHoveredSegment(segment.label)}
              onMouseLeave={() => interactive && setHoveredSegment(null)}
              onKeyDown={(e) => handleKeyDown(e, segment.index)}
            />
          ))}

          {/* Center text */}
          <text
            x={center}
            y={center}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-sm font-medium fill-gray-800"
          >
            {currentDisplayText?.split('\n').map((line, i) => (
              <tspan key={i} x={center} dy={i === 0 ? 0 : '1.2em'}>
                {line}
              </tspan>
            ))}
          </text>
        </svg>

        {/* Legend */}
        <div
          data-testid="chart-legend"
          className={cn(
            'mt-4 space-y-2',
            isMobile && 'legend-stacked'
          )}
        >
          {data.map((item) => (
            <div key={item.label} className="flex items-center space-x-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm">
                {item.label} ({item.percentage}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ProgressBar Component
interface ProgressBarProps {
  percentage: number
  label?: string
  color?: 'blue' | 'green' | 'red' | 'yellow'
  variant?: 'thin' | 'thick'
  showPercentage?: boolean
  animated?: boolean
  className?: string
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percentage,
  label,
  color = 'blue',
  variant = 'thin',
  showPercentage = false,
  animated = false,
  className
}) => {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    yellow: 'bg-yellow-500'
  }

  const heightClasses = {
    thin: 'h-2',
    thick: 'h-4'
  }

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600">{label}</span>
          {showPercentage && (
            <span className="text-sm font-medium">{percentage}%</span>
          )}
        </div>
      )}

      <div
        data-testid="progress-bar"
        className={cn(
          'w-full bg-gray-200 rounded-full overflow-hidden',
          heightClasses[variant],
          `progress-${color}`,
          variant === 'thick' && 'progress-thick'
        )}
      >
        <div
          data-testid="progress-fill"
          className={cn(
            'h-full rounded-full transition-all duration-500',
            colorClasses[color],
            animated && 'progress-animated'
          )}
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>
    </div>
  )
}

// MetricCard Component
interface MetricCardProps {
  title: string
  value: number | string
  subtitle?: string
  trend?: 'up' | 'down' | 'stable'
  trendValue?: string
  icon?: string
  size?: 'compact' | 'normal'
  variant?: 'filled' | 'outlined'
  className?: string
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon,
  size = 'normal',
  variant = 'filled',
  className
}) => {
  const formatNumber = (num: number | string): string => {
    if (typeof num === 'string') return num
    return num.toLocaleString()
  }

  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    stable: 'text-gray-600'
  }

  const trendIcons = {
    up: '↗',
    down: '↘',
    stable: '→'
  }

  return (
    <div
      data-testid="metric-card"
      className={cn(
        'bg-white rounded-lg p-4',
        variant === 'filled' ? 'shadow' : 'border',
        size === 'compact' ? 'metric-compact' : '',
        variant === 'outlined' && 'metric-outlined',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatNumber(value)}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500">{subtitle}</p>
          )}
        </div>

        {trend && (
          <div
            data-testid="trend-indicator"
            className={cn(
              'flex items-center space-x-1 text-sm',
              trendColors[trend],
              `trend-${trend}`
            )}
          >
            <span>{trendIcons[trend]}</span>
            {trendValue && <span>{trendValue}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

// TimelineChart Component
interface TimelineChartProps extends BaseChartProps {
  data: TimelineData[]
  showBreakdown?: boolean
  enableSelection?: boolean
  onDateRangeChange?: (date: string) => void
}

export const TimelineChart: React.FC<TimelineChartProps> = ({
  data,
  title,
  height = 150,
  showBreakdown = false,
  enableSelection = false,
  onDateRangeChange,
  responsive = false,
  className
}) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [containerWidth, setContainerWidth] = useState(400)
  const containerRef = useRef<HTMLDivElement>(null)

  // Handle responsive resizing
  useEffect(() => {
    if (!responsive) return

    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth)
      }
    }

    const resizeObserver = new ResizeObserver(handleResize)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    window.addEventListener('resize', handleResize)
    handleResize()

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', handleResize)
    }
  }, [responsive])

  const maxValue = Math.max(...data.map(item => item.total))
  const barWidth = Math.max(20, (containerWidth - 100) / data.length - 10)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const handleBarClick = (date: string) => {
    if (enableSelection) {
      setSelectedDate(date)
      onDateRangeChange?.(date)
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative', responsive && 'chart-responsive', className)}
      data-testid="timeline-chart"
    >
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}

      {/* Legend */}
      {showBreakdown && (
        <div data-testid="timeline-legend" className="mb-4 flex space-x-4">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-blue-500 rounded" />
            <span className="text-sm">Documents</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-green-500 rounded" />
            <span className="text-sm">Collaborations</span>
          </div>
        </div>
      )}

      <svg
        data-testid="chart-svg"
        width="100%"
        height={height}
        viewBox={`0 0 ${containerWidth} ${height}`}
        className="w-full"
      >
        {data.map((item, index) => {
          const x = 50 + index * (barWidth + 10)
          const isSelected = selectedDate === item.date

          if (showBreakdown) {
            // Stacked bars
            const docHeight = (item.documents / maxValue) * (height - 60)
            const collabHeight = (item.collaborations / maxValue) * (height - 60)
            const docY = height - docHeight - 30
            const collabY = docY - collabHeight

            return (
              <g key={item.date}>
                <rect
                  data-testid={`stacked-bar-${item.date}`}
                  x={x}
                  y={docY}
                  width={barWidth}
                  height={docHeight}
                  fill="#3B82F6"
                  className={cn(
                    'transition-all duration-200',
                    enableSelection && 'cursor-pointer hover:opacity-80'
                  )}
                  onClick={() => handleBarClick(item.date)}
                />
                <rect
                  x={x}
                  y={collabY}
                  width={barWidth}
                  height={collabHeight}
                  fill="#10B981"
                  className={cn(
                    'transition-all duration-200',
                    enableSelection && 'cursor-pointer hover:opacity-80'
                  )}
                  onClick={() => handleBarClick(item.date)}
                />
                <text
                  x={x + barWidth / 2}
                  y={height - 10}
                  textAnchor="middle"
                  className="text-xs fill-gray-600"
                >
                  {formatDate(item.date)}
                </text>
                <text
                  x={x + barWidth / 2}
                  y={collabY - 5}
                  textAnchor="middle"
                  className="text-xs fill-gray-800 font-medium"
                >
                  {item.total}
                </text>
              </g>
            )
          } else {
            // Simple bars
            const barHeight = (item.total / maxValue) * (height - 60)
            const y = height - barHeight - 30

            return (
              <g key={item.date}>
                <rect
                  data-testid={`timeline-bar-${item.date}`}
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={isSelected ? "#1D4ED8" : "#3B82F6"}
                  className={cn(
                    'transition-all duration-200',
                    enableSelection && 'cursor-pointer hover:opacity-80'
                  )}
                  onClick={() => handleBarClick(item.date)}
                />
                <text
                  x={x + barWidth / 2}
                  y={height - 10}
                  textAnchor="middle"
                  className="text-xs fill-gray-600"
                >
                  {formatDate(item.date)}
                </text>
                <text
                  x={x + barWidth / 2}
                  y={y - 5}
                  textAnchor="middle"
                  className="text-xs fill-gray-800 font-medium"
                >
                  {item.total}
                </text>
              </g>
            )
          }
        })}
      </svg>

      {/* Selection indicator */}
      {enableSelection && selectedDate && (
        <div data-testid="selection-indicator" className="mt-2 text-xs text-blue-600">
          Selected: {formatDate(selectedDate)}
        </div>
      )}
    </div>
  )
}