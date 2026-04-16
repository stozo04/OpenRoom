/**
 * useGMSocket — thin WebSocket client for the Mystery GM subprocess.
 *
 * Lifecycle:
 *  - mount: connect to GM_WS_URL, auto-reconnect on drop with a bounded delay
 *  - send(action): returns a Promise<GMResponse> keyed on action_id, times out
 *    after GM_RESPONSE_TIMEOUT_MS
 *  - unmount: close socket, reject any pending promises
 *
 * Error handling is explicit: connection errors log to console.warn + surface
 * a connection-status flag; timeouts reject the per-action promise with a
 * typed Error. No silent catches — all failures are observable.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GM_RECONNECT_MS,
  GM_RESPONSE_TIMEOUT_MS,
  GM_WS_URL,
} from '../actions/constants';
import type { MysteryActionRequest, MysteryActionResponse } from '../types';

type ConnectionStatus = 'connecting' | 'open' | 'closed' | 'error';

interface PendingAction {
  resolve: (value: MysteryActionResponse) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface UseGMSocketResult {
  status: ConnectionStatus;
  lastError: string | null;
  sendAction: (
    action: Omit<MysteryActionRequest, 'action_id' | 'ts'>,
  ) => Promise<MysteryActionResponse>;
}

export function useGMSocket(): UseGMSocketResult {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [lastError, setLastError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef<Map<number, PendingAction>>(new Map());
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);
  const nextActionIdRef = useRef(1);

  const rejectAllPending = useCallback((reason: Error) => {
    const map = pendingRef.current;
    map.forEach(({ reject, timer }) => {
      clearTimeout(timer);
      reject(reason);
    });
    map.clear();
  }, []);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;
    setStatus('connecting');

    let ws: WebSocket;
    try {
      ws = new WebSocket(GM_WS_URL);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[MysteryApp] GM WebSocket construct failed:', msg);
      setLastError(msg);
      setStatus('error');
      scheduleReconnect();
      return;
    }

    socketRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) return;
      setStatus('open');
      setLastError(null);
      console.info('[MysteryApp] GM socket connected');
    };

    ws.onmessage = (event) => {
      if (unmountedRef.current) return;
      try {
        const data = JSON.parse(String(event.data)) as MysteryActionResponse;
        if (typeof data.action_id === 'number') {
          const pending = pendingRef.current.get(data.action_id);
          if (pending) {
            clearTimeout(pending.timer);
            pendingRef.current.delete(data.action_id);
            pending.resolve(data);
            return;
          }
        }
        // Unsolicited narrative push (allowed) — no pending resolver, log it.
        console.info('[MysteryApp] GM push (no action_id match):', data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[MysteryApp] GM message parse failed:', msg, event.data);
      }
    };

    ws.onerror = (ev) => {
      if (unmountedRef.current) return;
      const msg = 'WebSocket error — is the GM subprocess running on ' + GM_WS_URL + '?';
      console.warn('[MysteryApp]', msg, ev);
      setLastError(msg);
      setStatus('error');
    };

    ws.onclose = () => {
      if (unmountedRef.current) return;
      setStatus('closed');
      rejectAllPending(new Error('GM socket closed before response arrived'));
      scheduleReconnect();
    };
  }, [rejectAllPending]);

  const scheduleReconnect = useCallback(() => {
    if (unmountedRef.current) return;
    if (reconnectTimerRef.current) return;
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      connect();
    }, GM_RECONNECT_MS);
  }, [connect]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      rejectAllPending(new Error('MysteryApp unmounted'));
      const ws = socketRef.current;
      if (ws && ws.readyState <= WebSocket.OPEN) {
        try {
          ws.close();
        } catch (err) {
          console.warn('[MysteryApp] error closing GM socket:', err);
        }
      }
      socketRef.current = null;
    };
  }, [connect, rejectAllPending]);

  const sendAction = useCallback(
    (action: Omit<MysteryActionRequest, 'action_id' | 'ts'>) =>
      new Promise<MysteryActionResponse>((resolve, reject) => {
        const ws = socketRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          reject(new Error('GM socket is not open — cannot send action yet'));
          return;
        }

        const action_id = nextActionIdRef.current++;
        const payload: MysteryActionRequest = {
          ...action,
          action_id,
          ts: Date.now(),
        };

        const timer = setTimeout(() => {
          const pending = pendingRef.current.get(action_id);
          if (pending) {
            pendingRef.current.delete(action_id);
            pending.reject(
              new Error(
                'GM did not respond within ' + GM_RESPONSE_TIMEOUT_MS + 'ms',
              ),
            );
          }
        }, GM_RESPONSE_TIMEOUT_MS);

        pendingRef.current.set(action_id, { resolve, reject, timer });

        try {
          ws.send(JSON.stringify(payload));
        } catch (err) {
          clearTimeout(timer);
          pendingRef.current.delete(action_id);
          const msg = err instanceof Error ? err.message : String(err);
          reject(new Error('Failed to send action: ' + msg));
        }
      }),
    [],
  );

  return { status, lastError, sendAction };
}
