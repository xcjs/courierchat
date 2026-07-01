import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SignalingHandlers } from '../types/Transport';
import { SignalingClient } from './SignalingClient';
import { SignalingMessageType, SignalingErrorCode, TransportMode, PresenceStatus } from '#shared/types/Signaling';

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
