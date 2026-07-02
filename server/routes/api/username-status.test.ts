import { describe, it, expect, beforeEach } from 'vitest';
import { SignalingServer } from '../../services/SignalingServer';
import type { PeerSender } from '../../services/SignalingServer';
import type { Tier } from '#shared/types/Tier';

class MockSender implements PeerSender {
  readonly peerId: string;
  sent: string[] = [];
  published: Array<{ topic: string; data: string }> = [];
  subscribed: string[] = [];
  unsubscribed: string[] = [];
  constructor (peerId: string) { this.peerId = peerId; }
  send (data: string): void { this.sent.push(data); }
  publish (topic: string, data: string): void { this.published.push({ topic, data }); }
  subscribe (topic: string): void { this.subscribed.push(topic); }
  unsubscribe (topic: string): void { this.unsubscribed.push(topic); }
  lastSent (): string | undefined { return this.sent[this.sent.length - 1]; }
}

describe('SignalingServer.checkUsernameAvailability', () => {
  let server: SignalingServer;
  const now = 1_000_000;

  beforeEach(() => {
    server = new SignalingServer();
  });

  it('returns available for a non-empty unclaimed username', () => {
    expect(server.checkUsernameAvailability('alice')).toEqual({ available: true });
  });

  it('returns invalid for an empty string', () => {
    expect(server.checkUsernameAvailability('')).toEqual({ available: false, reason: 'invalid' });
  });

  it('returns invalid for a whitespace-only string', () => {
    expect(server.checkUsernameAvailability('   ')).toEqual({ available: false, reason: 'invalid' });
  });

  it('returns invalid for undefined', () => {
    expect(server.checkUsernameAvailability(undefined)).toEqual({ available: false, reason: 'invalid' });
  });

  it('returns invalid for an array (multi-value query)', () => {
    expect(server.checkUsernameAvailability(['alice', 'bob'])).toEqual({ available: false, reason: 'invalid' });
  });

  it('returns invalid for null', () => {
    expect(server.checkUsernameAvailability(null)).toEqual({ available: false, reason: 'invalid' });
  });

  it('trims before checking emptiness', () => {
    expect(server.checkUsernameAvailability('  alice  ')).toEqual({ available: true });
  });

  it('returns in-use with holder tiers when the name is claimed by an active peer', () => {
    const sender = new MockSender('p1');
    const session = server.connect('p1', sender);
    const tiers: Tier[] = ['adult'];
    const handleResult = server.handle(
      session,
      sender,
      JSON.stringify({ type: 'hello', payload: { username: 'bob', tiers, publicKey: 'pk-bob' } }),
      now
    );
    expect(handleResult.action).toBe('continue');
    const result = server.checkUsernameAvailability('bob', now);
    expect(result.available).toBe(false);
    expect(result.reason).toBe('in-use');
    expect(result.tiers).toEqual(['adult']);
  });

  it('returns available when the holder has disconnected', () => {
    const sender = new MockSender('p1');
    const session = server.connect('p1', sender);
    server.handle(session, sender, JSON.stringify({ type: 'hello', payload: { username: 'bob', tiers: ['adult'] } }), now);
    server.disconnect('p1');
    expect(server.checkUsernameAvailability('bob', now)).toEqual({ available: true });
  });
});
