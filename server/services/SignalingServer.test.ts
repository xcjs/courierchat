import { describe, it, expect, beforeEach } from 'vitest';
import { SignalingServer, type PeerSender, type SignalingSession } from './SignalingServer';
import type { SignalingEnvelope } from '#shared/types/Signaling';

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
    const session = server.connect(peerId);
    const sender = new MockSender(peerId);
    return { session, sender };
  }

  function hello (session: SignalingSession, sender: MockSender, username: string, tiers: ('minor' | 'adult')[] = ['adult']): void {
    server.handle(session, sender, JSON.stringify({
      type: 'hello', payload: { username, tiers }, ts: now
    }), now);
  }

  function join (session: SignalingSession, sender: MockSender, room: string): void {
    server.handle(session, sender, JSON.stringify({
      type: 'join', room, payload: { room }, ts: now
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
      expect(welcome.type).toBe('welcome');
      expect(welcome.payload).toMatchObject({ peerId: 'p1', onlineUsernames: ['alice'] });
      expect(session.username).toBe('alice');
      expect(session.isAuthenticated).toBe(true);
    });

    it('rejects a duplicate username with username-in-use', () => {
      const a = connect('p1'); hello(a.session, a.sender, 'alice');
      const b = connect('p2'); hello(b.session, b.sender, 'alice');
      const err = b.sender.lastSent();
      expect(err.type).toBe('error');
      expect(err.payload).toMatchObject({ code: 'username-in-use' });
      expect(b.session.username).toBeNull();
    });

    it('rejects an invalid username', () => {
      const { session, sender } = connect('p1');
      server.handle(session, sender, JSON.stringify({
        type: 'hello', payload: { username: '', tiers: ['adult'] }, ts: now
      }), now);
      const err = sender.lastSent();
      expect(err.type).toBe('error');
      expect(err.payload).toMatchObject({ code: 'username-invalid' });
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
      expect(types).toContain('transport-mode');
      expect(types).toContain('peer-joined');
    });

    it('publishes peer-joined to the room topic', () => {
      const a = connect('p1'); hello(a.session, a.sender, 'alice');
      const b = connect('p2'); hello(b.session, b.sender, 'bob');
      join(a.session, a.sender, 'lounge');
      join(b.session, b.sender, 'lounge');
      const published = a.sender.publishedFor('lounge');
      expect(published.some(p => p.type === 'peer-joined')).toBe(true);
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
      expect(err.payload).toMatchObject({ code: 'not-joined' });
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
      expect(err.payload).toMatchObject({ code: 'tier-mismatch' });
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
      expect(published.some(p => p.type === 'hub-elected')).toBe(true);
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
      expect(published.some(p => p.type === 'peer-left')).toBe(true);
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
      expect(published.some(p => p.type === 'room-destroyed')).toBe(true);
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
    it('relays an offer to the target peer via peer topic', () => {
      const a = connect('p1'); hello(a.session, a.sender, 'alice');
      const b = connect('p2'); hello(b.session, b.sender, 'bob');
      server.handle(a.session, a.sender, JSON.stringify({
        type: 'offer', to: 'p2', payload: { sdp: 'sdp-data', label: 'chat' }, ts: now
      }), now);
      const published = a.sender.published.filter(p => p.topic === 'peer:p2');
      expect(published).toHaveLength(1);
      const relayed = JSON.parse(published[0].data) as SignalingEnvelope;
      expect(relayed.type).toBe('offer-relayed');
      expect(relayed.to).toBe('p2');
      expect(relayed.from).toBe('p1');
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
        type: 'chat-message', room: 'lounge', payload: { id: '1', author: 'alice', content: 'hi', timestamp: now }, ts: now
      }), now);
      expect(a.sender.publishedFor('lounge').filter(p => p.type === 'relay-broadcast')).toHaveLength(0);
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
});
