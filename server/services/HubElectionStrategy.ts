import type { RoomPeer, RoomRecord } from './RoomRegistry';

/**
 * A single hub-election strategy. Returns the chosen peer or undefined to
 * defer to the next strategy in the chain.
 */
export interface HubElectionStrategy {
  readonly name: string;
  elect (room: RoomRecord): RoomPeer | undefined;
}

/**
 * Strategy A (always available): the first peer to join the room.
 * No peer self-report required.
 */
export class FirstJoinerStrategy implements HubElectionStrategy {
  readonly name = 'first-joiner';

  elect (room: RoomRecord): RoomPeer | undefined {
    return Array.from(room.peers.values())[0];
  }
}

/**
 * Strategy B: the peer with the lowest reported latency to the server.
 * Only selects among peers that have reported a latency value. Defers if
 * no peer has reported latency or all report identical values (in which
 * case any of them is as good as the first-joiner, so we defer to let the
 * chain fall through).
 */
export class LowestLatencyStrategy implements HubElectionStrategy {
  readonly name = 'lowest-latency';

  elect (room: RoomRecord): RoomPeer | undefined {
    const candidates = Array.from(room.peers.values()).filter(p => p.latencyMs !== undefined);
    if (candidates.length === 0) { return undefined; }
    let best = candidates[0];
    let tie = false;
    for (let i = 1; i < candidates.length; i++) {
      const p = candidates[i];
      if (p.latencyMs! < best.latencyMs!) {
        best = p;
        tie = false;
      } else if (p.latencyMs === best.latencyMs) {
        tie = true;
      }
    }
    // If every candidate has identical latency, defer to the next strategy.
    if (tie && candidates.every(p => p.latencyMs === best.latencyMs)) {
      return undefined;
    }
    return best;
  }
}

/**
 * Strategy C: the peer with the highest reported downstream bandwidth.
 * Only selects among peers that have reported a bandwidth value. Used when
 * latency cannot differentiate candidates.
 */
export class HighestBandwidthStrategy implements HubElectionStrategy {
  readonly name = 'highest-bandwidth';

  elect (room: RoomRecord): RoomPeer | undefined {
    const candidates = Array.from(room.peers.values()).filter(p => p.bandwidthKbps !== undefined);
    if (candidates.length === 0) { return undefined; }
    let best = candidates[0];
    for (let i = 1; i < candidates.length; i++) {
      const p = candidates[i];
      if (p.bandwidthKbps! > best.bandwidthKbps!) {
        best = p;
      }
    }
    return best;
  }
}

/**
 * Chain of hub-election strategies. Tries each in order; the first to
 * return a peer wins. If all defer, the first-joiner strategy is the
 * guaranteed fallback (it always returns a peer if the room has any).
 */
export class HubElectionChain implements HubElectionStrategy {
  readonly name = 'chain';
  private readonly strategies: readonly HubElectionStrategy[];

  constructor (strategies: readonly HubElectionStrategy[]) {
    this.strategies = strategies;
  }

  elect (room: RoomRecord): RoomPeer | undefined {
    for (const strategy of this.strategies) {
      const peer = strategy.elect(room);
      if (peer) { return peer; }
    }
    return undefined;
  }
}

/**
 * Default chain order per ADR 0002 resolved decision #2:
 *   first-joiner -> lowest-latency -> highest-bandwidth
 *
 * The first-joiner strategy is NOT in the chain (it is the fallback). The
 * chain is lowest-latency -> highest-bandwidth; if both defer, the
 * FirstJoinerStrategy is used as a guaranteed fallback.
 */
export function createDefaultHubElectionChain (): HubElectionChain {
  return new HubElectionChain([
    new LowestLatencyStrategy(),
    new HighestBandwidthStrategy(),
    new FirstJoinerStrategy()
  ]);
}
