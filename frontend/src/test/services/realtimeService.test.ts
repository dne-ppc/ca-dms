import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { realtimeService } from '../../services/realtimeService'
import type { Document, PlaceholderObject } from '../../types'

// Mock Supabase client
const mockSupabaseClient = {
  channel: vi.fn(),
  removeAllChannels: vi.fn(),
  getChannels: vi.fn(),
}

const mockChannel = {
  on: vi.fn(),
  off: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  track: vi.fn(),
  untrack: vi.fn(),
  send: vi.fn(),
}

// Mock the Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabaseClient,
}))

describe('Real-time Subscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabaseClient.channel.mockReturnValue(mockChannel)
    mockChannel.on.mockReturnValue(mockChannel)
    mockChannel.subscribe.mockResolvedValue({ error: null })
    mockChannel.unsubscribe.mockResolvedValue({ error: null })
    
    // Initialize with mock client
    realtimeService.initialize(mockSupabaseClient as any)
  })

  afterEach(async () => {
    vi.resetAllMocks()
    await realtimeService.cleanup()
  })

  describe('Supabase Subscription Setup', () => {
    it('should initialize real-time client with proper configuration', () => {
      realtimeService.initialize()

      expect(mockSupabaseClient.channel).toHaveBeenCalledWith('document-changes')
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents'
        },
        expect.any(Function)
      )
    })

    it('should set up document subscription for specific document', async () => {
      const documentId = 'doc-123'
      const callback = vi.fn()

      await realtimeService.subscribeToDocument(documentId, callback)

      expect(mockSupabaseClient.channel).toHaveBeenCalledWith(`document-${documentId}`)
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: `id=eq.${documentId}`
        },
        expect.any(Function)
      )
      expect(mockChannel.subscribe).toHaveBeenCalled()
    })

    it('should handle subscription errors gracefully', async () => {
      const documentId = 'doc-123'
      const callback = vi.fn()
      
      mockChannel.subscribe.mockResolvedValue({ error: new Error('Subscription failed') })

      await expect(
        realtimeService.subscribeToDocument(documentId, callback)
      ).rejects.toThrow('Subscription failed')
    })

    it('should clean up subscriptions on disconnect', async () => {
      const documentId = 'doc-123'
      const callback = vi.fn()

      await realtimeService.subscribeToDocument(documentId, callback)
      await realtimeService.unsubscribeFromDocument(documentId)

      expect(mockChannel.unsubscribe).toHaveBeenCalled()
    })

    it('should manage multiple document subscriptions', async () => {
      const doc1Id = 'doc-123'
      const doc2Id = 'doc-456'
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      await realtimeService.subscribeToDocument(doc1Id, callback1)
      await realtimeService.subscribeToDocument(doc2Id, callback2)

      expect(mockSupabaseClient.channel).toHaveBeenCalledTimes(3)
      expect(mockSupabaseClient.channel).toHaveBeenCalledWith(`document-${doc1Id}`)
      expect(mockSupabaseClient.channel).toHaveBeenCalledWith(`document-${doc2Id}`)
    })
  })

  describe('Real-time Document Updates', () => {
    const mockDocument: Document = {
      id: 'doc-123',
      title: 'Test Document',
      content: JSON.stringify([{ insert: 'Hello world' }]),
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      status: 'draft',
      authorId: 'user1'
    }

    it('should handle document INSERT events', async () => {
      const callback = vi.fn()
      let insertHandler: Function

      mockChannel.on.mockImplementation((event, config, handler) => {
        if (event === 'postgres_changes') {
          insertHandler = handler
        }
        return mockChannel
      })

      await realtimeService.subscribeToDocument(mockDocument.id, callback)

      const insertEvent = {
        eventType: 'INSERT',
        new: mockDocument,
        old: {},
        errors: null
      }

      insertHandler!(insertEvent)

      expect(callback).toHaveBeenCalledWith({
        type: 'INSERT',
        document: mockDocument,
        previous: null
      })
    })

    it('should handle document UPDATE events', async () => {
      const callback = vi.fn()
      let updateHandler: Function

      const updatedDocument = { ...mockDocument, version: 2, title: 'Updated Title' }

      mockChannel.on.mockImplementation((event, config, handler) => {
        if (event === 'postgres_changes') {
          updateHandler = handler
        }
        return mockChannel
      })

      await realtimeService.subscribeToDocument(mockDocument.id, callback)

      const updateEvent = {
        eventType: 'UPDATE',
        new: updatedDocument,
        old: mockDocument,
        errors: null
      }

      updateHandler!(updateEvent)

      expect(callback).toHaveBeenCalledWith({
        type: 'UPDATE',
        document: updatedDocument,
        previous: mockDocument,
        changes: ['title', 'version']
      })
    })

    it('should handle document DELETE events', async () => {
      const callback = vi.fn()
      let deleteHandler: Function

      mockChannel.on.mockImplementation((event, config, handler) => {
        if (event === 'postgres_changes') {
          deleteHandler = handler
        }
        return mockChannel
      })

      await realtimeService.subscribeToDocument(mockDocument.id, callback)

      const deleteEvent = {
        eventType: 'DELETE',
        new: {},
        old: mockDocument,
        errors: null
      }

      deleteHandler!(deleteEvent)

      expect(callback).toHaveBeenCalledWith({
        type: 'DELETE',
        document: null,
        previous: mockDocument
      })
    })

    it('should detect and report content changes', async () => {
      const callback = vi.fn()
      let updateHandler: Function

      const originalContent = JSON.stringify([{ insert: 'Hello world' }])
      const updatedContent = JSON.stringify([{ insert: 'Hello updated world' }])

      const updatedDocument = { 
        ...mockDocument, 
        content: updatedContent,
        version: 2
      }

      mockChannel.on.mockImplementation((event, config, handler) => {
        if (event === 'postgres_changes') {
          updateHandler = handler
        }
        return mockChannel
      })

      await realtimeService.subscribeToDocument(mockDocument.id, callback)

      const updateEvent = {
        eventType: 'UPDATE',
        new: updatedDocument,
        old: { ...mockDocument, content: originalContent },
        errors: null
      }

      updateHandler!(updateEvent)

      expect(callback).toHaveBeenCalledWith({
        type: 'UPDATE',
        document: updatedDocument,
        previous: expect.objectContaining({ content: originalContent }),
        changes: ['content', 'version'],
        contentChanged: true
      })
    })
  })

  describe('Collaborative Change Handling', () => {
    it('should broadcast placeholder changes to other clients', async () => {
      const documentId = 'doc-123'
      const placeholder: PlaceholderObject = {
        id: 'placeholder-1',
        type: 'signature',
        data: { label: 'New Signature' },
        position: 100
      }

      // Set up placeholder channel first
      await realtimeService.subscribeToPlaceholderChanges(documentId, vi.fn())
      
      vi.useFakeTimers()
      
      await realtimeService.broadcastPlaceholderChange(documentId, 'INSERT', placeholder)
      
      // Wait for throttled function to execute
      await vi.runAllTimersAsync()
      
      vi.useRealTimers()

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'placeholder-change',
        payload: {
          action: 'INSERT',
          placeholder,
          timestamp: expect.any(Number)
        }
      })
    })

    it('should handle incoming placeholder change broadcasts', async () => {
      const documentId = 'doc-123'
      const callback = vi.fn()
      let broadcastHandler: Function

      mockChannel.on.mockImplementation((event, config, handler) => {
        if (event === 'broadcast' && config.event === 'placeholder-change') {
          broadcastHandler = handler
        }
        return mockChannel
      })

      await realtimeService.subscribeToPlaceholderChanges(documentId, callback)

      const broadcastEvent = {
        payload: {
          action: 'UPDATE',
          placeholder: {
            id: 'placeholder-1',
            type: 'signature',
            data: { label: 'Updated Signature' },
            position: 100
          },
          timestamp: Date.now(),
          userId: 'user-456'
        }
      }

      broadcastHandler!(broadcastEvent)

      expect(callback).toHaveBeenCalledWith({
        action: 'UPDATE',
        placeholder: broadcastEvent.payload.placeholder,
        timestamp: broadcastEvent.payload.timestamp,
        userId: 'user-456'
      })
    })

    it('should manage user presence in documents', async () => {
      const documentId = 'doc-123'
      const userInfo = {
        userId: 'user-123',
        name: 'John Doe',
        cursor: { index: 42, length: 0 }
      }

      // Set up presence channel first
      await realtimeService.subscribeToPresence(documentId, vi.fn())
      
      await realtimeService.trackPresence(documentId, userInfo)

      expect(mockChannel.track).toHaveBeenCalledWith({
        user: userInfo.userId,
        name: userInfo.name,
        cursor: userInfo.cursor,
        online_at: expect.any(String)
      })
    })

    it('should handle presence changes from other users', async () => {
      const documentId = 'doc-123'
      const callback = vi.fn()
      let joinHandler: Function

      mockChannel.on.mockImplementation((event, config, handler) => {
        if (event === 'presence' && config.event === 'join') {
          joinHandler = handler
        }
        return mockChannel
      })

      await realtimeService.subscribeToPresence(documentId, callback)

      const presenceEvent = {
        key: 'user-456',
        newPresences: [{
          user: 'user-456',
          name: 'Jane Doe',
          cursor: { index: 20, length: 5 },
          online_at: '2024-01-01T10:00:00Z'
        }]
      }

      joinHandler!(presenceEvent)

      expect(callback).toHaveBeenCalledWith({
        event: 'join',
        user: 'user-456',
        presence: presenceEvent.newPresences[0]
      })
    })

    it('should handle connection state changes', () => {
      const callback = vi.fn()

      realtimeService.onConnectionStateChange(callback)

      // Simulate connection state change
      const stateChangeEvent = { state: 'SUBSCRIBED' }
      
      // This would be triggered by the real Supabase client
      realtimeService.handleConnectionStateChange(stateChangeEvent)

      expect(callback).toHaveBeenCalledWith('CONNECTED')
    })

    it('should provide current connection status', () => {
      expect(realtimeService.getConnectionStatus()).toBeDefined()
      expect(['CONNECTING', 'CONNECTED', 'DISCONNECTED', 'ERROR']).toContain(
        realtimeService.getConnectionStatus()
      )
    })

    it('should handle reconnection after disconnection', async () => {
      const documentId = 'doc-123'
      const callback = vi.fn()

      await realtimeService.subscribeToDocument(documentId, callback)
      
      // Simulate disconnection
      realtimeService.handleConnectionStateChange({ state: 'DISCONNECTED' })
      
      // Simulate reconnection
      realtimeService.handleConnectionStateChange({ state: 'CONNECTED' })

      // Should reestablish subscription
      expect(mockChannel.subscribe).toHaveBeenCalledTimes(2)
    })
  })

  describe('Performance and Optimization', () => {
    it('should throttle rapid placeholder changes', async () => {
      const documentId = 'doc-123'
      const placeholder: PlaceholderObject = {
        id: 'placeholder-1',
        type: 'signature',
        data: { label: 'Rapid Changes' },
        position: 100
      }

      // Set up placeholder channel first
      await realtimeService.subscribeToPlaceholderChanges(documentId, vi.fn())

      vi.useFakeTimers()

      // Send multiple rapid changes
      for (let i = 0; i < 5; i++) {
        realtimeService.broadcastPlaceholderChange(documentId, 'UPDATE', {
          ...placeholder,
          data: { label: `Change ${i}` }
        })
      }

      // Wait for throttled function to execute
      await vi.runAllTimersAsync()

      // Should only send the last change due to throttling
      expect(mockChannel.send).toHaveBeenCalledTimes(1)
      
      vi.useRealTimers()
    })

    it('should batch multiple placeholder changes', async () => {
      const documentId = 'doc-123'
      const placeholders = [
        { id: 'p1', type: 'signature' as const, data: {}, position: 10 },
        { id: 'p2', type: 'signature' as const, data: {}, position: 20 },
        { id: 'p3', type: 'signature' as const, data: {}, position: 30 },
      ]

      // Set up placeholder channel first
      await realtimeService.subscribeToPlaceholderChanges(documentId, vi.fn())
      
      await realtimeService.batchPlaceholderChanges(documentId, 'INSERT', placeholders)

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'placeholder-batch',
        payload: {
          action: 'INSERT',
          placeholders,
          timestamp: expect.any(Number)
        }
      })
    })

    it('should limit the number of active subscriptions', async () => {
      const maxSubscriptions = 10
      const callbacks = Array.from({ length: 15 }, () => vi.fn())

      // Try to create more subscriptions than the limit
      for (let i = 0; i < 15; i++) {
        try {
          await realtimeService.subscribeToDocument(`doc-${i}`, callbacks[i])
        } catch (error) {
          // Some should fail due to limits
        }
      }

      // Should not exceed the maximum number of channels
      expect(mockSupabaseClient.channel).toHaveBeenCalledTimes(maxSubscriptions)
    })
  })
})