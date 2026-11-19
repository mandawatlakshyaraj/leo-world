import type { RealtimeEventPayload } from '../types/leo';
import { getStoredToken } from './apiClient';

type Listener = (event: RealtimeEventPayload) => void;

export class RealtimeClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private reconnectTimer: number | null = null;
  private stopped = false;

  connect(): void {
    this.stopped = false;
    this.openSocket();
  }

  private openSocket(): void {
    if (this.stopped || typeof window === 'undefined') return;
    const token = getStoredToken();
    if (!token) return;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
    const sock = new WebSocket(wsUrl);

    sock.onmessage = (evt) => {
      try {
        const parsed = JSON.parse(String(evt.data)) as RealtimeEventPayload;
        this.listeners.forEach((fn) => fn(parsed));
      } catch {
        // Ignore invalid frames
      }
    };

    sock.onclose = () => {
      this.ws = null;
      if (!this.stopped) {
        this.reconnectTimer = window.setTimeout(() => this.openSocket(), 2000);
      }
    };

    sock.onerror = () => {
      // Let onclose handle reconnection cleanly
    };

    this.ws = sock;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  sendTyping(threadType: 'dm' | 'group', targetId: string, isTyping: boolean): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'typing',
          threadType,
          targetId,
          isTyping,
        })
      );
    }
  }

  disconnect(): void {
    this.stopped = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
