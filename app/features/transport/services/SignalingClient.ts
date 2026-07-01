import type {
  SignalingHandlers,
  SignalingTransport,
  SignalingLifecycleHandlers,
  SignalingConnectionState
} from '../types/Transport';
import {
  SignalingMessageType,
  TransportMode,
  type SignalingEnvelope,
  type HelloPayload,
  type JoinPayload,
  type OfferPayload,
  type AnswerPayload,
  type IceCandidatePayload,
  type ChatMessagePayload,
  type TypingPayload
} from '#shared/types/Signaling';
import type { Tier } from '#shared/types/Tier';

/**
 * Heartbeat interval (ms). Matches server reaper tolerance (45s timeout / 3 beats).
 */
const HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * Reconnect delay (ms). Doubled on each consecutive failure, capped.
 */
const RECONNECT_BASE_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 30_000;
const RECONNECT_MAX_ATTEMPTS = 5;

/**
 * SignalingClient owns the signaling protocol state: envelope encode/decode,
 * heartbeat scheduling, reconnection, and dispatch of server messages to
 * registered handlers. It is transport-agnostic via the SignalingTransport
 * interface so it can be unit-tested with a mock.
 *
 * The class is framework-agnostic (no Vue, no Nuxt). The useSignaling composable
 * wraps it in reactivity and the useRoomTransport composable wires it to
 * RtcManager.
 */
export class SignalingClient {
  private transport: SignalingTransport | null = null;
  private lifecycle: SignalingLifecycleHandlers;
  private handlers: SignalingHandlers = {};
  private peerId: string | null = null;
  private username: string | null = null;
  private tiers: Tier[] = [];
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private state: SignalingConnectionState = 'disconnected';
  private helloSent = false;
  private url: string;
  private readonly autoReconnect: boolean;

  constructor (opts: {
    url: string;
    lifecycle?: SignalingLifecycleHandlers;
    autoReconnect?: boolean;
  }) {
    this.url = opts.url;
    this.lifecycle = opts.lifecycle ?? {};
    this.autoReconnect = opts.autoReconnect ?? true;
  }

  /**
   * Register handlers for server-originated messages. Replaces any prior set.
   */
  setHandlers (handlers: SignalingHandlers): void {
    this.handlers = handlers;
  }

  /**
   * Merge additional handlers into the existing set without overwriting
   * handlers already registered. Later callers win on conflict.
   */
  addHandlers (handlers: Partial<SignalingHandlers>): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  getState (): SignalingConnectionState {
    return this.state;
  }

  getPeerId (): string | null {
    return this.peerId;
  }

  isConnected (): boolean {
    return this.state === 'connected';
  }

  /**
   * Open the signaling WebSocket. Returns a promise that resolves once the
   * handshake completes and hello is sent, or rejects on error.
   */
  connect (username: string, tiers: Tier[]): Promise<void> {
    this.username = username;
    this.tiers = tiers;
    this.state = 'connecting';
    this.helloSent = false;
    this.reconnectAttempts = 0;
    return this.openSocket();
  }

  private openSocket (): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (typeof WebSocket === 'undefined') {
        reject(new Error('WebSocket is not available in this environment'));
        return;
      }
      const ws = new WebSocket(this.url);
      const transport: SignalingTransport = {
        send: (data: string) => { ws.send(data); },
        close: (code?: number, reason?: string) => { ws.close(code, reason); }
      };
      this.transport = transport;
      let opened = false;

      ws.onopen = () => {
        opened = true;
        this.state = 'connected';
        this.lifecycle.onOpen?.();
        this.sendHello();
        this.startHeartbeat();
        resolve();
      };
      ws.onmessage = (ev: MessageEvent) => {
        const data = typeof ev.data === 'string' ? ev.data : '';
        this.lifecycle.onMessage?.(data);
        this.handleIncoming(data);
      };
      ws.onerror = (ev: Event) => {
        this.lifecycle.onError?.(ev);
        if (!opened) { reject(new Error('WebSocket connection failed')); }
      };
      ws.onclose = (ev: CloseEvent) => {
        this.state = 'disconnected';
        this.stopHeartbeat();
        this.lifecycle.onClose?.(ev.code, ev.reason);
        if (this.autoReconnect && this.reconnectAttempts < RECONNECT_MAX_ATTEMPTS) {
          this.scheduleReconnect();
        }
      };
    });
  }

  private scheduleReconnect (): void {
    this.reconnectAttempts += 1;
    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * 2 ** (this.reconnectAttempts - 1),
      RECONNECT_MAX_DELAY_MS
    );
    this.state = 'reconnecting';
    this.reconnectTimer = setTimeout(() => {
      if (this.username === null) { return; }
      this.openSocket().catch(() => {
        // onError already handled; further attempts continue
      });
    }, delay);
  }

  /**
   * Gracefully disconnect: stop heartbeat, send leave for any joined rooms,
   * close transport. No reconnect is attempted after this call.
   */
  disconnect (): void {
    this.stopHeartbeat();
    this.stopReconnect();
    this.transport?.close(1000, 'client disconnect');
    this.transport = null;
    this.state = 'disconnected';
    this.peerId = null;
    this.helloSent = false;
  }

  private sendHello (): void {
    if (this.username === null || this.helloSent) { return; }
    const payload: HelloPayload = { username: this.username, tiers: this.tiers };
    this.send(SignalingMessageType.Hello, payload);
    this.helloSent = true;
  }

  joinRoom (room: string): void {
    const payload: JoinPayload = { room };
    this.send(SignalingMessageType.Join, payload);
  }

  leaveRoom (room: string): void {
    this.send(SignalingMessageType.Leave, { room } satisfies JoinPayload);
  }

  sendOffer (to: string, sdp: string, label: string): void {
    const payload: OfferPayload = { sdp, label };
    this.send(SignalingMessageType.Offer, payload, { to, room: undefined });
  }

  sendAnswer (to: string, sdp: string): void {
    const payload: AnswerPayload = { sdp };
    this.send(SignalingMessageType.Answer, payload, { to, room: undefined });
  }

  sendIceCandidate (to: string, candidate: IceCandidatePayload): void {
    this.send(SignalingMessageType.IceCandidate, candidate, { to, room: undefined });
  }

  sendChatMessage (room: string, message: ChatMessagePayload): void {
    this.send(SignalingMessageType.ChatMessage, message, { room });
  }

  sendTyping (room: string, isTyping: boolean): void {
    const payload: TypingPayload = { room, username: this.username ?? '', isTyping };
    this.send(SignalingMessageType.Typing, payload, { room });
  }

  private startHeartbeat (): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send(SignalingMessageType.Heartbeat, {});
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat (): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private stopReconnect (): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
  }

  /**
   * Encode and send a signaling envelope over the transport.
   */
  private send (
    type: SignalingMessageType,
    payload: unknown,
    extra?: { to?: string; room?: string }
  ): void {
    if (this.transport === null) { return; }
    const envelope: SignalingEnvelope = {
      type,
      from: this.peerId ?? undefined,
      payload,
      ts: Date.now()
    };
    if (extra?.to !== undefined) { envelope.to = extra.to; }
    if (extra?.room !== undefined) { envelope.room = extra.room; }
    this.transport.send(JSON.stringify(envelope));
  }

  /**
   * Decode an incoming envelope and dispatch to the appropriate handler.
   * Exposed as a method (not private) so tests can feed messages directly
   * without a live WebSocket.
   */
  handleIncoming (raw: string): void {
    let env: SignalingEnvelope;
    try {
      env = JSON.parse(raw) as SignalingEnvelope;
    } catch {
      return;
    }
    if (typeof env.type !== 'string') { return; }
    switch (env.type) {
      case SignalingMessageType.Welcome:
        this.peerId = (env.payload as { peerId: string }).peerId ?? null;
        this.handlers.onWelcome?.(
          (env.payload as { peerId: string }).peerId,
          (env.payload as { onlineUsernames: string[] }).onlineUsernames ?? []
        );
        break;
      case SignalingMessageType.PeerJoined: {
        const p = env.payload as { peer: { peerId: string; username: string; tiers: Tier[] }; room: string; isHub: boolean };
        this.handlers.onPeerJoined?.(p.peer, p.room, p.isHub);
        break;
      }
      case SignalingMessageType.PeerLeft: {
        const p = env.payload as { peerId: string; room: string; wasHub: boolean };
        this.handlers.onPeerLeft?.(p.peerId, p.room, p.wasHub);
        break;
      }
      case SignalingMessageType.RoomDestroyed: {
        const p = env.payload as { room: string };
        this.handlers.onRoomDestroyed?.(p.room);
        break;
      }
      case SignalingMessageType.TransportMode: {
        const p = env.payload as { room: string; mode: TransportMode; hubPeerId?: string };
        this.handlers.onTransportMode?.(p.room, p.mode, p.hubPeerId);
        break;
      }
      case SignalingMessageType.HubElected: {
        const p = env.payload as { room: string; hubPeerId: string; hubUsername: string };
        this.handlers.onHubElected?.(p.room, p.hubPeerId, p.hubUsername);
        break;
      }
      case SignalingMessageType.OfferRelayed: {
        const p = env.payload as { sdp: string; label: string };
        this.handlers.onOfferRelayed?.(env.from ?? '', p.sdp, p.label);
        break;
      }
      case SignalingMessageType.AnswerRelayed: {
        const p = env.payload as { sdp: string };
        this.handlers.onAnswerRelayed?.(env.from ?? '', p.sdp);
        break;
      }
      case SignalingMessageType.IceCandidateRelayed: {
        const p = env.payload as { candidate: string; sdpMLineIndex: number | null; sdpMid: string | null };
        this.handlers.onIceCandidateRelayed?.(env.from ?? '', p.candidate, p.sdpMLineIndex, p.sdpMid);
        break;
      }
      case SignalingMessageType.RelayBroadcast: {
        const p = env.payload as { room: string; message: ChatMessagePayload };
        this.handlers.onRelayBroadcast?.(p.room, p.message);
        break;
      }
      case SignalingMessageType.Error: {
        const p = env.payload as { code: string; message: string };
        this.handlers.onError?.(p.code, p.message);
        break;
      }
      default:
        // chat-message, typing, presence, offer, answer, ice-candidate,
        // heartbeat are client->server and not expected here.
        break;
    }
  }
}
