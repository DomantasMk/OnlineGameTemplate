import {
  SERVER_PORT,
  MessageType,
  encodeMessage,
  decodeMessage,
  type PlayerInput,
  type ServerMessage,
} from 'shared';

type MessageHandler = (msg: ServerMessage) => void;

export class Network {
  private ws: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private statusEl = document.getElementById('connection-status')!;

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || 'localhost';
    this.ws = new WebSocket(`${protocol}//${host}:${SERVER_PORT}`);

    this.ws.onopen = () => {
      this.statusEl.textContent = 'Connected';
      this.statusEl.className = 'connected';
    };

    this.ws.onclose = () => {
      this.statusEl.textContent = 'Disconnected';
      this.statusEl.className = 'disconnected';
      setTimeout(() => this.connect(), 2000);
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };

    this.ws.onmessage = (event) => {
      const msg = decodeMessage(event.data as string) as ServerMessage;
      for (const handler of this.handlers) {
        handler(msg);
      }
    };
  }

  onMessage(handler: MessageHandler) {
    this.handlers.push(handler);
  }

  sendInput(input: PlayerInput) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(encodeMessage({ type: MessageType.Input, input }));
    }
  }
}
