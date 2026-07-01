import { describe, it, expect } from 'vitest';
import {
  FirstJoinerStrategy,
  LowestLatencyStrategy,
  HighestBandwidthStrategy,
  HubElectionChain,
  createDefaultHubElectionChain
} from './HubElectionStrategy';
import type { RoomPeer, RoomRecord } from './RoomRegistry';

function makePeer (peerId: string, opts: { latencyMs?: number; bandwidthKbps?: number } = {}): RoomPeer {
  return {
    peerId,
    username: `user-${peerId}`,
    tiers: ['adult'],
    lastHeartbeat: 1_000_000,
    latencyMs: opts.latencyMs,
    bandwidthKbps: opts.bandwidthKbps
  };
}

function makeRoom (peers: RoomPeer[]): RoomRecord {
  const map = new Map<string, RoomPeer>();
  for (const p of peers) { map.set(p.peerId, p); }
  return {
    name: 'test-room',
    tiers: ['adult'],
    peers: map,
    transportMode: 'star',
    explicit: false
  };
}

describe('FirstJoinerStrategy', () => {
  const strategy = new FirstJoinerStrategy();

  it('returns the first peer in insertion order', () => {
    const room = makeRoom([makePeer('p1'), makePeer('p2'), makePeer('p3')]);
    expect(strategy.elect(room)?.peerId).toBe('p1');
  });

  it('returns undefined for an empty room', () => {
    const room = makeRoom([]);
    expect(strategy.elect(room)).toBeUndefined();
  });
});

describe('LowestLatencyStrategy', () => {
  const strategy = new LowestLatencyStrategy();

  it('selects the peer with the lowest reported latency', () => {
    const room = makeRoom([
      makePeer('p1', { latencyMs: 100 }),
      makePeer('p2', { latencyMs: 30 }),
      makePeer('p3', { latencyMs: 80 })
    ]);
    expect(strategy.elect(room)?.peerId).toBe('p2');
  });

  it('defers when no peer has reported latency', () => {
    const room = makeRoom([makePeer('p1'), makePeer('p2')]);
    expect(strategy.elect(room)).toBeUndefined();
  });

  it('defers when all peers report identical latency', () => {
    const room = makeRoom([
      makePeer('p1', { latencyMs: 50 }),
      makePeer('p2', { latencyMs: 50 })
    ]);
    expect(strategy.elect(room)).toBeUndefined();
  });

  it('selects among peers that reported latency, ignoring those without', () => {
    const room = makeRoom([
      makePeer('p1'),
      makePeer('p2', { latencyMs: 200 }),
      makePeer('p3', { latencyMs: 100 })
    ]);
    expect(strategy.elect(room)?.peerId).toBe('p3');
  });
});

describe('HighestBandwidthStrategy', () => {
  const strategy = new HighestBandwidthStrategy();

  it('selects the peer with the highest reported bandwidth', () => {
    const room = makeRoom([
      makePeer('p1', { bandwidthKbps: 1000 }),
      makePeer('p2', { bandwidthKbps: 5000 }),
      makePeer('p3', { bandwidthKbps: 3000 })
    ]);
    expect(strategy.elect(room)?.peerId).toBe('p2');
  });

  it('defers when no peer has reported bandwidth', () => {
    const room = makeRoom([makePeer('p1'), makePeer('p2')]);
    expect(strategy.elect(room)).toBeUndefined();
  });

  it('selects among peers that reported bandwidth, ignoring those without', () => {
    const room = makeRoom([
      makePeer('p1'),
      makePeer('p2', { bandwidthKbps: 2000 }),
      makePeer('p3', { bandwidthKbps: 5000 })
    ]);
    expect(strategy.elect(room)?.peerId).toBe('p3');
  });
});

describe('HubElectionChain', () => {
  it('returns the first strategy result that yields a peer', () => {
    const chain = new HubElectionChain([
      new LowestLatencyStrategy(),
      new HighestBandwidthStrategy(),
      new FirstJoinerStrategy()
    ]);
    const room = makeRoom([
      makePeer('p1', { latencyMs: 100 }),
      makePeer('p2', { latencyMs: 30 })
    ]);
    expect(chain.elect(room)?.peerId).toBe('p2');
  });

  it('falls through to the next strategy when the first defers', () => {
    const chain = new HubElectionChain([
      new LowestLatencyStrategy(),
      new HighestBandwidthStrategy(),
      new FirstJoinerStrategy()
    ]);
    const room = makeRoom([
      makePeer('p1', { bandwidthKbps: 1000 }),
      makePeer('p2', { bandwidthKbps: 5000 })
    ]);
    // LowestLatency defers (no latency reported), HighestBandwidth picks p2
    expect(chain.elect(room)?.peerId).toBe('p2');
  });

  it('falls through to first-joiner when all other strategies defer', () => {
    const chain = new HubElectionChain([
      new LowestLatencyStrategy(),
      new HighestBandwidthStrategy(),
      new FirstJoinerStrategy()
    ]);
    const room = makeRoom([makePeer('p1'), makePeer('p2')]);
    expect(chain.elect(room)?.peerId).toBe('p1');
  });

  it('returns undefined for an empty room', () => {
    const chain = new HubElectionChain([
      new LowestLatencyStrategy(),
      new FirstJoinerStrategy()
    ]);
    expect(chain.elect(makeRoom([]))).toBeUndefined();
  });
});

describe('createDefaultHubElectionChain', () => {
  it('returns a chain with the expected order', () => {
    const chain = createDefaultHubElectionChain();
    expect(chain.name).toBe('chain');
    // LowestLatency first, HighestBandwidth second, FirstJoiner fallback
    const room = makeRoom([
      makePeer('p1', { latencyMs: 50, bandwidthKbps: 5000 }),
      makePeer('p2', { latencyMs: 30, bandwidthKbps: 1000 })
    ]);
    expect(chain.elect(room)?.peerId).toBe('p2');
  });

  it('falls back to first-joiner when no metrics are reported', () => {
    const chain = createDefaultHubElectionChain();
    const room = makeRoom([makePeer('p1'), makePeer('p2')]);
    expect(chain.elect(room)?.peerId).toBe('p1');
  });
});
