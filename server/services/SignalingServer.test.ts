import { describe, it, expect, beforeEach } from 'vitest';
import { SignalingServer, type PeerSender, type SignalingSession } from './SignalingServer';
import { SignalingMessageType, SignalingErrorCode, PresenceStatus, type SignalingEnvelope } from '#shared/types/Signaling';

/**
 * Mock sender that records all sent/published messages. Implements
 * PeerSender by collecting messages in arrays for test assertions.
 */
class MockSender implements PeerSender {
  readonly peerId: string;
  readonly sent: string[] = [];
  readonly published: Array<{ topic: string; data: string }> = [];
  readonly subscribed: string[] = [];
  readonly unsubscribed: string[] = [];

  constructor (peerId: string) {
    this.peerId = peerId;
  }

  send (data: string): void {
    this.sent.push(data);
  }

  publish (topic: string, data: string): void {
    this.published.push({ topic, data });
  }

  subscribe (topic: string): void {
    this.subscribed.push(topic);
  }

  unsubscribe (topic: string): void {
    this.unsubscribed.push(topic);
  }

  /** Parse the last sent message as an envelope. */
  lastSent (): SignalingEnvelope {
    return JSON.parse(this.sent[this.sent.length - 1]) as SignalingEnvelope;
  }

  /** Parse all published messages for a topic as envelopes. */
  publishedFor (topic: string): SignalingEnvelope[] {
    return this.published.filter(p => p.topic === topic).map(p => JSON.parse(p.data) as SignalingEnvelope);
  }
}

describe('SignalingServer', () => {
  let server: SignalingServer;
  const now = 1_000_000;

  beforeEach(() => {
    server = new SignalingServer({ meshThreshold: 3 });
  });

  function connect (peerId: string): { session: SignalingSession; sender: MockSender } {
    const sender = new MockSender(peerId);
    const session = server.connect(peerId, sender);
    return { session, sender };
  }

  function hello (session: SignalingSession, sender: MockSender, username: string, tiers: ('minor' | 'adult')[] = ['adult']): void {
    server.handle(session, sender, JSON.stringify({
      type: SignalingMessageType.Hello, payload: { username, tiers }, ts: now
    }), now);
  }

  function join (session: SignalingSession, sender: MockSender, room: string): void {
    server.handle(session, sender, JSON.stringify({
      type: SignalingMessageType.Join, room, payload: { room }, ts: now
    }), now);
  }

  describe('connect/disconnect', () => {
    it('creates a session on connect', () => {
      const { session } = connect('p1');
      expect(session.peerId).toBe('p1');
      expect(server.getSession('p1')).toBe(session);
    });

    it('cleans up username and rooms on disconnect', () => {
      const { session, sender } = connect('p1');
      hello(session, sender, 'alice');
      join(session, sender, 'lounge');
      const results = server.disconnect('p1');
      expect(results).toHaveLength(1);
      expect(results[0].room).toBe('lounge');
      expect(results[0].destroyed).toBe(true);
      expect(server.getSession('p1')).toBeUndefined();
    });

    it('returns empty array for unknown peer', () => {
      expect(server.disconnect('nobody')).toEqual([]);
    });
  });

  describe('hello', () => {
    it('assigns peerId and sends welcome with online usernames', () => {
      const { session, sender } = connect('p1');
      hello(session, sender, 'alice');
      const welcome = sender.lastSent();
      expect(welcome.type).toBe(SignalingMessageType.Welcome);
      expect(welcome.payload).toMatchObject({ peerId: 'p1', onlineUsernames: ['alice'] });
      expect(session.username).toBe('alice');
      expect(session.isAuthenticated).toBe(true);
    });

    it('rejects a duplicate username with username-in-use', () => {
      const a = connect('p1'); hello(a.session, a.sender, 'alice');
      const b = connect('p2'); hello(b.session, b.sender, 'alice');
      const err = b.sender.lastSent();
      expect(err.type).toBe('error');
      expect(err.payload).toMatchObject({ code: SignalingErrorCode.UsernameInUse });
      expect(b.session.username).toBeNull();
    });

    it('rejects an invalid username', () => {
      const { session, sender } = connect('p1');
      server.handle(session, sender, JSON.stringify({
        type: 'hello', payload: { username: '', tiers: ['adult'] }, ts: now
      }), now);
      const err = sender.lastSent();
      expect(err.type).toBe('error');
      expect(err.payload).toMatchObject({ code: SignalingErrorCode.UsernameInvalid });
    });
  });

  describe('join', () => {
    it('sends transport-mode and peer-joined for existing peers', () => {
      const a = connect('p1'); hello(a.session, a.sender, 'alice');
      const b = connect('p2'); hello(b.session, b.sender, 'bob');
      join(a.session, a.sender, 'lounge');
      // Clear alice's messages
      a.sender.sent.length = 0;
      join(b.session, b.sender, 'lounge');
      // bob should receive transport-mode + peer-joined for alice
      const types = b.sender.sent.map(s => (JSON.parse(s) as SignalingEnvelope).type);
      expect(types).toContain(SignalingMessageType.TransportMode);
      expect(types).toContain(SignalingMessageType.PeerJoined);
    });

    it('publishes peer-joined to the room topic', () => {
      const a = connect('p1'); hello(a.session, a.sender, 'alice');
      const b = connect('p2'); hello(b.session, b.sender, 'bob');
      join(a.session, a.sender, 'lounge');
      join(b.session, b.sender, 'lounge');
      const published = a.sender.publishedFor('lounge');
      expect(published.some(p => p.type === SignalingMessageType.PeerJoined)).toBe(true);
    });

    it('subscribes the sender to the room topic', () => {
      const { session, sender } = connect('p1');
      hello(session, sender, 'alice');
      join(session, sender, 'lounge');
      expect(sender.subscribed).toContain('lounge');
    });

    it('rejects join without authentication', () => {
      const { session, sender } = connect('p1');
      server.handle(session, sender, JSON.stringify({
        type: 'join', room: 'lounge', payload: { room: 'lounge' }, ts: now
      }), now);
      const err = sender.lastSent();
      expect(err.type).toBe('error');
      expect(err.payload).toMatchObject({ code: SignalingErrorCode.NotJoined });
    });

    it('rejects tier-mismatched join', () => {
      const { session, sender } = connect('p1');
      hello(session, sender, 'alice', ['minor']);
      // Create a room with adult-only tiers first
      const a2 = connect('p2'); hello(a2.session, a2.sender, 'bob', ['adult']);
      join(a2.session, a2.sender, 'adults-only');
      // Now alice (minor) tries to join
      server.handle(session, sender, JSON.stringify({
        type: 'join', room: 'adults-only', payload: { room: 'adults-only' }, ts: now
      }), now);
      const err = sender.lastSent();
      expect(err.type).toBe('error');
      expect(err.payload).toMatchObject({ code: SignalingErrorCode.TierMismatch });
    });

    it('switches to star mode and broadcasts hub-elected above threshold', () => {
      // meshThreshold is 3
      const peers = [];
      for (let i = 1; i <= 4; i++) {
        const p = connect(`p${i}`);
        hello(p.session, p.sender, `user${i}`);
        join(p.session, p.sender, 'bigroom');
        peers.push(p);
      }
      // The 4th join should trigger star mode + hub election
      const published = peers[3].sender.publishedFor('bigroom');
      expect(published.some(p => p.type === SignalingMessageType.HubElected)).toBe(true);
    });
  });

  describe('leave', () => {
    it('notifies room peers and unsubscribes', () => {
      const a = connect('p1'); hello(a.session, a.sender, 'alice');
      const b = connect('p2'); hello(b.session, b.sender, 'bob');
      join(a.session, a.sender, 'lounge');
      join(b.session, b.sender, 'lounge');
      a.sender.published.length = 0;
      server.handle(a.session, a.sender, JSON.stringify({
        type: 'leave', room: 'lounge', payload: {}, ts: now
      }), now);
      const published = a.sender.publishedFor('lounge');
      expect(published.some(p => p.type === SignalingMessageType.PeerLeft)).toBe(true);
      expect(a.sender.unsubscribed).toContain('lounge');
      expect(a.session.joinedRooms.has('lounge')).toBe(false);
    });

    it('sends room-destroyed when the last peer leaves', () => {
      const a = connect('p1'); hello(a.session, a.sender, 'alice');
      join(a.session, a.sender, 'lounge');
      server.handle(a.session, a.sender, JSON.stringify({
        type: 'leave', room: 'lounge', payload: {}, ts: now
      }), now);
      const published = a.sender.publishedFor('lounge');
      expect(published.some(p => p.type === SignalingMessageType.RoomDestroyed)).toBe(true);
    });
  });

  describe('heartbeat', () => {
    it('refreshes username and room heartbeat timestamps', () => {
      const { session, sender } = connect('p1');
      hello(session, sender, 'alice');
      join(session, sender, 'lounge');
      // Clear messages from hello/join phase
      sender.sent.length = 0;
      const result = server.handle(session, sender, JSON.stringify({
        type: 'heartbeat', payload: {}, ts: now + 10_000
      }), now + 10_000);
      expect(result.action).toBe('continue');
      // No error sent means heartbeat was accepted
      expect(sender.sent).toHaveLength(0);
    });
  });

  describe('offer/answer/ice-candidate relay', () => {
    it('relays an offer to the target peer via direct send', () => {
      const a = connect('p1'); hello(a.session, a.sender, 'alice');
      const b = connect('p2'); hello(b.session, b.sender, 'bob');
      server.handle(a.session, a.sender, JSON.stringify({
        type: 'offer', to: 'p2', payload: { sdp: 'sdp-data', label: 'chat' }, ts: now
      }), now);
      // The target peer (p2) should have received the relayed offer via send.
      const relayed = b.sender.lastSent();
      expect(relayed.type).toBe(SignalingMessageType.OfferRelayed);
      expect(relayed.to).toBe('p2');
      expect(relayed.from).toBe('p1');
      // The sender (p1) should NOT have published to a peer topic.
      expect(a.sender.published.filter(p => p.topic.startsWith('peer:'))).toHaveLength(0);
    });

    it('sends error when target peer not found', () => {
      const a = connect('p1'); hello(a.session, a.sender, 'alice');
      server.handle(a.session, a.sender, JSON.stringify({
        type: 'offer', to: 'nobody', payload: { sdp: 'sdp' }, ts: now
      }), now);
      const err = a.sender.lastSent();
      expect(err.type).toBe('error');
    });
  });

  describe('chat-message (relay mode)', () => {
    it('broadcasts in relay mode but not in mesh mode', () => {
      const a = connect('p1'); hello(a.session, a.sender, 'alice');
      join(a.session, a.sender, 'lounge');
      // mesh mode (1 peer) — should not broadcast
      server.handle(a.session, a.sender, JSON.stringify({
        type: SignalingMessageType.ChatMessage, room: 'lounge', payload: { id: '1', author: 'alice', content: 'hi', timestamp: now }, ts: now
      }), now);
      expect(a.sender.publishedFor('lounge').filter(p => p.type === SignalingMessageType.RelayBroadcast)).toHaveLength(0);
    });

    it('broadcasts RelayBroadcast when room is in relay mode', () => {
      const a = connect('p1'); hello(a.session, a.sender, 'alice');
      const b = connect('p2'); hello(b.session, b.sender, 'bob');
      join(a.session, a.sender, 'lounge');
      join(b.session, b.sender, 'lounge');
      // Force relay mode via RequestRelay from alice.
      server.handle(a.session, a.sender, JSON.stringify({
        type: SignalingMessageType.RequestRelay, room: 'lounge', payload: { room: 'lounge' }, ts: now
      }), now);
      a.sender.sent.length = 0;
      a.sender.published.length = 0;
      server.handle(a.session, a.sender, JSON.stringify({
        type: SignalingMessageType.ChatMessage, room: 'lounge', payload: { id: '1', author: 'alice', content: 'hi', timestamp: now }, ts: now
      }), now);
      const relayed = a.sender.publishedFor('lounge').filter(p => p.type === SignalingMessageType.RelayBroadcast);
      expect(relayed).toHaveLength(1);
      expect(relayed[0].payload.message.content).toBe('hi');
    });
  });

  describe('request-relay', () => {
    it('transitions room to relay and broadcasts TransportMode', () => {
      const a = connect('p1'); hello(a.session, a.sender, 'alice');
      const b = connect('p2'); hello(b.session, b.sender, 'bob');
      join(a.session, a.sender, 'lounge');
      join(b.session, b.sender, 'lounge');
      a.sender.sent.length = 0;
      a.sender.published.length = 0;
      server.handle(a.session, a.sender, JSON.stringify({
        type: SignalingMessageType.RequestRelay, room: 'lounge', payload: { room: 'lounge' }, ts: now
      }), now);
      // Other peers receive the broadcast via publish.
      const published = a.sender.publishedFor('lounge').filter(p => p.type === SignalingMessageType.TransportMode);
      expect(published).toHaveLength(1);
      expect(published[0].payload.mode).toBe('relay');
      // Requester receives the TransportMode via direct send.
      const sent = a.sender.lastSent();
      expect(sent.type).toBe(SignalingMessageType.TransportMode);
      expect(sent.payload.mode).toBe('relay');
    });

    it('rejects request-relay from a peer not in the room', () => {
      const a = connect('p1'); hello(a.session, a.sender, 'alice');
      const result = server.handle(a.session, a.sender, JSON.stringify({
        type: SignalingMessageType.RequestRelay, room: 'lounge', payload: { room: 'lounge' }, ts: now
      }), now);
      expect(result.action).toBe('continue');
      expect(a.sender.lastSent().type).toBe('error');
      expect(a.sender.lastSent().payload.code).toBe(SignalingErrorCode.NotJoined);
    });

    it('relay mode is sticky across peer join/leave', () => {
      const a = connect('p1'); hello(a.session, a.sender, 'alice');
      const b = connect('p2'); hello(b.session, b.sender, 'bob');
      const c = connect('p3'); hello(c.session, c.sender, 'carol');
      join(a.session, a.sender, 'lounge');
      join(b.session, b.sender, 'lounge');
      // Force relay.
      server.handle(a.session, a.sender, JSON.stringify({
        type: SignalingMessageType.RequestRelay, room: 'lounge', payload: { room: 'lounge' }, ts: now
      }), now);
      // A new peer joins; evaluateTransport should NOT override relay.
      join(c.session, c.sender, 'lounge');
      const room = server.getAllSessions().length; // sanity
      expect(room).toBeGreaterThan(0);
      // The room record should still be in relay mode.
      const transportMode = c.sender.sent
        .map(s => JSON.parse(s) as SignalingEnvelope)
        .find(e => e.type === SignalingMessageType.TransportMode);
      expect(transportMode?.payload.mode).toBe('relay');
    });
  });

  describe('reapStale', () => {
    it('evicts stale peers from rooms', () => {
      const { session, sender } = connect('p1');
      hello(session, sender, 'alice');
      join(session, sender, 'lounge');
      const result = server.reapStale(now + 46_000);
      expect(result).toEqual([{ room: 'lounge', peerIds: ['p1'] }]);
    });
  });

  describe('invalid input', () => {
    it('sends error for invalid JSON', () => {
      const { session, sender } = connect('p1');
      const result = server.handle(session, sender, 'not-json', now);
      expect(result.action).toBe('continue');
      expect(sender.lastSent().type).toBe('error');
    });

    it('sends error for unknown message type', () => {
      const { session, sender } = connect('p1');
      const result = server.handle(session, sender, JSON.stringify({
        type: 'unknown-type', payload: {}, ts: now
      }), now);
      expect(result.action).toBe('continue');
      expect(sender.lastSent().type).toBe('error');
    });
  });

  describe('ping/pong', () => {
    it('echoes a pong with the same id and sentAt', () => {
      const { session, sender } = connect('p1');
      server.handle(session, sender, JSON.stringify({
        type: SignalingMessageType.Ping,
        payload: { id: 'ping-1', sentAt: 12345 },
        ts: now
      }), now);
      const pong = sender.lastSent();
      expect(pong.type).toBe(SignalingMessageType.Pong);
      expect(pong.payload).toEqual({ id: 'ping-1', sentAt: 12345, receivedAt: now });
    });

    it('handles missing payload gracefully', () => {
      const { session, sender } = connect('p1');
      server.handle(session, sender, JSON.stringify({
        type: SignalingMessageType.Ping,
        payload: null,
        ts: now
      }), now);
      const pong = sender.lastSent();
      expect(pong.type).toBe(SignalingMessageType.Pong);
      expect(pong.payload.id).toBe('');
    });
  });

  describe('peer-metrics', () => {
    it('stores latency and bandwidth on the room peer', () => {
      const { session: s1, sender: sn1 } = connect('p1');
      hello(s1, sn1, 'alice');
      join(s1, sn1, 'lounge');
      const before = server.handle(s1, sn1, JSON.stringify({
        type: SignalingMessageType.PeerMetrics,
        room: 'lounge',
        payload: { room: 'lounge', latencyMs: 42, bandwidthKbps: 5000 },
        ts: now
      }), now);
      expect(before.action).toBe('continue');
      // The metrics should be stored on the peer record. We can verify by
      // triggering a hub election: with metrics set, LowestLatency should
      // now yield p1 instead of deferring to FirstJoiner.
      const { session: s2, sender: sn2 } = connect('p2');
      hello(s2, sn2, 'bob');
      join(s2, sn2, 'lounge');
      // With 2 peers (≤ meshThreshold=3), mode is Mesh, no hub elected.
      // Add a 3rd peer to push to Star and trigger election.
      const { session: s3, sender: sn3 } = connect('p3');
      hello(s3, sn3, 'carol');
      join(s3, sn3, 'lounge');
      // Now 3 peers == meshThreshold, still mesh. Add a 4th to exceed.
      const { session: s4, sender: sn4 } = connect('p4');
      hello(s4, sn4, 'dave');
      join(s4, sn4, 'lounge');
      // p1 has latency 42; others have undefined latency. LowestLatency
      // should elect p1 as hub.
      const hubElected = sn4.publishedFor('lounge').find(e => e.type === SignalingMessageType.HubElected);
      expect(hubElected?.payload.hubPeerId).toBe('p1');
    });

    it('updates latency on subsequent reports', () => {
      const { session, sender } = connect('p1');
      hello(session, sender, 'alice');
      join(session, sender, 'lounge');
      server.handle(session, sender, JSON.stringify({
        type: SignalingMessageType.PeerMetrics,
        room: 'lounge',
        payload: { room: 'lounge', latencyMs: 100 },
        ts: now
      }), now);
      server.handle(session, sender, JSON.stringify({
        type: SignalingMessageType.PeerMetrics,
        room: 'lounge',
        payload: { room: 'lounge', latencyMs: 50 },
        ts: now
      }), now);
      // After update, p1 has latency 50. Add 3 more peers to trigger Star.
      for (const pid of ['p2', 'p3', 'p4']) {
        const { session: s, sender: sn } = connect(pid);
        hello(s, sn, `user-${pid}`);
        join(s, sn, 'lounge');
      }
      // Add a 5th peer; its join triggers HubElected broadcast to the room.
      const { session: s5, sender: sn5 } = connect('p5');
      hello(s5, sn5, 'eve');
      join(s5, sn5, 'lounge');
      const hubElected = sn5.publishedFor('lounge').find(e => e.type === SignalingMessageType.HubElected);
      expect(hubElected?.payload.hubPeerId).toBe('p1');
    });

    it('ignores metrics for a room the peer has not joined', () => {
      const { session, sender } = connect('p1');
      hello(session, sender, 'alice');
      // No join for 'lounge'. Send metrics for it.
      const result = server.handle(session, sender, JSON.stringify({
        type: SignalingMessageType.PeerMetrics,
        room: 'lounge',
        payload: { room: 'lounge', latencyMs: 42 },
        ts: now
      }), now);
      expect(result.action).toBe('continue');
      // No error sent (silent ignore) — only the Welcome from hello should be present.
      const errors = sender.sent.filter(s => (JSON.parse(s) as SignalingEnvelope).type === SignalingMessageType.Error);
      expect(errors.length).toBe(0);
    });

    it('ignores metrics for unknown room', () => {
      const { session, sender } = connect('p1');
      hello(session, sender, 'alice');
      join(session, sender, 'lounge');
      // Room 'ghost' does not exist; but the peer hasn't joined it either,
      // so the joinedRooms guard fires first. Either way, no crash.
      const result = server.handle(session, sender, JSON.stringify({
        type: SignalingMessageType.PeerMetrics,
        room: 'ghost',
        payload: { room: 'ghost', latencyMs: 42 },
        ts: now
      }), now);
      expect(result.action).toBe('continue');
    });
  });

  describe('presence', () => {
    it('broadcasts presence-online to existing peers on hello', () => {
      const a = connect('p1'); hello(a.session, a.sender, 'alice');
      a.sender.sent.length = 0;
      const b = connect('p2'); hello(b.session, b.sender, 'bob');
      // alice should receive a presence-online for bob.
      const presence = a.sender.sent
        .map(s => JSON.parse(s) as SignalingEnvelope)
        .find(e => e.type === SignalingMessageType.Presence);
      expect(presence?.payload).toMatchObject({ username: 'bob', status: PresenceStatus.Online });
    });

    it('does not send presence to the peer that just joined', () => {
      const a = connect('p1'); hello(a.session, a.sender, 'alice');
      a.sender.sent.length = 0;
      const b = connect('p2'); hello(b.session, b.sender, 'bob');
      // bob should not receive his own presence-online.
      const selfPresence = b.sender.sent
        .map(s => JSON.parse(s) as SignalingEnvelope)
        .filter(e => e.type === SignalingMessageType.Presence);
      expect(selfPresence).toHaveLength(0);
    });

    it('broadcasts presence-offline to remaining peers on disconnect', () => {
      const a = connect('p1'); hello(a.session, a.sender, 'alice');
      const b = connect('p2'); hello(b.session, b.sender, 'bob');
      a.sender.sent.length = 0;
      server.disconnect('p2', now);
      const presence = a.sender.sent
        .map(s => JSON.parse(s) as SignalingEnvelope)
        .find(e => e.type === SignalingMessageType.Presence);
      expect(presence?.payload).toMatchObject({ username: 'bob', status: PresenceStatus.Offline });
    });

    it('broadcasts presence-offline on reapStale for stale username', () => {
      const a = connect('p1'); hello(a.session, a.sender, 'alice');
      const b = connect('p2'); hello(b.session, b.sender, 'bob');
      a.sender.sent.length = 0;
      // Advance past the 45s stale window.
      server.reapStale(now + 46_000);
      // Both alice and bob are stale; bob's offline should be among them.
      const presenceMsgs = a.sender.sent
        .map(s => JSON.parse(s) as SignalingEnvelope)
        .filter(e => e.type === SignalingMessageType.Presence);
      expect(presenceMsgs.some(p => p.payload.username === 'bob' && p.payload.status === PresenceStatus.Offline)).toBe(true);
    });
  });
});
