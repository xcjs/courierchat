import type { Peer, Message } from 'crossws';
import { SignalingServer, type PeerSender } from '#server/services/SignalingServer';

/**
 * Singleton SignalingServer instance. Nitro may hot-reload modules in dev,
 * so we stash on globalThis to preserve state across reloads.
 */
const globalForSignaling = globalThis as unknown as { __signalingServer?: SignalingServer };
const server = globalForSignaling.__signalingServer ?? new SignalingServer();
if (!globalForSignaling.__signalingServer) {
  globalForSignaling.__signalingServer = server;
}

/**
 * Heartbeat reaper interval. Runs every 15s; evicts peers whose last
 * heartbeat is older than 45s (per ADR 0002).
 */
const HEARTBEAT_INTERVAL_MS = 15_000;
const REAPER = setInterval(() => {
  server.reapStale(Date.now());
}, HEARTBEAT_INTERVAL_MS);
// Don't keep the process alive solely for the reaper.
const reaperRef = REAPER as unknown as { unref?: () => void };
reaperRef.unref?.();

/**
 * Adapter that bridges a Nitro WebSocket peer to the PeerSender interface
 * expected by SignalingServer.
 */
class NitroPeerSender implements PeerSender {
  readonly peerId: string;
  private readonly peer: Peer;

  constructor (peer: Peer) {
    this.peer = peer;
    this.peerId = peer.id;
  }

  send (data: string): void {
    this.peer.send(data);
  }

  publish (room: string, data: string): void {
    this.peer.publish(room, data);
  }

  subscribe (room: string): void {
    this.peer.subscribe(room);
  }

  unsubscribe (room: string): void {
    this.peer.unsubscribe(room);
  }
}

export default defineWebSocketHandler({
  open (peer: Peer) {
    const session = server.connect(peer.id);
    peer.context.sender = new NitroPeerSender(peer);
    peer.context.session = session;
  },

  message (peer: Peer, message: Message) {
    const sender = peer.context.sender as PeerSender | undefined;
    const session = peer.context.session as ReturnType<typeof server.connect> | undefined;
    if (!sender || !session) {
      return;
    }
    const result = server.handle(session, sender, message.text(), Date.now());
    if (result.action === 'close') {
      peer.close(result.code, result.reason);
    }
  },

  close (peer: Peer) {
    server.disconnect(peer.id);
  },

  error (peer: Peer, error: unknown) {
    // eslint-disable-next-line no-console
    console.error(`[signaling] peer ${peer.id} error:`, error);
    server.disconnect(peer.id);
  }
});
