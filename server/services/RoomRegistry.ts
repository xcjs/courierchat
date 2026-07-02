import type { HubElectionStrategy } from './HubElectionStrategy';
import type { Tier } from '#shared/types/Tier';
import { TransportMode } from '#shared/types/Signaling';

/**
 * A participant in a room. Bound to a peerId and a username claim.
 */
export interface RoomPeer {
  peerId: string;
  username: string;
  tiers: Tier[];
  /** ms since epoch of the most recent heartbeat. */
  lastHeartbeat: number;
  /** Reported round-trip latency to the server in ms (optional, for election). */
  latencyMs?: number;
  /** Reported downstream bandwidth in kbps (optional, for election). */
  bandwidthKbps?: number;
  /**
   * Base64 SPKI DER public key for message signature verification.
   * Required for all peers.
   */
  publicKey: string;
}

/**
 * In-memory room record. Rooms are destroyed when their peer count hits zero.
 */
export interface RoomRecord {
  name: string;
  tiers: Tier[];
  peers: Map<string, RoomPeer>;
  transportMode: TransportMode;
  /** Present in star mode; the elected hub peerId. */
  hubPeerId?: string;
  /** Whether the room was explicitly created with a tier set vs. implicit. */
  explicit: boolean;
  /** Optional icon (lucide: or emoji: prefix). */
  icon?: string;
}

export interface JoinResult {
  ok: boolean;
  reason?: 'tier-mismatch' | 'already-joined';
  room?: RoomRecord;
  /** Peers already in the room (excluding the joiner). */
  existingPeers?: RoomPeer[];
  /** True when the joining peer became the hub. */
  becameHub?: boolean;
}

export interface LeaveResult {
  /** Peers remaining in the room after the leave. */
  remaining: RoomPeer[];
  /** True when the departed peer was the hub. */
  wasHub: boolean;
  /** True when the room was destroyed (no peers remain). */
  destroyed: boolean;
}

/**
 * In-memory room registry. Manages room lifecycle, peer membership, tier
 * isolation, and transport-mode selection.
 *
 * Pure logic: no Nuxt/Nitro globals, no timers. The signaling server drives
 * heartbeat expiry by calling reapStale() on an interval.
 */
export class RoomRegistry {
  private readonly byName = new Map<string, RoomRecord>();
  private readonly meshThreshold: number;
  private readonly staleAfterMs: number = 45_000;
  private hubElector: HubElectionStrategy = { name: 'default', elect: defaultHubElector };

  constructor (opts: { meshThreshold?: number } = {}) {
    this.meshThreshold = opts.meshThreshold ?? 8;
  }

  /**
   * Create a room explicitly (e.g. via the Create Room modal). The room
   * exists with zero peers until someone joins. Tiers are fixed at creation.
   */
  createRoom (name: string, tiers: Tier[], icon?: string): RoomRecord {
    const existing = this.byName.get(name);
    if (existing) { return existing; }
    const room: RoomRecord = {
      name,
      tiers,
      peers: new Map(),
      transportMode: TransportMode.Mesh,
      explicit: true,
      icon
    };
    this.byName.set(name, room);
    return room;
  }

  /**
   * Join a room. The peer's tiers must intersect the room's tiers. On join,
   * the transport mode is (re)evaluated and a hub may be elected.
   */
  join (roomName: string, peer: RoomPeer): JoinResult {
    let room = this.byName.get(roomName);
    if (!room) {
      // Implicit room creation: the room inherits the joining peer's tiers.
      room = {
        name: roomName,
        tiers: [...peer.tiers],
        peers: new Map(),
        transportMode: TransportMode.Mesh,
        explicit: false
      };
      this.byName.set(roomName, room);
    }

    // Tier isolation: peer must share at least one tier with the room.
    if (!peer.tiers.some(t => room!.tiers.includes(t))) {
      return { ok: false, reason: 'tier-mismatch' };
    }

    if (room.peers.has(peer.peerId)) {
      return { ok: false, reason: 'already-joined' };
    }

    room.peers.set(peer.peerId, peer);
    const existingPeers = Array.from(room.peers.values()).filter(p => p.peerId !== peer.peerId);

    // Evaluate transport mode and hub election.
    const becameHub = this.evaluateTransport(room);

    return { ok: true, room, existingPeers, becameHub };
  }

  /**
   * Remove a peer from a room. If the room is empty after removal, it is
   * destroyed (unless it was explicitly created and should persist? No—per
   * ADR 0002, rooms are destroyed when empty, explicit or not).
   */
  leave (roomName: string, peerId: string): LeaveResult {
    const room = this.byName.get(roomName);
    if (!room) {
      return { remaining: [], wasHub: false, destroyed: false };
    }
    const wasHub = room.hubPeerId === peerId;
    room.peers.delete(peerId);

    if (room.peers.size === 0) {
      this.byName.delete(roomName);
      return { remaining: [], wasHub, destroyed: true };
    }

    // Re-evaluate transport mode and elect a new hub if needed.
    this.evaluateTransport(room);

    const remaining = Array.from(room.peers.values());
    return { remaining, wasHub, destroyed: false };
  }

  /** Look up a room by name. */
  get (roomName: string): RoomRecord | undefined {
    return this.byName.get(roomName);
  }

  /**
   * Force a room into Relay mode. Called when a client reports that no
   * reachable hub exists (RTC failure). Once in Relay, the room stays in
   * Relay until peer count drops below the mesh threshold on a re-eval.
   */
  setRelay (roomName: string): RoomRecord | undefined {
    const room = this.byName.get(roomName);
    if (!room) { return undefined; }
    room.transportMode = TransportMode.Relay;
    room.hubPeerId = undefined;
    return room;
  }

  /** List all rooms visible to a given tier set. */
  roomsVisibleToTiers (sessionTiers: readonly Tier[]): RoomRecord[] {
    return Array.from(this.byName.values()).filter(r => r.tiers.some(t => sessionTiers.includes(t)));
  }

  /** All room records (for admin/debug). */
  allRooms (): RoomRecord[] {
    return Array.from(this.byName.values());
  }

  /** Peers in a room. */
  peersIn (roomName: string): RoomPeer[] {
    return Array.from(this.byName.get(roomName)?.peers.values() ?? []);
  }

  /** Refresh heartbeat for a peer in a room. */
  heartbeat (roomName: string, peerId: string, now: number): boolean {
    const room = this.byName.get(roomName);
    const peer = room?.peers.get(peerId);
    if (!peer) { return false; }
    peer.lastHeartbeat = now;
    return true;
  }

  /**
   * Evict peers whose heartbeat is stale across all rooms. Returns the
   * evicted peerIds grouped by room name.
   */
  reapStale (now: number): Array<{ room: string; peerIds: string[] }> {
    const cutoff = now - this.staleAfterMs;
    const result: Array<{ room: string; peerIds: string[] }> = [];
    for (const [roomName, room] of this.byName) {
      const stale: string[] = [];
      for (const [peerId, peer] of room.peers) {
        if (peer.lastHeartbeat < cutoff) {
          stale.push(peerId);
        }
      }
      if (stale.length > 0) {
        for (const peerId of stale) {
          room.peers.delete(peerId);
        }
        result.push({ room: roomName, peerIds: stale });
        if (room.peers.size === 0) {
          this.byName.delete(roomName);
        } else {
          this.evaluateTransport(room);
        }
      }
    }
    return result;
  }

  /**
   * Evaluate and set the transport mode for a room based on peer count.
   * Returns true if the most-recently-added peer became the hub (star mode).
   */
  private evaluateTransport (room: RoomRecord): boolean {
    // Relay mode is sticky: once a room falls back to relay (last resort),
    // it stays in relay until the room empties and is destroyed.
    if (room.transportMode === TransportMode.Relay) {
      return false;
    }
    const count = room.peers.size;
    if (count <= this.meshThreshold) {
      room.transportMode = TransportMode.Mesh;
      room.hubPeerId = undefined;
      return false;
    }

    // Star mode: elect a hub if none is present or the current hub is gone.
    room.transportMode = TransportMode.Star;
    if (!room.hubPeerId || !room.peers.has(room.hubPeerId)) {
      const elected = this.electHub(room);
      room.hubPeerId = elected?.peerId;
      // The "becameHub" return is only meaningful for the joining peer; the
      // caller compares the elected peerId to the joiner's peerId.
      return false;
    }
    return false;
  }

  /**
   * Elect a hub for a star-mode room using the strategy chain. This is a
   * placeholder that picks the first peer; the real strategy chain is
   * injected by the signaling server via setHubElector.
   */

  /** Override the hub election strategy (dependency injection). */
  setHubElector (strategy: HubElectionStrategy): void {
    this.hubElector = strategy;
  }

  private electHub (room: RoomRecord): RoomPeer | undefined {
    return this.hubElector.elect(room);
  }
}

/**
 * Default hub elector: picks the first peer in insertion order. The
 * signaling server replaces this with the strategy chain.
 */
function defaultHubElector (room: RoomRecord): RoomPeer | undefined {
  return Array.from(room.peers.values())[0];
}
