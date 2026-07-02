import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SignalingConnectionState, type SignalingHandlers } from '../types/Transport';
import { SignalingClient } from './SignalingClient';
import { SignalingMessageType, SignalingErrorCode, TransportMode, PresenceStatus } from '#shared/types/Signaling';
import { Tier } from '#shared/types/Tier';

/**
 * SignalingClient tests use handleIncoming() directly to feed server messages
 * without a real WebSocket. The connect() path is not exercised here (it
 * requires a browser WebSocket); integration is covered separately.
 */

function makeClient (): SignalingClient {
  return new SignalingClient({ url: 'ws://localhost:3000/signaling', autoReconnect: false });
}

function envelope (type: SignalingMessageType, payload: unknown, extra?: { from?: string; room?: string; ts?: number }): string {
  return JSON.stringify({
    type,
    from: extra?.from,
    room: extra?.room,
    payload,
    ts: extra?.ts ?? Date.now()
  });
}

describe('SignalingClient.handleIncoming', () => {
  let client: SignalingClient;
  let handlers: SignalingHandlers;

  beforeEach(() => {
    client = makeClient();
    handlers = {
      onWelcome: vi.fn(),
      onPeerJoined: vi.fn(),
      onPeerLeft: vi.fn(),
      onRoomDestroyed: vi.fn(),
      onTransportMode: vi.fn(),
      onHubElected: vi.fn(),
      onOfferRelayed: vi.fn(),
      onAnswerRelayed: vi.fn(),
      onIceCandidateRelayed: vi.fn(),
      onRelayBroadcast: vi.fn(),
      onPong: vi.fn(),
      onTyping: vi.fn(),
      onPresence: vi.fn(),
      onError: vi.fn()
    };
    client.setHandlers(handlers);
  });

  it('stores peerId from welcome and calls onWelcome', () => {
    client.handleIncoming(envelope(SignalingMessageType.Welcome, { peerId: 'p-1', onlineUsernames: ['alice'] }));
    expect(client.getPeerId()).toBe('p-1');
    expect(handlers.onWelcome).toHaveBeenCalledWith('p-1', ['alice']);
  });

  it('dispatches peer-joined with peer identity, room, isHub', () => {
    const peer = { peerId: 'p-2', username: 'bob', tiers: ['adult'] };
    client.handleIncoming(envelope(SignalingMessageType.PeerJoined, { peer, room: 'lobby', isHub: false }));
    expect(handlers.onPeerJoined).toHaveBeenCalledWith(peer, 'lobby', false);
  });

  it('dispatches peer-left with peerId, room, wasHub', () => {
    client.handleIncoming(envelope(SignalingMessageType.PeerLeft, { peerId: 'p-2', room: 'lobby', wasHub: true }));
    expect(handlers.onPeerLeft).toHaveBeenCalledWith('p-2', 'lobby', true);
  });

  it('dispatches room-destroyed', () => {
    client.handleIncoming(envelope(SignalingMessageType.RoomDestroyed, { room: 'lobby' }));
    expect(handlers.onRoomDestroyed).toHaveBeenCalledWith('lobby');
  });

  it('dispatches transport-mode with optional hubPeerId', () => {
    client.handleIncoming(envelope(SignalingMessageType.TransportMode, { room: 'lobby', mode: TransportMode.Star, hubPeerId: 'p-1' }));
    expect(handlers.onTransportMode).toHaveBeenCalledWith('lobby', TransportMode.Star, 'p-1');
  });

  it('dispatches transport-mode without hubPeerId in mesh mode', () => {
    client.handleIncoming(envelope(SignalingMessageType.TransportMode, { room: 'lobby', mode: TransportMode.Mesh }));
    expect(handlers.onTransportMode).toHaveBeenCalledWith('lobby', TransportMode.Mesh, undefined);
  });

  it('dispatches hub-elected', () => {
    client.handleIncoming(envelope(SignalingMessageType.HubElected, { room: 'lobby', hubPeerId: 'p-3', hubUsername: 'carol' }));
    expect(handlers.onHubElected).toHaveBeenCalledWith('lobby', 'p-3', 'carol');
  });

  it('dispatches offer-relayed with from peerId and sdp+label', () => {
    client.handleIncoming(envelope(SignalingMessageType.OfferRelayed, { sdp: 'v=0…', label: 'chat' }, { from: 'p-2' }));
    expect(handlers.onOfferRelayed).toHaveBeenCalledWith('p-2', 'v=0…', 'chat');
  });

  it('dispatches answer-relayed with from peerId and sdp', () => {
    client.handleIncoming(envelope(SignalingMessageType.AnswerRelayed, { sdp: 'v=0…' }, { from: 'p-2' }));
    expect(handlers.onAnswerRelayed).toHaveBeenCalledWith('p-2', 'v=0…');
  });

  it('dispatches ice-candidate-relayed with from peerId and candidate fields', () => {
    const cand = { candidate: 'cand', sdpMLineIndex: 0, sdpMid: 'data' };
    client.handleIncoming(envelope(SignalingMessageType.IceCandidateRelayed, cand, { from: 'p-2' }));
    expect(handlers.onIceCandidateRelayed).toHaveBeenCalledWith('p-2', 'cand', 0, 'data');
  });

  it('dispatches relay-broadcast with room and message', () => {
    const msg = { id: 'm-1', author: 'alice', content: 'hi', timestamp: 12345 };
    client.handleIncoming(envelope(SignalingMessageType.RelayBroadcast, { room: 'lobby', message: msg }));
    expect(handlers.onRelayBroadcast).toHaveBeenCalledWith('lobby', msg);
  });

  it('dispatches pong with id, sentAt, receivedAt', () => {
    client.handleIncoming(envelope(SignalingMessageType.Pong, { id: 'ping-1', sentAt: 12345, receivedAt: 12350 }));
    expect(handlers.onPong).toHaveBeenCalledWith('ping-1', 12345, 12350);
  });

  it('dispatches typing with room, username, isTyping', () => {
    client.handleIncoming(envelope(SignalingMessageType.Typing, { room: 'lobby', username: 'alice', isTyping: true }));
    expect(handlers.onTyping).toHaveBeenCalledWith('lobby', 'alice', true);
  });

  it('dispatches presence with username and status', () => {
    client.handleIncoming(envelope(SignalingMessageType.Presence, { username: 'alice', status: PresenceStatus.Online }));
    expect(handlers.onPresence).toHaveBeenCalledWith('alice', PresenceStatus.Online);
  });

  it('dispatches error with code and message', () => {
    client.handleIncoming(envelope(SignalingMessageType.Error, { code: SignalingErrorCode.UsernameInUse, message: 'Taken' }));
    expect(handlers.onError).toHaveBeenCalledWith(SignalingErrorCode.UsernameInUse, 'Taken');
  });

  it('ignores invalid JSON', () => {
    client.handleIncoming('not json');
    expect(handlers.onWelcome).not.toHaveBeenCalled();
  });

  it('ignores envelope without a string type', () => {
    client.handleIncoming(JSON.stringify({ payload: {} }));
    expect(handlers.onWelcome).not.toHaveBeenCalled();
  });

  it('ignores client-to-server message types', () => {
    client.handleIncoming(envelope(SignalingMessageType.ChatMessage, { id: 'm', author: 'a', content: 'x', timestamp: 0 }));
    client.handleIncoming(envelope(SignalingMessageType.Heartbeat, {}));
    // No handlers should fire for these server-bound types
    expect(handlers.onRelayBroadcast).not.toHaveBeenCalled();
  });
});

describe('SignalingClient state', () => {
  it('starts disconnected', () => {
    const client = makeClient();
    expect(client.getState()).toBe('disconnected');
    expect(client.isConnected()).toBe(false);
    expect(client.getPeerId()).toBeNull();
  });

  it('setHandlers replaces handlers', () => {
    const client = makeClient();
    const h1: SignalingHandlers = { onWelcome: vi.fn() };
    const h2: SignalingHandlers = { onWelcome: vi.fn() };
    client.setHandlers(h1);
    client.setHandlers(h2);
    client.handleIncoming(envelope(SignalingMessageType.Welcome, { peerId: 'p-1', onlineUsernames: [] }));
    expect(h2.onWelcome).toHaveBeenCalled();
    expect(h1.onWelcome).not.toHaveBeenCalled();
  });
});

/**
 * Lifecycle tests exercise the connect() → openSocket() → WebSocket path
 * with a mock global WebSocket. They cover hello, heartbeat, disconnect,
 * reconnection backoff, send methods, and addHandlers chaining.
 */
interface MockWSInstance {
  sent: string[];
  onopen: (() => void) | null;
  onmessage: ((ev: { data: string }) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onclose: ((ev: { code: number; reason: string }) => void) | null;
  readyState: number;
  close: (code?: number, reason?: string) => void;
  send: (data: string) => void;
}

describe('SignalingClient lifecycle', () => {
  let originalWebSocket: typeof globalThis.WebSocket;
  let mockWSInstances: MockWSInstance[];
  let wsConstructorCalls: number;

  beforeEach(() => {
    originalWebSocket = globalThis.WebSocket;
    mockWSInstances = [];
    wsConstructorCalls = 0;
    class MockWebSocket {
      sent: string[] = [];
      onopen: (() => void) | null = null;
      onmessage: ((ev: { data: string }) => void) | null = null;
      onerror: ((ev: Event) => void) | null = null;
      onclose: ((ev: { code: number; reason: string }) => void) | null = null;
      readyState = 0;

      constructor (_url: string) {
        wsConstructorCalls++;
        mockWSInstances.push(this);
      }

      send (data: string): void {
        this.sent.push(data);
      }

      close (_code?: number, _reason?: string): void {
        this.readyState = 2;
      }
    }
    globalThis.WebSocket = MockWebSocket as unknown as typeof globalThis.WebSocket;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.WebSocket = originalWebSocket;
  });

  function getLastWS (): MockWSInstance {
    return mockWSInstances[mockWSInstances.length - 1]!;
  }

  it('connect sets connecting state then connected on open', async () => {
    const client = makeClient();
    expect(client.getState()).toBe(SignalingConnectionState.Disconnected);
    const p = client.connect('alice', [Tier.Adult]);
    expect(client.getState()).toBe(SignalingConnectionState.Connecting);
    const ws = getLastWS();
    ws.onopen!();
    await p;
    expect(client.getState()).toBe(SignalingConnectionState.Connected);
    expect(client.isConnected()).toBe(true);
  });

  it('connect sends hello on open', async () => {
    const client = makeClient();
    const p = client.connect('alice', [Tier.Adult, Tier.Minor]);
    const ws = getLastWS();
    ws.onopen!();
    await p;
    const hello = JSON.parse(ws.sent[0]!) as { type: string; payload: { username: string; tiers: Tier[] } };
    expect(hello.type).toBe(SignalingMessageType.Hello);
    expect(hello.payload.username).toBe('alice');
    expect(hello.payload.tiers).toEqual([Tier.Adult, Tier.Minor]);
  });

  it('connect sends hello with publicKey when provided', async () => {
    const client = makeClient();
    const p = client.connect('alice', [Tier.Adult], 'pub-key-b64');
    const ws = getLastWS();
    ws.onopen!();
    await p;
    const hello = JSON.parse(ws.sent[0]!) as { type: string; payload: { username: string; tiers: Tier[]; publicKey?: string } };
    expect(hello.type).toBe(SignalingMessageType.Hello);
    expect(hello.payload.publicKey).toBe('pub-key-b64');
  });

  it('connect sends hello without publicKey when not provided', async () => {
    const client = makeClient();
    const p = client.connect('alice', [Tier.Adult]);
    const ws = getLastWS();
    ws.onopen!();
    await p;
    const hello = JSON.parse(ws.sent[0]!) as { type: string; payload: { username: string; tiers: Tier[]; publicKey?: string } };
    expect(hello.payload.publicKey).toBeUndefined();
  });

  it('connect fires lifecycle.onOpen', async () => {
    const onOpen = vi.fn();
    const client = new SignalingClient({ url: 'ws://test', autoReconnect: false, lifecycle: { onOpen } });
    const p = client.connect('alice', [Tier.Adult]);
    const ws = getLastWS();
    ws.onopen!();
    await p;
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('connect rejects on error before open', async () => {
    const client = makeClient();
    const p = client.connect('alice', [Tier.Adult]);
    const ws = getLastWS();
    ws.onerror!(new Event('error'));
    await expect(p).rejects.toThrow('WebSocket connection failed');
  });

  it('onmessage dispatches to handleIncoming and fires lifecycle.onMessage', async () => {
    const onMessage = vi.fn();
    const onWelcome = vi.fn();
    const client = new SignalingClient({ url: 'ws://test', autoReconnect: false, lifecycle: { onMessage } });
    client.setHandlers({ onWelcome });
    const p = client.connect('alice', [Tier.Adult]);
    const ws = getLastWS();
    ws.onopen!();
    await p;
    ws.onmessage!({ data: envelope(SignalingMessageType.Welcome, { peerId: 'p-1', onlineUsernames: ['alice'] }) });
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onWelcome).toHaveBeenCalledWith('p-1', ['alice']);
  });

  it('heartbeat sends Heartbeat messages at interval', async () => {
    const client = makeClient();
    const p = client.connect('alice', [Tier.Adult]);
    const ws = getLastWS();
    ws.onopen!();
    await p;
    const heartbeatMessages = ws.sent.filter(s => (JSON.parse(s) as { type: string }).type === SignalingMessageType.Heartbeat);
    expect(heartbeatMessages.length).toBe(0);
    vi.advanceTimersByTime(15_000);
    const hb1 = ws.sent.filter(s => (JSON.parse(s) as { type: string }).type === SignalingMessageType.Heartbeat);
    expect(hb1.length).toBe(1);
    vi.advanceTimersByTime(15_000);
    const hb2 = ws.sent.filter(s => (JSON.parse(s) as { type: string }).type === SignalingMessageType.Heartbeat);
    expect(hb2.length).toBe(2);
  });

  it('disconnect stops heartbeat, closes transport, clears state', async () => {
    const client = makeClient();
    const p = client.connect('alice', [Tier.Adult]);
    const ws = getLastWS();
    ws.onopen!();
    await p;
    client.disconnect();
    expect(client.getState()).toBe(SignalingConnectionState.Disconnected);
    expect(client.isConnected()).toBe(false);
    expect(client.getPeerId()).toBeNull();
    const sentBefore = ws.sent.length;
    vi.advanceTimersByTime(15_000);
    expect(ws.sent.length).toBe(sentBefore);
  });

  it('disconnect does not attempt reconnect even if autoReconnect is true', async () => {
    const client = new SignalingClient({ url: 'ws://test', autoReconnect: true });
    const p = client.connect('alice', [Tier.Adult]);
    const ws = getLastWS();
    ws.onopen!();
    await p;
    client.disconnect();
    vi.advanceTimersByTime(60_000);
    expect(wsConstructorCalls).toBe(1);
  });

  it('onclose triggers reconnect with exponential backoff when autoReconnect enabled', async () => {
    const client = new SignalingClient({ url: 'ws://test', autoReconnect: true });
    const p = client.connect('alice', [Tier.Adult]);
    const ws = getLastWS();
    ws.onopen!();
    await p;
    ws.onclose!({ code: 1006, reason: 'abnormal' });
    expect(client.getState()).toBe(SignalingConnectionState.Reconnecting);
    expect(wsConstructorCalls).toBe(1);
    vi.advanceTimersByTime(1_000);
    expect(wsConstructorCalls).toBe(2);
  });

  it('reconnect backoff doubles: 1s → 2s → 4s → 8s → 16s', async () => {
    const client = new SignalingClient({ url: 'ws://test', autoReconnect: true });
    const p = client.connect('alice', [Tier.Adult]);
    let ws = getLastWS();
    ws.onopen!();
    await p;
    for (let i = 0; i < 5; i++) {
      ws.onclose!({ code: 1006, reason: '' });
      vi.advanceTimersByTime(1_000 * 2 ** i);
      ws = getLastWS();
    }
    expect(wsConstructorCalls).toBe(6);
    ws.onclose!({ code: 1006, reason: '' });
    vi.advanceTimersByTime(60_000);
    expect(wsConstructorCalls).toBe(6);
  });

  it('onclose does not reconnect when autoReconnect is false', async () => {
    const client = makeClient();
    const p = client.connect('alice', [Tier.Adult]);
    const ws = getLastWS();
    ws.onopen!();
    await p;
    ws.onclose!({ code: 1000, reason: 'normal' });
    expect(client.getState()).toBe(SignalingConnectionState.Disconnected);
    vi.advanceTimersByTime(60_000);
    expect(wsConstructorCalls).toBe(1);
  });

  it('onclose fires lifecycle.onClose with code and reason', async () => {
    const onClose = vi.fn();
    const client = new SignalingClient({ url: 'ws://test', autoReconnect: false, lifecycle: { onClose } });
    const p = client.connect('alice', [Tier.Adult]);
    const ws = getLastWS();
    ws.onopen!();
    await p;
    ws.onclose!({ code: 1001, reason: 'gone' });
    expect(onClose).toHaveBeenCalledWith(1001, 'gone');
  });

  it('joinRoom sends Join with room payload', async () => {
    const client = makeClient();
    const p = client.connect('alice', [Tier.Adult]);
    const ws = getLastWS();
    ws.onopen!();
    await p;
    client.joinRoom('lobby');
    const msg = JSON.parse(ws.sent[ws.sent.length - 1]!) as { type: string; payload: { room: string } };
    expect(msg.type).toBe(SignalingMessageType.Join);
    expect(msg.payload.room).toBe('lobby');
  });

  it('leaveRoom sends Leave with room payload', async () => {
    const client = makeClient();
    const p = client.connect('alice', [Tier.Adult]);
    const ws = getLastWS();
    ws.onopen!();
    await p;
    client.leaveRoom('lobby');
    const msg = JSON.parse(ws.sent[ws.sent.length - 1]!) as { type: string; payload: { room: string } };
    expect(msg.type).toBe(SignalingMessageType.Leave);
    expect(msg.payload.room).toBe('lobby');
  });

  it('sendOffer sends Offer with sdp+label and to field', async () => {
    const client = makeClient();
    const p = client.connect('alice', [Tier.Adult]);
    const ws = getLastWS();
    ws.onopen!();
    await p;
    client.handleIncoming(envelope(SignalingMessageType.Welcome, { peerId: 'p-1', onlineUsernames: [] }));
    client.sendOffer('p-2', 'sdp-data', 'chat');
    const msg = JSON.parse(ws.sent[ws.sent.length - 1]!) as { type: string; to: string; payload: { sdp: string; label: string } };
    expect(msg.type).toBe(SignalingMessageType.Offer);
    expect(msg.to).toBe('p-2');
    expect(msg.payload.sdp).toBe('sdp-data');
    expect(msg.payload.label).toBe('chat');
  });

  it('sendAnswer sends Answer with sdp and to field', async () => {
    const client = makeClient();
    const p = client.connect('alice', [Tier.Adult]);
    const ws = getLastWS();
    ws.onopen!();
    await p;
    client.handleIncoming(envelope(SignalingMessageType.Welcome, { peerId: 'p-1', onlineUsernames: [] }));
    client.sendAnswer('p-2', 'answer-sdp');
    const msg = JSON.parse(ws.sent[ws.sent.length - 1]!) as { type: string; to: string; payload: { sdp: string } };
    expect(msg.type).toBe(SignalingMessageType.Answer);
    expect(msg.to).toBe('p-2');
    expect(msg.payload.sdp).toBe('answer-sdp');
  });

  it('sendIceCandidate sends IceCandidate with candidate fields and to', async () => {
    const client = makeClient();
    const p = client.connect('alice', [Tier.Adult]);
    const ws = getLastWS();
    ws.onopen!();
    await p;
    client.handleIncoming(envelope(SignalingMessageType.Welcome, { peerId: 'p-1', onlineUsernames: [] }));
    client.sendIceCandidate('p-2', { candidate: 'cand', sdpMLineIndex: 0, sdpMid: 'data' });
    const msg = JSON.parse(ws.sent[ws.sent.length - 1]!) as { type: string; to: string; payload: { candidate: string; sdpMLineIndex: number; sdpMid: string } };
    expect(msg.type).toBe(SignalingMessageType.IceCandidate);
    expect(msg.to).toBe('p-2');
    expect(msg.payload.candidate).toBe('cand');
  });

  it('sendChatMessage sends ChatMessage with room', async () => {
    const client = makeClient();
    const p = client.connect('alice', [Tier.Adult]);
    const ws = getLastWS();
    ws.onopen!();
    await p;
    client.sendChatMessage('lobby', { id: 'm1', author: 'alice', content: 'hi', timestamp: 123 });
    const msg = JSON.parse(ws.sent[ws.sent.length - 1]!) as { type: string; room: string; payload: { id: string; author: string; content: string; timestamp: number } };
    expect(msg.type).toBe(SignalingMessageType.ChatMessage);
    expect(msg.room).toBe('lobby');
    expect(msg.payload.content).toBe('hi');
  });

  it('sendTyping sends Typing with room, username, isTyping', async () => {
    const client = makeClient();
    const p = client.connect('alice', [Tier.Adult]);
    const ws = getLastWS();
    ws.onopen!();
    await p;
    client.sendTyping('lobby', true);
    const msg = JSON.parse(ws.sent[ws.sent.length - 1]!) as { type: string; room: string; payload: { room: string; username: string; isTyping: boolean } };
    expect(msg.type).toBe(SignalingMessageType.Typing);
    expect(msg.payload.username).toBe('alice');
    expect(msg.payload.isTyping).toBe(true);
  });

  it('sendRequestRelay sends RequestRelay with room', async () => {
    const client = makeClient();
    const p = client.connect('alice', [Tier.Adult]);
    const ws = getLastWS();
    ws.onopen!();
    await p;
    client.sendRequestRelay('lobby');
    const msg = JSON.parse(ws.sent[ws.sent.length - 1]!) as { type: string; room: string; payload: { room: string } };
    expect(msg.type).toBe(SignalingMessageType.RequestRelay);
    expect(msg.payload.room).toBe('lobby');
  });

  it('sendPing sends Ping with id and sentAt', async () => {
    const client = makeClient();
    const p = client.connect('alice', [Tier.Adult]);
    const ws = getLastWS();
    ws.onopen!();
    await p;
    client.sendPing('ping-1', 12345);
    const msg = JSON.parse(ws.sent[ws.sent.length - 1]!) as { type: string; payload: { id: string; sentAt: number } };
    expect(msg.type).toBe(SignalingMessageType.Ping);
    expect(msg.payload.id).toBe('ping-1');
    expect(msg.payload.sentAt).toBe(12345);
  });

  it('sendPeerMetrics sends PeerMetrics with room and metrics', async () => {
    const client = makeClient();
    const p = client.connect('alice', [Tier.Adult]);
    const ws = getLastWS();
    ws.onopen!();
    await p;
    client.sendPeerMetrics('lobby', { latencyMs: 42, bandwidthKbps: 1000 });
    const msg = JSON.parse(ws.sent[ws.sent.length - 1]!) as { type: string; room: string; payload: { room: string; latencyMs: number; bandwidthKbps: number } };
    expect(msg.type).toBe(SignalingMessageType.PeerMetrics);
    expect(msg.payload.room).toBe('lobby');
    expect(msg.payload.latencyMs).toBe(42);
    expect(msg.payload.bandwidthKbps).toBe(1000);
  });

  it('send methods are no-op when not connected (no transport)', () => {
    const client = makeClient();
    expect(() => client.joinRoom('lobby')).not.toThrow();
    expect(() => client.sendOffer('p-2', 'sdp', 'chat')).not.toThrow();
    expect(() => client.sendChatMessage('lobby', { id: 'm', author: 'a', content: 'x', timestamp: 0 })).not.toThrow();
  });

  it('addHandlers chains existing and incoming handlers (existing fires first)', () => {
    const client = makeClient();
    const order: string[] = [];
    client.setHandlers({ onWelcome: () => { order.push('first'); } });
    client.addHandlers({ onWelcome: () => { order.push('second'); } });
    client.handleIncoming(envelope(SignalingMessageType.Welcome, { peerId: 'p-1', onlineUsernames: [] }));
    expect(order).toEqual(['first', 'second']);
  });

  it('addHandlers sets handler when no existing handler', () => {
    const client = makeClient();
    const onPeerLeft = vi.fn();
    client.setHandlers({});
    client.addHandlers({ onPeerLeft });
    client.handleIncoming(envelope(SignalingMessageType.PeerLeft, { peerId: 'p-2', room: 'lobby', wasHub: false }));
    expect(onPeerLeft).toHaveBeenCalledWith('p-2', 'lobby', false);
  });

  it('connect resets reconnectAttempts', async () => {
    const client = new SignalingClient({ url: 'ws://test', autoReconnect: true });
    const p = client.connect('alice', [Tier.Adult]);
    let ws = getLastWS();
    ws.onopen!();
    await p;
    ws.onclose!({ code: 1006, reason: '' });
    vi.advanceTimersByTime(1_000);
    expect(wsConstructorCalls).toBe(2);
    ws = getLastWS();
    ws.onclose!({ code: 1006, reason: '' });
    vi.advanceTimersByTime(2_000);
    expect(wsConstructorCalls).toBe(3);
    ws = getLastWS();
    ws.onopen!();
    const p2 = client.connect('bob', [Tier.Adult]);
    ws = getLastWS();
    ws.onopen!();
    await p2;
    ws.onclose!({ code: 1006, reason: '' });
    vi.advanceTimersByTime(1_000);
    expect(wsConstructorCalls).toBe(5);
  });

  it('onerror fires lifecycle.onError after open (no reject)', async () => {
    const onError = vi.fn();
    const client = new SignalingClient({ url: 'ws://test', autoReconnect: false, lifecycle: { onError } });
    const p = client.connect('alice', [Tier.Adult]);
    const ws = getLastWS();
    ws.onopen!();
    await p;
    ws.onerror!(new Event('error'));
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('connect rejects when WebSocket is not available', async () => {
    const saved = globalThis.WebSocket;
    globalThis.WebSocket = undefined as unknown as typeof globalThis.WebSocket;
    const client = new SignalingClient({ url: 'ws://test', autoReconnect: false });
    await expect(client.connect('alice', [Tier.Adult])).rejects.toThrow('WebSocket is not available');
    globalThis.WebSocket = saved;
  });
});
