import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SignalingServer, type PeerSender, type SignalingSession } from '../server/services/SignalingServer';
import { SignalingClient } from '../app/features/transport/services/SignalingClient';
import { PresenceStatus } from '#shared/types/Signaling';
import { Tier } from '#shared/types/Tier';

/**
 * Integration tests wiring SignalingClient to SignalingServer through a
 * mock WebSocket. The MockWebSocket intercepts client.send() calls and
 * forwards them to server.handle(); server sender.send() calls forward
 * to the client's onmessage handler. This exercises the full protocol
 * round-trip (envelope encode â†’ wire â†’ decode â†’ handler dispatch) on both
 * sides without a real network.
 */

interface MockWebSocketLike {
  onopen: (() => void) | null;
  onmessage: ((ev: { data: string }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onclose: ((ev: { code: number; reason: string }) => void) | null;
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
  readyState: number;
}

/**
 * Module-level server reference â€” MockWebSocket needs to access it from
 * the constructor (which only receives a URL, matching the real WebSocket
 * signature).
 */
let currentServer: SignalingServer | null = null;

/**
 * Registry of all active MockWebSocket instances, keyed by peerId.
 * Used by MockPeerSender.publish() to broadcast to other peers in a room.
 */
const activeSockets = new Map<string, MockWebSocketLike>();

/**
 * Tracks which rooms each peer is subscribed to.
 */
const subscriptions = new Map<string, Set<string>>();

class MockPeerSender implements PeerSender {
  readonly peerId: string;
  private ws: MockWebSocketLike;
  private session: SignalingSession | null = null;

  static nextId = 0;

  constructor (ws: MockWebSocketLike) {
    this.ws = ws;
    this.peerId = `peer-${++MockPeerSender.nextId}`;
  }

  setSession (session: SignalingSession): void {
    this.session = session;
  }

  send (data: string): void {
    this.ws.deliver(data);
  }

  publish (topic: string, data: string): void {
    // Deliver to all peers subscribed to this room, EXCEPT this sender.
    const peers = subscriptions.get(topic);
    if (peers === undefined) { return; }
    for (const peerId of peers) {
      if (peerId === this.peerId) { continue; }
      activeSockets.get(peerId)?.deliver(data);
    }
  }

  subscribe (topic: string): void {
    let peers = subscriptions.get(topic);
    if (peers === undefined) {
      peers = new Set();
      subscriptions.set(topic, peers);
    }
    peers.add(this.peerId);
  }

  unsubscribe (topic: string): void {
    subscriptions.get(topic)?.delete(this.peerId);
  }
}

class MockWebSocket implements MockWebSocketLike {
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onclose: ((ev: { code: number; reason: string }) => void) | null = null;
  readyState = 0;

  private readonly server: SignalingServer;
  private readonly sender: MockPeerSender;
  private readonly session: SignalingSession;

  constructor (_url: string) {
    if (currentServer === null) { throw new Error('No server set'); }
    this.server = currentServer;
    this.sender = new MockPeerSender(this);
    this.session = this.server.connect(this.sender.peerId, this.sender);
    this.sender.setSession(this.session);
    activeSockets.set(this.sender.peerId, this);

    queueMicrotask(() => {
      this.readyState = 1;
      this.onopen?.();
    });
  }

  send (data: string): void {
    const result = this.server.handle(this.session, this.sender, data, Date.now());
    if (result.action === 'close') {
      this.close(result.code, result.reason);
    }
  }

  close (code?: number, reason?: string): void {
    this.readyState = 3;
    // Clean up subscriptions for this peer.
    for (const [room, peers] of subscriptions) {
      peers.delete(this.sender.peerId);
      if (peers.size === 0) { subscriptions.delete(room); }
    }
    activeSockets.delete(this.sender.peerId);
    this.server.disconnect(this.sender.peerId, Date.now());
    this.onclose?.({ code: code ?? 1000, reason: reason ?? '' });
  }

  /** Called by MockPeerSender to deliver a server-originated message. */
  deliver (data: string): void {
    this.onmessage?.({ data });
  }
}

describe('Signaling integration', () => {
  let server: SignalingServer;
  let originalWebSocket: typeof WebSocket | undefined;

  beforeEach(() => {
    server = new SignalingServer({ meshThreshold: 3 });
    currentServer = server;
    MockPeerSender.nextId = 0;
    activeSockets.clear();
    subscriptions.clear();
    originalWebSocket = globalThis.WebSocket;
    (globalThis as { WebSocket: unknown }).WebSocket = MockWebSocket;
  });

  afterEach(() => {
    if (originalWebSocket !== undefined) {
      (globalThis as { WebSocket: unknown }).WebSocket = originalWebSocket;
    } else {
      delete (globalThis as { WebSocket: unknown }).WebSocket;
    }
    vi.restoreAllMocks();
  });

  /**
   * Connect a SignalingClient to the server. Returns the client plus a
   * record of handler calls for assertions.
   */
  async function connectClient (username: string, tiers: Tier[] = [Tier.Adult]): Promise<{
    client: SignalingClient;
    handlers: {
      onWelcome: ReturnType<typeof vi.fn>;
      onPeerJoined: ReturnType<typeof vi.fn>;
      onPeerLeft: ReturnType<typeof vi.fn>;
      onRoomDestroyed: ReturnType<typeof vi.fn>;
      onTransportMode: ReturnType<typeof vi.fn>;
      onHubElected: ReturnType<typeof vi.fn>;
      onError: ReturnType<typeof vi.fn>;
      onPresence: ReturnType<typeof vi.fn>;
      onOfferRelayed: ReturnType<typeof vi.fn>;
      onAnswerRelayed: ReturnType<typeof vi.fn>;
      onIceCandidateRelayed: ReturnType<typeof vi.fn>;
      onRelayBroadcast: ReturnType<typeof vi.fn>;
      onPong: ReturnType<typeof vi.fn>;
      onTyping: ReturnType<typeof vi.fn>;
    };
  }> {
    const client = new SignalingClient({
      url: 'ws://test/signaling',
      autoReconnect: false
    });

    const handlers = {
      onWelcome: vi.fn(),
      onPeerJoined: vi.fn(),
      onPeerLeft: vi.fn(),
      onRoomDestroyed: vi.fn(),
      onTransportMode: vi.fn(),
      onHubElected: vi.fn(),
      onError: vi.fn(),
      onPresence: vi.fn(),
      onOfferRelayed: vi.fn(),
      onAnswerRelayed: vi.fn(),
      onIceCandidateRelayed: vi.fn(),
      onRelayBroadcast: vi.fn(),
      onPong: vi.fn(),
      onTyping: vi.fn()
    };

    client.setHandlers(handlers);
    await client.connect(username, tiers);
    // Wait for the microtask queue to flush (MockWebSocket opens in a microtask).
    await flushMicrotasks();

    return { client, handlers };
  }

  async function flushMicrotasks (): Promise<void> {
    await new Promise<void>((resolve) => { setTimeout(resolve, 0); });
  }

  it('full lifecycle: connect, hello, welcome, join, peer-joined, leave, room-destroyed', async () => {
    const { client: alice, handlers: aliceHandlers } = await connectClient('alice');

    // Alice should receive a Welcome with her peerId. The online list
    // includes her own username (claimed before the snapshot is taken).
    expect(alice.isConnected()).toBe(true);
    expect(aliceHandlers.onWelcome).toHaveBeenCalledTimes(1);
    const welcomeArg = aliceHandlers.onWelcome.mock.calls[0]!;
    expect(welcomeArg[0]).toMatch(/^peer-\d+$/);
    expect(welcomeArg[1]).toEqual(['alice']);

    // Alice joins a room.
    alice.joinRoom('lounge');
    await flushMicrotasks();

    expect(aliceHandlers.onTransportMode).toHaveBeenCalledWith('lounge', 'mesh', undefined);

    // Bob connects and joins the same room.
    const { client: bob, handlers: bobHandlers } = await connectClient('bob');

    // Bob should see alice in the welcome's onlineUsernames.
    expect(bobHandlers.onWelcome).toHaveBeenCalledTimes(1);
    expect(bobHandlers.onWelcome.mock.calls[0]![1]).toContain('alice');

    // Bob should also receive a presence-online for alice (already connected).
    // Actually presence is broadcast on hello, not on welcome. Let's check:
    // When alice connected, no one was online. When bob connects, alice gets
    // a presence-online for bob. Bob doesn't get one for alice (excluded as sender).
    // Bob's welcome includes the onlineUsernames snapshot.

    bob.joinRoom('lounge');
    await flushMicrotasks();

    // Bob receives transport-mode for the room.
    expect(bobHandlers.onTransportMode).toHaveBeenCalledWith('lounge', 'mesh', undefined);

    // Bob receives peer-joined for alice (existing peer).
    expect(bobHandlers.onPeerJoined).toHaveBeenCalledTimes(1);
    const peerJoinedArg = bobHandlers.onPeerJoined.mock.calls[0]!;
    expect(peerJoinedArg[0].username).toBe('alice');
    expect(peerJoinedArg[1]).toBe('lounge');

    // Alice receives peer-joined for bob (new peer).
    expect(aliceHandlers.onPeerJoined).toHaveBeenCalledTimes(1);
    const alicePeerJoinedArg = aliceHandlers.onPeerJoined.mock.calls[0]!;
    expect(alicePeerJoinedArg[0].username).toBe('bob');
    expect(alicePeerJoinedArg[1]).toBe('lounge');

    // Bob leaves the room.
    bob.leaveRoom('lounge');
    await flushMicrotasks();

    // Alice receives peer-left for bob.
    expect(aliceHandlers.onPeerLeft).toHaveBeenCalledTimes(1);
    const peerLeftArg = aliceHandlers.onPeerLeft.mock.calls[0]!;
    expect(peerLeftArg[0]).toBe(bob.getPeerId());
    expect(peerLeftArg[1]).toBe('lounge');
    expect(peerLeftArg[2]).toBe(false);

    // Bob disconnects entirely.
    bob.disconnect();
    await flushMicrotasks();

    // Alice is now the only one. When alice leaves, the room is destroyed.
    alice.leaveRoom('lounge');
    alice.disconnect();
    await flushMicrotasks();
  });

  it('rejects join with tier mismatch', async () => {
    // Create a room as an adult, then try to join as a minor.
    const { client: alice } = await connectClient('alice', [Tier.Adult]);
    alice.joinRoom('adults-only');
    await flushMicrotasks();

    const { client: bob, handlers: bobHandlers } = await connectClient('bob', [Tier.Minor]);
    bob.joinRoom('adults-only');
    await flushMicrotasks();

    // Bob should receive an error (tier-mismatch).
    expect(bobHandlers.onError).toHaveBeenCalledTimes(1);
    const errorArg = bobHandlers.onError.mock.calls[0]!;
    expect(errorArg[0]).toBe('tier-mismatch');
  });

  it('delivers relay broadcast in relay mode', async () => {
    const { client: alice, handlers: aliceHandlers } = await connectClient('alice');
    const { client: bob, handlers: bobHandlers } = await connectClient('bob');

    alice.joinRoom('relay-room');
    await flushMicrotasks();
    bob.joinRoom('relay-room');
    await flushMicrotasks();

    // Force relay mode by having alice request it.
    alice.sendRequestRelay('relay-room');
    await flushMicrotasks();

    // Both should receive transport-mode with relay.
    expect(aliceHandlers.onTransportMode).toHaveBeenCalledWith('relay-room', 'relay', undefined);
    expect(bobHandlers.onTransportMode).toHaveBeenCalledWith('relay-room', 'relay', undefined);

    // Alice sends a chat message in relay mode.
    alice.sendChatMessage('relay-room', {
      id: 'msg-1',
      author: 'alice',
      content: 'hello via relay',
      timestamp: Date.now()
    });
    await flushMicrotasks();

    // Bob should receive the relay broadcast.
    expect(bobHandlers.onRelayBroadcast).toHaveBeenCalledTimes(1);
    const relayArg = bobHandlers.onRelayBroadcast.mock.calls[0]!;
    expect(relayArg[0]).toBe('relay-room');
    expect(relayArg[1].content).toBe('hello via relay');

    alice.disconnect();
    bob.disconnect();
    await flushMicrotasks();
  });

  it('relays offer/answer/ICE between two peers', async () => {
    const { client: alice, handlers: aliceHandlers } = await connectClient('alice');
    const { client: bob, handlers: bobHandlers } = await connectClient('bob');

    alice.joinRoom('room1');
    await flushMicrotasks();
    bob.joinRoom('room1');
    await flushMicrotasks();

    const bobPeerId = bob.getPeerId()!;

    // Alice sends an offer to bob.
    alice.sendOffer(bobPeerId, 'offer-sdp', 'chat');
    await flushMicrotasks();

    expect(bobHandlers.onOfferRelayed).toHaveBeenCalledTimes(1);
    const offerArg = bobHandlers.onOfferRelayed.mock.calls[0]!;
    expect(offerArg[0]).toBe(alice.getPeerId());
    expect(offerArg[1]).toBe('offer-sdp');
    expect(offerArg[2]).toBe('chat');

    // Bob sends an answer back to alice.
    const alicePeerId = alice.getPeerId()!;
    bob.sendAnswer(alicePeerId, 'answer-sdp');
    await flushMicrotasks();

    expect(aliceHandlers.onAnswerRelayed).toHaveBeenCalledTimes(1);
    const answerArg = aliceHandlers.onAnswerRelayed.mock.calls[0]!;
    expect(answerArg[0]).toBe(bobPeerId);
    expect(answerArg[1]).toBe('answer-sdp');

    // Alice sends an ICE candidate to bob.
    alice.sendIceCandidate(bobPeerId, {
      candidate: 'ice-candidate',
      sdpMLineIndex: 0,
      sdpMid: 'data'
    });
    await flushMicrotasks();

    expect(bobHandlers.onIceCandidateRelayed).toHaveBeenCalledTimes(1);
    const iceArg = bobHandlers.onIceCandidateRelayed.mock.calls[0]!;
    expect(iceArg[0]).toBe(alice.getPeerId());
    expect(iceArg[1]).toBe('ice-candidate');
    expect(iceArg[2]).toBe(0);
    expect(iceArg[3]).toBe('data');

    alice.disconnect();
    bob.disconnect();
    await flushMicrotasks();
  });

  it('ping/pong round-trip', async () => {
    const { client: alice, handlers: aliceHandlers } = await connectClient('alice');

    alice.sendPing('ping-1', 1000);
    await flushMicrotasks();

    expect(aliceHandlers.onPong).toHaveBeenCalledTimes(1);
    const pongArg = aliceHandlers.onPong.mock.calls[0]!;
    expect(pongArg[0]).toBe('ping-1');
    expect(pongArg[1]).toBe(1000);

    alice.disconnect();
    await flushMicrotasks();
  });

  it('typing indicators are relayed to the room', async () => {
    const { client: alice } = await connectClient('alice');
    const { client: bob, handlers: bobHandlers } = await connectClient('bob');

    alice.joinRoom('chat-room');
    await flushMicrotasks();
    bob.joinRoom('chat-room');
    await flushMicrotasks();

    // Alice starts typing.
    alice.sendTyping('chat-room', true);
    await flushMicrotasks();

    expect(bobHandlers.onTyping).toHaveBeenCalledTimes(1);
    const typingArg = bobHandlers.onTyping.mock.calls[0]!;
    expect(typingArg[0]).toBe('chat-room');
    expect(typingArg[1]).toBe('alice');
    expect(typingArg[2]).toBe(true);

    // Alice stops typing.
    alice.sendTyping('chat-room', false);
    await flushMicrotasks();

    expect(bobHandlers.onTyping).toHaveBeenCalledTimes(2);
    const stopTypingArg = bobHandlers.onTyping.mock.calls[1]!;
    expect(stopTypingArg[2]).toBe(false);

    alice.disconnect();
    bob.disconnect();
    await flushMicrotasks();
  });

  it('presence broadcast on connect and disconnect', async () => {
    const { client: alice, handlers: aliceHandlers } = await connectClient('alice');

    // Alice sees her own username in the online list (claimed before snapshot).
    expect(aliceHandlers.onWelcome.mock.calls[0]![1]).toEqual(['alice']);

    // Bob connects â€” alice should get a presence-online for bob.
    const { client: bob } = await connectClient('bob');
    await flushMicrotasks();

    expect(aliceHandlers.onPresence).toHaveBeenCalledTimes(1);
    const presenceArg = aliceHandlers.onPresence.mock.calls[0]!;
    expect(presenceArg[0]).toBe('bob');
    expect(presenceArg[1]).toBe(PresenceStatus.Online);

    // Bob disconnects â€” alice should get a presence-offline for bob.
    bob.disconnect();
    await flushMicrotasks();

    const offlineCall = aliceHandlers.onPresence.mock.calls.find(
      c => c[1] === PresenceStatus.Offline
    );
    expect(offlineCall).toBeDefined();
    expect(offlineCall![0]).toBe('bob');

    alice.disconnect();
    await flushMicrotasks();
  });

  it('room-destroyed when last peer leaves', async () => {
    const { client: alice, handlers: aliceHandlers } = await connectClient('alice');
    const { client: bob, handlers: bobHandlers } = await connectClient('bob');

    alice.joinRoom('temp-room');
    await flushMicrotasks();
    bob.joinRoom('temp-room');
    await flushMicrotasks();

    // Alice leaves â€” bob gets peer-left, room still has bob.
    alice.leaveRoom('temp-room');
    await flushMicrotasks();

    expect(bobHandlers.onPeerLeft).toHaveBeenCalledTimes(1);
    expect(aliceHandlers.onRoomDestroyed).toHaveBeenCalledTimes(0);

    // Bob leaves â€” room is destroyed (bob was the last peer).
    // No one is left to receive the room-destroyed broadcast.
    bob.leaveRoom('temp-room');
    await flushMicrotasks();

    // Alice already left the room, so she should not receive room-destroyed.
    expect(aliceHandlers.onRoomDestroyed).toHaveBeenCalledTimes(0);

    alice.disconnect();
    bob.disconnect();
    await flushMicrotasks();
  });
});
