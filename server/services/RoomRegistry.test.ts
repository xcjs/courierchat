import { describe, it, expect, beforeEach } from 'vitest';
import { RoomRegistry, type RoomPeer } from './RoomRegistry';
import { createDefaultHubElectionChain } from './HubElectionStrategy';

function makePeer (peerId: string, username: string, tiers: ('minor' | 'adult')[] = ['adult'], now = 1_000_000): RoomPeer {
  return { peerId, username, tiers, lastHeartbeat: now };
}

describe('RoomRegistry', () => {
  let registry: RoomRegistry;
  const now = 1_000_000;

  beforeEach(() => {
    registry = new RoomRegistry({ meshThreshold: 3 });
    registry.setHubElector(createDefaultHubElectionChain());
  });

  describe('createRoom', () => {
    it('creates a room with the given tiers and icon', () => {
      const room = registry.createRoom('lounge', ['adult', 'minor'], 'lucide:users');
      expect(room.name).toBe('lounge');
      expect(room.tiers).toEqual(['adult', 'minor']);
      expect(room.icon).toBe('lucide:users');
      expect(room.explicit).toBe(true);
      expect(room.peers.size).toBe(0);
    });

    it('returns the existing room if already created', () => {
      const r1 = registry.createRoom('lounge', ['adult']);
      const r2 = registry.createRoom('lounge', ['minor']);
      expect(r1).toBe(r2);
      expect(r2.tiers).toEqual(['adult']);
    });
  });

  describe('join', () => {
    it('adds a peer to an existing room', () => {
      registry.createRoom('lounge', ['adult']);
      const result = registry.join('lounge', makePeer('p1', 'alice'));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.room?.peers.size).toBe(1);
        expect(result.existingPeers).toEqual([]);
      }
    });

    it('implicitly creates a room inheriting the joiner tiers', () => {
      const result = registry.join('newroom', makePeer('p1', 'alice', ['minor']));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.room?.tiers).toEqual(['minor']);
        expect(result.room?.explicit).toBe(false);
      }
    });

    it('lists existing peers on join', () => {
      registry.join('lounge', makePeer('p1', 'alice'));
      registry.join('lounge', makePeer('p2', 'bob'));
      const result = registry.join('lounge', makePeer('p3', 'carol'));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.existingPeers?.map(p => p.username).sort()).toEqual(['alice', 'bob']);
      }
    });

    it('rejects a peer whose tiers do not intersect the room tiers', () => {
      registry.createRoom('adults-only', ['adult']);
      const result = registry.join('adults-only', makePeer('p1', 'alice', ['minor']));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('tier-mismatch');
      }
    });

    it('rejects a peer who already joined the room', () => {
      registry.join('lounge', makePeer('p1', 'alice'));
      const result = registry.join('lounge', makePeer('p1', 'alice'));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('already-joined');
      }
    });

    it('sets transport mode to mesh for small rooms', () => {
      registry.join('lounge', makePeer('p1', 'alice'));
      const room = registry.get('lounge');
      expect(room?.transportMode).toBe('mesh');
      expect(room?.hubPeerId).toBeUndefined();
    });

    it('switches to star mode and elects a hub above mesh threshold', () => {
      // meshThreshold is 3 in this test fixture
      registry.join('lounge', makePeer('p1', 'alice'));
      registry.join('lounge', makePeer('p2', 'bob'));
      registry.join('lounge', makePeer('p3', 'carol'));
      expect(registry.get('lounge')?.transportMode).toBe('mesh');
      registry.join('lounge', makePeer('p4', 'dave'));
      const room = registry.get('lounge');
      expect(room?.transportMode).toBe('star');
      expect(room?.hubPeerId).toBeDefined();
    });
  });

  describe('leave', () => {
    it('removes a peer from a room', () => {
      registry.join('lounge', makePeer('p1', 'alice'));
      registry.join('lounge', makePeer('p2', 'bob'));
      const result = registry.leave('lounge', 'p1');
      expect(result.remaining.map(p => p.peerId)).toEqual(['p2']);
      expect(result.destroyed).toBe(false);
    });

    it('destroys the room when the last peer leaves', () => {
      registry.join('lounge', makePeer('p1', 'alice'));
      const result = registry.leave('lounge', 'p1');
      expect(result.destroyed).toBe(true);
      expect(result.remaining).toEqual([]);
      expect(registry.get('lounge')).toBeUndefined();
    });

    it('reports wasHub when the departed peer was the hub', () => {
      registry.join('lounge', makePeer('p1', 'alice'));
      registry.join('lounge', makePeer('p2', 'bob'));
      registry.join('lounge', makePeer('p3', 'carol'));
      registry.join('lounge', makePeer('p4', 'dave'));
      const room = registry.get('lounge');
      const hubId = room?.hubPeerId;
      if (hubId) {
        const result = registry.leave('lounge', hubId);
        expect(result.wasHub).toBe(true);
      }
    });

    it('elects a new hub after the old hub leaves in star mode', () => {
      // meshThreshold is 3; need >3 remaining after hub leaves, so join 5 peers
      registry.join('lounge', makePeer('p1', 'alice'));
      registry.join('lounge', makePeer('p2', 'bob'));
      registry.join('lounge', makePeer('p3', 'carol'));
      registry.join('lounge', makePeer('p4', 'dave'));
      registry.join('lounge', makePeer('p5', 'eve'));
      const hubId = registry.get('lounge')?.hubPeerId;
      expect(hubId).toBeDefined();
      registry.leave('lounge', hubId!);
      const room = registry.get('lounge');
      expect(room?.hubPeerId).toBeDefined();
      expect(room?.hubPeerId).not.toBe(hubId);
    });

    it('returns a no-op result for an unknown room', () => {
      const result = registry.leave('nope', 'p1');
      expect(result.destroyed).toBe(false);
      expect(result.wasHub).toBe(false);
      expect(result.remaining).toEqual([]);
    });
  });

  describe('roomsVisibleToTiers', () => {
    it('lists rooms whose tiers intersect the session tiers', () => {
      registry.createRoom('adults', ['adult']);
      registry.createRoom('kids', ['minor']);
      registry.createRoom('mixed', ['adult', 'minor']);
      const visible = registry.roomsVisibleToTiers(['minor']);
      expect(visible.map(r => r.name).sort()).toEqual(['kids', 'mixed']);
    });
  });

  describe('heartbeat', () => {
    it('refreshes the peer heartbeat', () => {
      registry.join('lounge', makePeer('p1', 'alice', ['adult'], now));
      expect(registry.heartbeat('lounge', 'p1', now + 10_000)).toBe(true);
      const peer = registry.peersIn('lounge')[0];
      expect(peer.lastHeartbeat).toBe(now + 10_000);
    });

    it('returns false for an unknown peer', () => {
      expect(registry.heartbeat('lounge', 'nobody', now)).toBe(false);
    });
  });

  describe('reapStale', () => {
    it('evicts stale peers and returns them grouped by room', () => {
      registry.join('lounge', makePeer('p1', 'alice', ['adult'], now));
      registry.join('lounge', makePeer('p2', 'bob', ['adult'], now + 10_000));
      const result = registry.reapStale(now + 46_000);
      expect(result).toEqual([{ room: 'lounge', peerIds: ['p1'] }]);
      expect(registry.peersIn('lounge').map(p => p.peerId)).toEqual(['p2']);
    });

    it('destroys a room when all peers are stale', () => {
      registry.join('lounge', makePeer('p1', 'alice', ['adult'], now));
      registry.reapStale(now + 46_000);
      expect(registry.get('lounge')).toBeUndefined();
    });

    it('returns an empty array when nothing is stale', () => {
      registry.join('lounge', makePeer('p1', 'alice', ['adult'], now));
      expect(registry.reapStale(now + 1_000)).toEqual([]);
    });
  });
});
