'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchJson } from '../lib/api';

export type ConnectionState = 'connected' | 'reconnecting' | 'polling' | 'offline';

interface UseRealtimeDataOptions<T> {
  /** URL to fetch data from */
  fetchUrl: string;
  /** Polling interval in ms (default: 30000) */
  pollingInterval?: number;
  /** WebSocket negotiate endpoint */
  negotiateUrl?: string;
  /** Whether to enable the hook */
  enabled?: boolean;
  /** Callback when new data is received */
  onData?: (data: T) => void;
  /** Transform function for incoming WebSocket messages */
  transformMessage?: (message: unknown) => T | null;
}

interface UseRealtimeDataReturn<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  connectionState: ConnectionState;
  lastUpdated: Date | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for real-time data updates with WebSocket and polling fallback.
 * 
 * Priority:
 * 1. Try WebSocket connection via Azure Web PubSub
 * 2. Fall back to polling if WebSocket fails
 * 3. Use cached data if offline
 */
export function useRealtimeData<T>({
  fetchUrl,
  pollingInterval = 30000,
  negotiateUrl = '/api/negotiate',
  enabled = true,
  onData,
  transformMessage,
}: UseRealtimeDataOptions<T>): UseRealtimeDataReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionState, setConnectionState] = useState<ConnectionState>('polling');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const onDataRef = useRef(onData);
  onDataRef.current = onData;

  // Fetch data via HTTP
  const fetchData = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      const json = await fetchJson<T>(fetchUrl);
      if (!mountedRef.current) return;

      setData(json);
      setError(null);
      setLastUpdated(new Date());
      onDataRef.current?.(json);

      // Update connection state if we were offline
      if (connectionState === 'offline') {
        setConnectionState('polling');
      }
    } catch (err) {
      if (!mountedRef.current) return;

      const fetchError = err instanceof Error ? err : new Error('Failed to fetch data');
      setError(fetchError);

      // If we can't reach the server, we're offline
      if (!navigator.onLine || fetchError.message.includes('fetch')) {
        setConnectionState('offline');
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [fetchUrl, connectionState]);

  // Connect to WebSocket
  const connectWebSocket = useCallback(async () => {
    if (!mountedRef.current || !enabled) return;

    try {
      // Negotiate to get WebSocket URL
      const negotiate = await fetchJson<{ url?: string }>(negotiateUrl, { method: 'POST' });
      const wsUrl = negotiate?.url;

      if (!wsUrl) {
        // No WebSocket URL, stay in polling mode
        return;
      }

      if (!mountedRef.current) return;

      // Close existing connection
      if (wsRef.current) {
        wsRef.current.close();
      }

      const ws = new WebSocket(wsUrl, 'json.webpubsub.azure.v1');
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setConnectionState('connected');
        setError(null);

        // Clear reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        // Stop polling when WebSocket is connected
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;

        try {
          const raw = typeof event.data === 'string' ? event.data : '';
          let parsed: unknown = raw ? JSON.parse(raw) : null;

          // Handle Azure Web PubSub message wrapper
          if (parsed && typeof parsed === 'object' && 'data' in parsed) {
            const wrapper = parsed as { data?: unknown; type?: string };
            
            // Skip system messages
            if (wrapper.type === 'system') return;
            
            parsed = wrapper.data;
            
            // Parse nested JSON string
            if (typeof parsed === 'string') {
              try {
                parsed = JSON.parse(parsed);
              } catch {
                // Keep as string
              }
            }
          }

          // Transform message if transformer provided
          if (transformMessage) {
            const transformed = transformMessage(parsed);
            if (transformed != null) {
              setData(transformed);
              setLastUpdated(new Date());
              onDataRef.current?.(transformed);
            }
          } else {
            // Trigger a refetch on any message (invalidation pattern)
            void fetchData();
          }
        } catch {
          // Invalid message, trigger refetch
          void fetchData();
        }
      };

      ws.onerror = () => {
        if (!mountedRef.current) return;
        setConnectionState('reconnecting');
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;

        wsRef.current = null;

        // If we're still enabled, try to reconnect after delay
        if (enabled) {
          setConnectionState('reconnecting');
          
          // Start polling as fallback
          startPolling();

          // Try to reconnect after 5 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current && enabled) {
              void connectWebSocket();
            }
          }, 5000);
        }
      };
    } catch {
      // WebSocket negotiation failed, use polling
      if (mountedRef.current) {
        setConnectionState('polling');
        startPolling();
      }
    }
  }, [enabled, negotiateUrl, fetchData, transformMessage]);

  // Start polling
  const startPolling = useCallback(() => {
    if (pollingRef.current) return; // Already polling

    pollingRef.current = setInterval(() => {
      if (mountedRef.current) {
        void fetchData();
      }
    }, pollingInterval);

    // If not connected via WebSocket, set state to polling
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setConnectionState('polling');
    }
  }, [fetchData, pollingInterval]);

  // Manual refetch
  const refetch = useCallback(async () => {
    setIsLoading(true);
    await fetchData();
  }, [fetchData]);

  // Initial setup
  useEffect(() => {
    mountedRef.current = true;

    if (!enabled) {
      setIsLoading(false);
      return;
    }

    // Initial fetch
    void fetchData();

    // Try WebSocket connection
    void connectWebSocket();

    // Start polling as fallback (will be stopped if WebSocket connects)
    startPolling();

    return () => {
      mountedRef.current = false;

      // Cleanup WebSocket
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      // Cleanup polling
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }

      // Cleanup reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [enabled, fetchData, connectWebSocket, startPolling]);

  // Handle online/offline
  useEffect(() => {
    const handleOnline = () => {
      if (!mountedRef.current) return;
      void fetchData();
      void connectWebSocket();
    };

    const handleOffline = () => {
      if (!mountedRef.current) return;
      setConnectionState('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchData, connectWebSocket]);

  return {
    data,
    error,
    isLoading,
    connectionState,
    lastUpdated,
    refetch,
  };
}
