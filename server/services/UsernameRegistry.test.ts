import { describe, it, expect, beforeEach } from 'vitest';
import { UsernameRegistry } from './UsernameRegistry';

describe('UsernameRegistry', () => {
  let registry: UsernameRegistry;
  const now = 1_000_000;

  beforeEach(() => {
    registry = new UsernameRegistry();
  });

  describe('checkAvailability', () => {
    it('returns available for a well-formed unclaimed name', () => {
      expect(registry.checkAvailability('alice', now)).toEqual({ available: true });
    });

    it('returns invalid for empty string', () => {
      expect(registry.checkAvailability('', now)).toEqual({ available: false, reason: 'invalid' });
    });

    it('returns invalid for whitespace-only string', () => {
      expect(registry.checkAvailability('   ', now)).toEqual({ available: false, reason: 'invalid' });
    });

    it('returns invalid for names exceeding max length', () => {
      const long = 'a'.repeat(33);
      expect(registry.checkAvailability(long, now)).toEqual({ available: false, reason: 'invalid' });
    });

    it('returns invalid for names with control characters', () => {
      expect(registry.checkAvailability('al\x00ice', now)).toEqual({ available: false, reason: 'invalid' });
    });

    it('returns in-use with holder when claimed by another peer', () => {
      registry.claim('bob', 'peer-1', ['adult'], now);
      const result = registry.checkAvailability('bob', now);
      expect(result.available).toBe(false);
      expect(result.reason).toBe('in-use');
      expect(result.holderPeerId).toBe('peer-1');
    });

    it('returns available when the existing claim is stale', () => {
      registry.claim('bob', 'peer-1', ['adult'], now);
      // 46s later - past the 45s stale window
      expect(registry.checkAvailability('bob', now + 46_000)).toEqual({ available: true });
    });
  });

  describe('claim', () => {
    it('claims a well-formed name and returns the record', () => {
      const result = registry.claim('alice', 'peer-1', ['adult'], now);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.record.username).toBe('alice');
        expect(result.record.peerId).toBe('peer-1');
        expect(result.record.tiers).toEqual(['adult']);
        expect(result.record.lastHeartbeat).toBe(now);
      }
    });

    it('trims the username before storing', () => {
      const result = registry.claim('  alice  ', 'peer-1', ['adult'], now);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.record.username).toBe('alice');
      }
    });

    it('rejects an already-claimed name', () => {
      registry.claim('alice', 'peer-1', ['adult'], now);
      const result = registry.claim('alice', 'peer-2', ['adult'], now);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('in-use');
      }
    });

    it('silently evicts a stale holder and lets a new peer claim', () => {
      registry.claim('alice', 'peer-1', ['adult'], now);
      const result = registry.claim('alice', 'peer-2', ['adult'], now + 46_000);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.record.peerId).toBe('peer-2');
      }
    });

    it('allows the same peer to re-claim their own name (idempotent)', () => {
      registry.claim('alice', 'peer-1', ['adult'], now);
      const result = registry.claim('alice', 'peer-1', ['adult'], now + 1_000);
      expect(result.ok).toBe(true);
    });

    it('rejects invalid names', () => {
      const result = registry.claim('', 'peer-1', ['adult'], now);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('invalid');
      }
    });
  });

  describe('heartbeat', () => {
    it('refreshes the lastHeartbeat timestamp', () => {
      registry.claim('alice', 'peer-1', ['adult'], now);
      expect(registry.heartbeat('alice', now + 10_000)).toBe(true);
      const record = registry.get('alice');
      expect(record?.lastHeartbeat).toBe(now + 10_000);
    });

    it('returns false for an unknown username', () => {
      expect(registry.heartbeat('nobody', now)).toBe(false);
    });
  });

  describe('release', () => {
    it('releases a claim held by the given peer', () => {
      registry.claim('alice', 'peer-1', ['adult'], now);
      expect(registry.release('alice', 'peer-1')).toBe(true);
      expect(registry.get('alice')).toBeUndefined();
    });

    it('does not release a claim held by a different peer', () => {
      registry.claim('alice', 'peer-1', ['adult'], now);
      expect(registry.release('alice', 'peer-2')).toBe(false);
      expect(registry.get('alice')).toBeDefined();
    });

    it('returns false for an unknown username', () => {
      expect(registry.release('nobody', 'peer-1')).toBe(false);
    });
  });

  describe('releaseByPeer', () => {
    it('releases all claims held by a peer', () => {
      registry.claim('alice', 'peer-1', ['adult'], now);
      registry.claim('bob', 'peer-1', ['adult'], now);
      registry.claim('carol', 'peer-2', ['adult'], now);
      const released = registry.releaseByPeer('peer-1');
      expect(released.sort()).toEqual(['alice', 'bob']);
      expect(registry.get('carol')).toBeDefined();
    });

    it('returns an empty array for a peer with no claims', () => {
      expect(registry.releaseByPeer('nobody')).toEqual([]);
    });
  });

  describe('reapStale', () => {
    it('evicts claims older than the stale window', () => {
      registry.claim('alice', 'peer-1', ['adult'], now);
      registry.claim('bob', 'peer-2', ['adult'], now + 10_000);
      const evicted = registry.reapStale(now + 46_000);
      expect(evicted).toEqual(['alice']);
      expect(registry.get('alice')).toBeUndefined();
      expect(registry.get('bob')).toBeDefined();
    });

    it('returns an empty array when nothing is stale', () => {
      registry.claim('alice', 'peer-1', ['adult'], now);
      expect(registry.reapStale(now + 1_000)).toEqual([]);
    });
  });

  describe('onlineUsernames', () => {
    it('returns a snapshot of all currently-claimed usernames', () => {
      registry.claim('alice', 'peer-1', ['adult'], now);
      registry.claim('bob', 'peer-2', ['adult'], now);
      expect(registry.onlineUsernames().sort()).toEqual(['alice', 'bob']);
    });

    it('returns an empty array when nothing is claimed', () => {
      expect(registry.onlineUsernames()).toEqual([]);
    });
  });
});
