import { createClient, RealtimeChannel, RealtimeClient } from '@supabase/supabase-js'
import type { Document, PlaceholderObject } from '../types'

// Types for real-time events
export interface DocumentChangeEvent {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  document: Document | null
  previous: Document | null
  changes?: string[]
  contentChanged?: boolean
}

export interface PlaceholderChangeEvent {
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  placeholder: PlaceholderObject
  timestamp: number
  userId?: string
}

export interface PresenceInfo {
  userId: string
  name: string
  cursor?: { index: number; length: number }
  online_at?: string
}

export interface PresenceChangeEvent {
  event: 'join' | 'leave' | 'sync'
  user: string
  presence: PresenceInfo
}

export type ConnectionStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR'

// Subscription callback types
export type DocumentChangeCallback = (event: DocumentChangeEvent) => void
export type PlaceholderChangeCallback = (event: PlaceholderChangeEvent) => void
export type PresenceChangeCallback = (event: PresenceChangeEvent) => void
export type ConnectionStateCallback = (status: ConnectionStatus) => void

class RealtimeService {
  private client: RealtimeClient | null = null
  private channels: Map<string, RealtimeChannel> = new Map()
  private connectionStatus: ConnectionStatus = 'DISCONNECTED'
  private connectionCallbacks: ConnectionStateCallback[] = []
  private subscriptionCallbacks: Map<string, any[]> = new Map()
  private readonly maxSubscriptions = 10
  private throttleTimers: Map<string, NodeJS.Timeout> = new Map()
  private readonly throttleDelay = 100

  initialize(client?: RealtimeClient): void {
    if (this.client) return

    if (client) {
      this.client = client
    } else {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321'
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'
      this.client = createClient(supabaseUrl, supabaseKey)
    }
    
    this.setupGlobalChannel()
  }

  private setupGlobalChannel(): void {
    if (!this.client) return

    const globalChannel = this.client.channel('document-changes')
    
    globalChannel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'documents'
      },
      this.handleGlobalDocumentChange.bind(this)
    )

    globalChannel.subscribe((status, error) => {
      if (error) {
        console.error('Global channel subscription error:', error)
        this.updateConnectionStatus('ERROR')
        return
      }

      this.updateConnectionStatus(status === 'SUBSCRIBED' ? 'CONNECTED' : 'CONNECTING')
    })

    this.channels.set('global', globalChannel)
  }

  // Document subscriptions
  async subscribeToDocument(
    documentId: string, 
    callback: DocumentChangeCallback
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Realtime service not initialized')
    }

    if (this.channels.size >= this.maxSubscriptions) {
      throw new Error(`Maximum number of subscriptions (${this.maxSubscriptions}) reached`)
    }

    const channelName = `document-${documentId}`
    
    if (this.channels.has(channelName)) {
      // Already subscribed, add callback
      const callbacks = this.subscriptionCallbacks.get(channelName) || []
      callbacks.push(callback)
      this.subscriptionCallbacks.set(channelName, callbacks)
      return
    }

    const channel = this.client.channel(channelName)

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'documents',
        filter: `id=eq.${documentId}`
      },
      (payload) => this.handleDocumentChange(payload, callback)
    )

    const subscribeResult = await channel.subscribe()
    
    if (subscribeResult.error) {
      throw new Error(subscribeResult.error.message || 'Subscription failed')
    }

    this.channels.set(channelName, channel)
    this.subscriptionCallbacks.set(channelName, [callback])
  }

  async unsubscribeFromDocument(documentId: string): Promise<void> {
    const channelName = `document-${documentId}`
    const channel = this.channels.get(channelName)

    if (channel) {
      const unsubscribeResult = await channel.unsubscribe()
      if (unsubscribeResult.error) {
        console.error('Unsubscribe error:', unsubscribeResult.error)
      }
      
      this.channels.delete(channelName)
      this.subscriptionCallbacks.delete(channelName)
    }
  }

  // Placeholder change broadcasting
  async subscribeToPlaceholderChanges(
    documentId: string,
    callback: PlaceholderChangeCallback
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Realtime service not initialized')
    }

    const channelName = `placeholder-${documentId}`
    let channel = this.channels.get(channelName)

    if (!channel) {
      channel = this.client.channel(channelName)
      this.channels.set(channelName, channel)
    }

    channel.on(
      'broadcast',
      { event: 'placeholder-change' },
      (payload) => callback(payload.payload)
    )

    channel.on(
      'broadcast',
      { event: 'placeholder-batch' },
      (payload) => {
        // Handle batch changes
        const batchEvent = payload.payload
        batchEvent.placeholders.forEach((placeholder: PlaceholderObject) => {
          callback({
            action: batchEvent.action,
            placeholder,
            timestamp: batchEvent.timestamp,
            userId: batchEvent.userId
          })
        })
      }
    )

    await channel.subscribe()
  }

  async broadcastPlaceholderChange(
    documentId: string,
    action: 'INSERT' | 'UPDATE' | 'DELETE',
    placeholder: PlaceholderObject
  ): Promise<void> {
    const channelName = `placeholder-${documentId}`
    const channel = this.channels.get(channelName)

    if (!channel) {
      throw new Error(`No channel found for document ${documentId}`)
    }

    // Throttle rapid changes to the same placeholder
    const throttleKey = `${documentId}-${placeholder.id}`
    
    if (this.throttleTimers.has(throttleKey)) {
      clearTimeout(this.throttleTimers.get(throttleKey)!)
    }

    const throttleTimer = setTimeout(async () => {
      await channel.send({
        type: 'broadcast',
        event: 'placeholder-change',
        payload: {
          action,
          placeholder,
          timestamp: Date.now()
        }
      })
      this.throttleTimers.delete(throttleKey)
    }, this.throttleDelay)

    this.throttleTimers.set(throttleKey, throttleTimer)
  }

  async batchPlaceholderChanges(
    documentId: string,
    action: 'INSERT' | 'UPDATE' | 'DELETE',
    placeholders: PlaceholderObject[]
  ): Promise<void> {
    const channelName = `placeholder-${documentId}`
    const channel = this.channels.get(channelName)

    if (!channel) {
      throw new Error(`No channel found for document ${documentId}`)
    }

    await channel.send({
      type: 'broadcast',
      event: 'placeholder-batch',
      payload: {
        action,
        placeholders,
        timestamp: Date.now()
      }
    })
  }

  // Presence tracking
  async subscribeToPresence(
    documentId: string,
    callback: PresenceChangeCallback
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Realtime service not initialized')
    }

    const channelName = `presence-${documentId}`
    let channel = this.channels.get(channelName)

    if (!channel) {
      channel = this.client.channel(channelName)
      this.channels.set(channelName, channel)
    }

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel!.presenceState()
      Object.keys(state).forEach(key => {
        callback({
          event: 'sync',
          user: key,
          presence: state[key][0] as PresenceInfo
        })
      })
    })

    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      callback({
        event: 'join',
        user: key,
        presence: newPresences[0] as PresenceInfo
      })
    })

    channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      if (leftPresences && leftPresences.length > 0) {
        callback({
          event: 'leave',
          user: key,
          presence: leftPresences[0] as PresenceInfo
        })
      }
    })

    await channel.subscribe()
  }

  async trackPresence(documentId: string, userInfo: PresenceInfo): Promise<void> {
    const channelName = `presence-${documentId}`
    const channel = this.channels.get(channelName)

    if (!channel) {
      throw new Error(`No presence channel found for document ${documentId}`)
    }

    await channel.track({
      user: userInfo.userId,
      name: userInfo.name,
      cursor: userInfo.cursor,
      online_at: new Date().toISOString()
    })
  }

  async untrackPresence(documentId: string): Promise<void> {
    const channelName = `presence-${documentId}`
    const channel = this.channels.get(channelName)

    if (channel) {
      await channel.untrack()
    }
  }

  // Connection management
  onConnectionStateChange(callback: ConnectionStateCallback): void {
    this.connectionCallbacks.push(callback)
  }

  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus
  }

  handleConnectionStateChange(event: { state: string }): void {
    const statusMap: Record<string, ConnectionStatus> = {
      'CONNECTING': 'CONNECTING',
      'SUBSCRIBED': 'CONNECTED',
      'CLOSED': 'DISCONNECTED',
      'CHANNEL_ERROR': 'ERROR'
    }

    const newStatus = statusMap[event.state] || 'ERROR'
    this.updateConnectionStatus(newStatus)

    // Handle reconnection
    if (newStatus === 'CONNECTED' && this.connectionStatus === 'DISCONNECTED') {
      this.handleReconnection()
    }
  }

  private updateConnectionStatus(status: ConnectionStatus): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status
      this.connectionCallbacks.forEach(callback => callback(status))
    }
  }

  private async handleReconnection(): Promise<void> {
    // Reestablish all subscriptions
    const channelNames = Array.from(this.channels.keys())
    
    for (const channelName of channelNames) {
      if (channelName === 'global') continue
      
      const channel = this.channels.get(channelName)
      if (channel) {
        try {
          await channel.subscribe()
        } catch (error) {
          console.error(`Failed to reestablish subscription for ${channelName}:`, error)
        }
      }
    }
  }

  // Event handlers
  private handleGlobalDocumentChange(payload: any): void {
    // Handle global document changes that don't have specific subscriptions
    console.log('Global document change:', payload)
  }

  private handleDocumentChange(payload: any, callback: DocumentChangeCallback): void {
    try {
      const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE'
      const newDoc = payload.new as Document | null
      const oldDoc = payload.old as Document | null

      let changes: string[] = []
      let contentChanged = false

      if (eventType === 'UPDATE' && newDoc && oldDoc) {
        // Detect what changed
        Object.keys(newDoc).forEach(key => {
          if (JSON.stringify((newDoc as any)[key]) !== JSON.stringify((oldDoc as any)[key])) {
            changes.push(key)
            if (key === 'content') {
              contentChanged = true
            }
          }
        })
      }

      const event: DocumentChangeEvent = {
        type: eventType,
        document: eventType === 'DELETE' ? null : newDoc,
        previous: eventType === 'INSERT' ? null : oldDoc,
        ...(changes.length > 0 && { changes }),
        ...(contentChanged && { contentChanged })
      }

      callback(event)
    } catch (error) {
      console.error('Error handling document change:', error)
    }
  }

  // Cleanup
  async cleanup(): Promise<void> {
    // Clear all throttle timers
    this.throttleTimers.forEach(timer => clearTimeout(timer))
    this.throttleTimers.clear()

    // Unsubscribe from all channels
    const unsubscribePromises = Array.from(this.channels.values()).map(
      channel => channel.unsubscribe()
    )

    await Promise.all(unsubscribePromises)

    this.channels.clear()
    this.subscriptionCallbacks.clear()
    this.connectionCallbacks.length = 0
    this.client = null
    this.connectionStatus = 'DISCONNECTED'
  }
}

export const realtimeService = new RealtimeService()