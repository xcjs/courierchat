import { SignalingServer, type PeerSender } from '#server/services/SignalingServer';

/**
 * Singleton SignalingServer instance. Nitro may hot-reload modules in dev,
 * so we stash on globalThis to preserve state across reloads. Both the
 * WebSocket route and the username-status HTTP route import this.
 */
const globalForSignaling = globalThis as unknown as { __signalingServer?: SignalingServer };
const server = globalForSignaling.__signalingServer ?? new SignalingServer();
if (!globalForSignaling.__signalingServer) {
  globalForSignaling.__signalingServer = server;
}

export function useSignalingServer (): SignalingServer {
  return server;
}

export type { PeerSender };
