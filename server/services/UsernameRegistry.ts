import type { Tier } from '#shared/types/Tier';

/**
 * Record of a claimed username. Bound to a peerId (connection) and the
 * tiers the session attested at claim time.
 */
export interface ClaimedUsername {
  username: string;
  peerId: string;
  tiers: Tier[];
  /** ms since epoch of the most recent heartbeat. */
  lastHeartbeat: number;
}

/**
 * Result of a claim attempt.
 */
export type ClaimResult =
  | { ok: true; record: ClaimedUsername }
  | { ok: false; reason: 'in-use' | 'invalid' };

export interface AvailabilityResult {
  available: boolean;
  reason?: 'in-use' | 'invalid';
  /** Present when available is false due to in-use; the current holder. */
  holderPeerId?: string;
}

/**
 * Site-wide username registry (in-memory). A username is unique across the
 * entire service regardless of which room its owner occupies. Reclaim is
 * automatic when the owning connection releases or its heartbeat expires.
 *
 * Pure logic: no Nuxt/Nitro globals, no timers. The signaling server drives
 * heartbeat expiry by calling reapStale() on an interval.
 */
export class UsernameRegistry {
  private readonly byUsername = new Map<string, ClaimedUsername>();

  /** Upper bound on username length to prevent abuse. */
  private readonly maxLength: number;

  // eslint-disable-next-line no-control-regex
  private static readonly CONTROL_CHARS = /[\x00-\x1F]/;

  constructor (opts: { maxLength?: number } = {}) {
    this.maxLength = opts.maxLength ?? 32;
  }

  /**
   * Check whether a username string is well-formed (non-empty, trimmed,
   * within length, no control chars) and not currently claimed.
   */
  checkAvailability (username: string, now: number): AvailabilityResult {
    const trimmed = username.trim();
    if (trimmed === '' || trimmed.length > this.maxLength || UsernameRegistry.CONTROL_CHARS.test(trimmed)) {
      return { available: false, reason: 'invalid' };
    }
    const existing = this.byUsername.get(trimmed);
    if (existing && existing.lastHeartbeat > now - this.staleAfterMs) {
      return { available: false, reason: 'in-use', holderPeerId: existing.peerId };
    }
    return { available: true };
  }

  /**
   * Attempt to claim a username for a peer. Returns the record on success.
   * If the name is already held (and not stale), the claim is rejected.
   * Stale holders are silently evicted before the new claim is recorded.
   */
  claim (username: string, peerId: string, tiers: Tier[], now: number): ClaimResult {
    const trimmed = username.trim();
    if (trimmed === '' || trimmed.length > this.maxLength || UsernameRegistry.CONTROL_CHARS.test(trimmed)) {
      return { ok: false, reason: 'invalid' };
    }
    const existing = this.byUsername.get(trimmed);
    if (existing && existing.lastHeartbeat > now - this.staleAfterMs && existing.peerId !== peerId) {
      return { ok: false, reason: 'in-use' };
    }
    const record: ClaimedUsername = { username: trimmed, peerId, tiers, lastHeartbeat: now };
    this.byUsername.set(trimmed, record);
    return { ok: true, record };
  }

  /** Refresh the heartbeat timestamp for an existing claim. */
  heartbeat (username: string, now: number): boolean {
    const record = this.byUsername.get(username);
    if (!record) { return false; }
    record.lastHeartbeat = now;
    return true;
  }

  /** Release a claim. No-op if the username is not held by the given peer. */
  release (username: string, peerId: string): boolean {
    const record = this.byUsername.get(username);
    if (!record || record.peerId !== peerId) { return false; }
    this.byUsername.delete(username);
    return true;
  }

  /** Release all claims held by a peer (e.g. on disconnect). */
  releaseByPeer (peerId: string): string[] {
    const released: string[] = [];
    for (const [name, record] of this.byUsername) {
      if (record.peerId === peerId) {
        this.byUsername.delete(name);
        released.push(name);
      }
    }
    return released;
  }

  /** Snapshot of currently-claimed usernames. */
  onlineUsernames (): string[] {
    return Array.from(this.byUsername.keys());
  }

  /** Look up a claim by username. */
  get (username: string): ClaimedUsername | undefined {
    return this.byUsername.get(username);
  }

  /**
   * Evict claims whose last heartbeat is older than the stale window.
   * Returns the evicted usernames (with peerIds) so the server can
   * disconnect the peer and broadcast presence-offline.
   */
  reapStale (now: number): Array<{ username: string; peerId: string }> {
    const cutoff = now - this.staleAfterMs;
    const evicted: Array<{ username: string; peerId: string }> = [];
    for (const [name, record] of this.byUsername) {
      if (record.lastHeartbeat < cutoff) {
        this.byUsername.delete(name);
        evicted.push({ username: name, peerId: record.peerId });
      }
    }
    return evicted;
  }

  /** Stale window in ms. Default 45s (3 missed 15s heartbeats) per ADR 0002. */
  private readonly staleAfterMs: number = 45_000;
}
