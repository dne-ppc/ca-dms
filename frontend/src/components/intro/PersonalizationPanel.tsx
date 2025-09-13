/**
 * PersonalizationPanel Component
 * Allows users to customize their dashboard preferences
 */
import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Label } from '../ui/label'

interface Personalization {
  theme: 'light' | 'dark'
  dashboard_layout: 'compact' | 'standard' | 'expanded'
  notifications: {
    email: boolean
    push: boolean
    in_app: boolean
  }
  widgets: string[]
  language?: string
  timezone?: string
}

interface PersonalizationPanelProps {
  personalization: Personalization | null
  onUpdate: (updates: Partial<Personalization>) => void
  isLoading: boolean
}

export const PersonalizationPanel: React.FC<PersonalizationPanelProps> = ({
  personalization,
  onUpdate,
  isLoading
}) => {
  const [localSettings, setLocalSettings] = useState(personalization)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Personalization</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-4 bg-gray-200 rounded animate-pulse"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!personalization) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Personalization</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Personalization settings unavailable</p>
        </CardContent>
      </Card>
    )
  }

  const handleThemeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newTheme = event.target.value as 'light' | 'dark'
    onUpdate({ theme: newTheme })
  }

  const handleLayoutChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newLayout = event.target.value as 'compact' | 'standard' | 'expanded'
    onUpdate({ dashboard_layout: newLayout })
  }

  const handleNotificationToggle = (type: keyof Personalization['notifications']) => {
    onUpdate({
      notifications: {
        ...personalization.notifications,
        [type]: !personalization.notifications[type]
      }
    })
  }

  const handleWidgetToggle = (widget: string) => {
    const currentWidgets = personalization.widgets || []
    const newWidgets = currentWidgets.includes(widget)
      ? currentWidgets.filter(w => w !== widget)
      : [...currentWidgets, widget]

    onUpdate({ widgets: newWidgets })
  }

  const availableWidgets = [
    { id: 'recent_documents', label: 'Recent Documents' },
    { id: 'pending_tasks', label: 'Pending Tasks' },
    { id: 'system_stats', label: 'System Statistics' },
    { id: 'activity_feed', label: 'Activity Feed' },
    { id: 'quick_actions', label: 'Quick Actions' }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personalization</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Theme Selection */}
        <div>
          <Label htmlFor="theme-select" className="text-sm font-medium text-gray-700">
            Theme
          </Label>
          <select
            id="theme-select"
            value={personalization.theme}
            onChange={handleThemeChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            role="combobox"
            aria-label="Theme"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        {/* Layout Selection */}
        <div>
          <Label htmlFor="layout-select" className="text-sm font-medium text-gray-700">
            Dashboard Layout
          </Label>
          <select
            id="layout-select"
            value={personalization.dashboard_layout}
            onChange={handleLayoutChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            role="combobox"
            aria-label="Layout"
          >
            <option value="compact">Compact</option>
            <option value="standard">Standard</option>
            <option value="expanded">Expanded</option>
          </select>
        </div>

        {/* Notification Preferences */}
        <div>
          <Label className="text-sm font-medium text-gray-700 mb-3 block">
            Notifications
          </Label>
          <div className="space-y-3">
            {Object.entries(personalization.notifications).map(([type, enabled]) => (
              <div key={type} className="flex items-center justify-between">
                <Label
                  htmlFor={`notification-${type}`}
                  className="text-sm text-gray-600 capitalize"
                >
                  {type.replace('_', ' ')} Notifications
                </Label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id={`notification-${type}`}
                    type="checkbox"
                    checked={enabled}
                    onChange={() => handleNotificationToggle(type as keyof Personalization['notifications'])}
                    className="sr-only peer"
                    role="switch"
                    aria-label={`${type.replace('_', ' ')} notifications`}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Widget Configuration */}
        <div>
          <Label className="text-sm font-medium text-gray-700 mb-3 block">
            Dashboard Widgets
          </Label>
          <div className="space-y-2">
            {availableWidgets.map((widget) => (
              <div key={widget.id} className="flex items-center space-x-2">
                <input
                  id={`widget-${widget.id}`}
                  type="checkbox"
                  checked={personalization.widgets?.includes(widget.id) || false}
                  onChange={() => handleWidgetToggle(widget.id)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  role="checkbox"
                  aria-label={widget.label}
                />
                <Label
                  htmlFor={`widget-${widget.id}`}
                  className="text-sm text-gray-600"
                >
                  {widget.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Additional Settings */}
        {(personalization.language || personalization.timezone) && (
          <div className="border-t pt-4">
            <div className="text-sm text-gray-500">
              {personalization.language && (
                <div>Language: {personalization.language.toUpperCase()}</div>
              )}
              {personalization.timezone && (
                <div>Timezone: {personalization.timezone}</div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-2 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.pathname = '/settings'}
            className="flex-1"
          >
            Advanced Settings
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Reset to defaults
              onUpdate({
                theme: 'light',
                dashboard_layout: 'standard',
                notifications: { email: true, push: false, in_app: true },
                widgets: ['recent_documents', 'pending_tasks']
              })
            }}
            className="flex-1"
          >
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}