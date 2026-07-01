import { UsernameRegistry } from './UsernameRegistry';
import { RoomRegistry, type RoomPeer } from './RoomRegistry';
import { createDefaultHubElectionChain } from './HubElectionStrategy';
import type {
  SignalingEnvelope,
  SignalingMessageType,
  HelloPayload,
  WelcomePayload,
  JoinPayload,
  PeerJoinedPayload,
  PeerLeftPayload,
  TransportModePayload,
  HubElectedPayload,
  ChatMessagePayload,
  TypingPayload,
  RelayBroadcastPayload,
  ErrorPayload
} from '#shared/types/Signaling';
import type { Tier } from '#shared/types/Tier';

/**
 * Adapter interface for sending messages to a peer. The WebSocket handler
 * implements this; tests use a mock. This keeps SignalingSession testable
 * without a real WebSocket.
 */
export interface PeerSender {
  readonly peerId: string;
  send (data: string): void;
  /** Broadcast to all peers in a room topic (excluding this peer). */
  publish (room: string, data: string): void;
  /** Subscribe this peer to a room topic. */
  subscribe (room: string): void;
  /** Unsubscribe this peer from a room topic. */
  unsubscribe (room: string): void;
}

/**
 * Result of handling a message — tells the WebSocket layer what to do
 * (close the connection, etc.) if anything.
 */
export type HandleResult =
  | { action: 'continue' }
  | { action: 'close'; code: number; reason: string };

/**
 * Session-level state for a single WebSocket connection. Tracks the
 * assigned peerId, claimed username, and joined rooms.
 */
export class SignalingSession {
  readonly peerId: string;
  username: string | null = null;
  tiers: Tier[] = [];
  joinedRooms = new Set<string>();

  constructor (peerId: string) {
    this.peerId = peerId;
  }

  get isAuthenticated (): boolean {
    return this.username !== null && this.tiers.length > 0;
  }
}

/**
 * Core signaling logic. Owns the username and room registries. The
 * WebSocket handler delegates to handle() for each incoming message.
 *
 * Pure logic: no Nuxt/Nitro globals, no timers. Heartbeat reaping is
 * driven externally by the WebSocket handler on an interval.
 */
export class SignalingServer {
  private readonly usernames: UsernameRegistry;
  private readonly rooms: RoomRegistry;
  private readonly sessions = new Map<string, SignalingSession>();

  constructor (opts: { meshThreshold?: number } = {}) {
    this.usernames = new UsernameRegistry();
    this.rooms = new RoomRegistry({ meshThreshold: opts.meshThreshold ?? 8 });
    this.rooms.setHubElector(createDefaultHubElectionChain());
  }

  /** Create a session for a new connection. */
  connect (peerId: string): SignalingSession {
    const session = new SignalingSession(peerId);
    this.sessions.set(peerId, session);
    return session;
  }

  /** Clean up on disconnect: release username, leave all rooms. */
  disconnect (peerId: string): Array<{ room: string; remaining: RoomPeer[]; wasHub: boolean; destroyed: boolean; leftUsername: string | null }> {
    const session = this.sessions.get(peerId);
    if (!session) { return []; }

    const results: Array<{ room: string; remaining: RoomPeer[]; wasHub: boolean; destroyed: boolean; leftUsername: string | null }> = [];
    for (const roomName of session.joinedRooms) {
      const leaveResult = this.rooms.leave(roomName, peerId);
      results.push({
        room: roomName,
        remaining: leaveResult.remaining,
        wasHub: leaveResult.wasHub,
        destroyed: leaveResult.destroyed,
        leftUsername: session.username
      });
    }

    if (session.username) {
      this.usernames.release(session.username, peerId);
    }
    this.sessions.delete(peerId);
    return results;
  }

  /**
   * Handle an incoming signaling message. Returns a result indicating
   * whether to continue or close the connection.
   */
  handle (session: SignalingSession, sender: PeerSender, raw: string, now: number): HandleResult {
    let envelope: SignalingEnvelope;
    try {
      envelope = JSON.parse(raw) as SignalingEnvelope;
    } catch {
      this.sendError(sender, 'unknown', 'Invalid JSON', now);
      return { action: 'continue' };
    }

    switch (envelope.type) {
      case 'hello': return this.handleHello(session, sender, envelope, now);
      case 'join': return this.handleJoin(session, sender, envelope, now);
      case 'leave': return this.handleLeave(session, sender, envelope, now);
      case 'heartbeat': return this.handleHeartbeat(session, sender, now);
      case 'offer': return this.handleOffer(session, sender, envelope, now);
      case 'answer': return this.handleAnswer(session, sender, envelope, now);
      case 'ice-candidate': return this.handleIceCandidate(session, sender, envelope, now);
      case 'chat-message': return this.handleChatMessage(session, sender, envelope, now);
      case 'typing': return this.handleTyping(session, sender, envelope, now);
      default:
        this.sendError(sender, 'unknown', `Unknown message type: ${envelope.type}`, now);
        return { action: 'continue' };
    }
  }

  /** Reap stale peers across all registries. Returns evicted peerIds per room. */
  reapStale (now: number): Array<{ room: string; peerIds: string[] }> {
    return this.rooms.reapStale(now);
  }

  /** Get a session by peerId. */
  getSession (peerId: string): SignalingSession | undefined {
    return this.sessions.get(peerId);
  }

  /** Get all sessions (for server-side broadcasts). */
  getAllSessions (): SignalingSession[] {
    return Array.from(this.sessions.values());
  }

  // --- Message handlers ---

  private handleHello (session: SignalingSession, sender: PeerSender, envelope: SignalingEnvelope, now: number): HandleResult {
    const payload = envelope.payload as HelloPayload;
    if (!payload || typeof payload.username !== 'string') {
      this.sendError(sender, 'username-invalid', 'Missing username', now);
      return { action: 'continue' };
    }

    const result = this.usernames.claim(payload.username, session.peerId, payload.tiers ?? [], now);
    if (!result.ok) {
      this.sendError(sender, result.reason === 'in-use' ? 'username-in-use' : 'username-invalid', `Username ${result.reason}`, now);
      return { action: 'continue' };
    }

    session.username = result.record.username;
    session.tiers = result.record.tiers;

    const welcomePayload: WelcomePayload = {
      peerId: session.peerId,
      onlineUsernames: this.usernames.onlineUsernames()
    };
    this.send(sender, 'welcome', welcomePayload, now);
    return { action: 'continue' };
  }

  private handleJoin (session: SignalingSession, sender: PeerSender, envelope: SignalingEnvelope, now: number): HandleResult {
    if (!session.isAuthenticated) {
      this.sendError(sender, 'not-joined', 'Not authenticated', now);
      return { action: 'continue' };
    }

    const payload = envelope.payload as JoinPayload;
    const roomName = payload?.room ?? envelope.room;
    if (!roomName) {
      this.sendError(sender, 'unknown', 'Missing room name', now);
      return { action: 'continue' };
    }

    if (session.joinedRooms.has(roomName)) {
      this.sendError(sender, 'not-joined', 'Already joined this room', now);
      return { action: 'continue' };
    }

    const peer: RoomPeer = {
      peerId: session.peerId,
      username: session.username!,
      tiers: session.tiers,
      lastHeartbeat: now
    };

    const joinResult = this.rooms.join(roomName, peer);
    if (!joinResult.ok) {
      const code = joinResult.reason === 'tier-mismatch' ? 'tier-mismatch' : 'not-joined';
      this.sendError(sender, code, `Join failed: ${joinResult.reason}`, now);
      return { action: 'continue' };
    }

    session.joinedRooms.add(roomName);
    sender.subscribe(roomName);

    const room = joinResult.room!;
    const existingPeers = joinResult.existingPeers ?? [];

    // Send transport mode to the joiner.
    this.send(sender, 'transport-mode', {
      room: roomName,
      mode: room.transportMode,
      hubPeerId: room.hubPeerId
    } satisfies TransportModePayload, now);

    // Notify the joiner of existing peers.
    for (const existing of existingPeers) {
      const peerJoinedPayload: PeerJoinedPayload = {
        peer: { peerId: existing.peerId, username: existing.username, tiers: existing.tiers },
        room: roomName,
        isHub: room.hubPeerId === existing.peerId
      };
      this.send(sender, 'peer-joined', peerJoinedPayload, now);
    }

    // Notify existing peers that the new peer joined.
    const joinedPayload: PeerJoinedPayload = {
      peer: { peerId: session.peerId, username: session.username!, tiers: session.tiers },
      room: roomName,
      isHub: room.hubPeerId === session.peerId
    };
    sender.publish(roomName, JSON.stringify(this.envelope('peer-joined', joinedPayload, now, roomName)));

    // In star mode, broadcast hub-elected so all peers know who the hub is.
    // This covers both the mesh-to-star transition (existing peers learn the
    // hub) and the case where the joiner itself is the hub.
    if (room.transportMode === 'star' && room.hubPeerId) {
      const hubPeer = room.peers.get(room.hubPeerId);
      if (hubPeer) {
        const hubPayload: HubElectedPayload = {
          room: roomName,
          hubPeerId: hubPeer.peerId,
          hubUsername: hubPeer.username
        };
        this.broadcastRoom(roomName, sender, 'hub-elected', hubPayload, now);
      }
    }

    return { action: 'continue' };
  }

  private handleLeave (session: SignalingSession, sender: PeerSender, envelope: SignalingEnvelope, now: number): HandleResult {
    const roomName = envelope.room;
    if (!roomName || !session.joinedRooms.has(roomName)) {
      this.sendError(sender, 'not-joined', 'Not in this room', now);
      return { action: 'continue' };
    }

    this.leaveRoom(session, sender, roomName, now);
    return { action: 'continue' };
  }

  private leaveRoom (session: SignalingSession, sender: PeerSender, roomName: string, now: number): void {
    const leaveResult = this.rooms.leave(roomName, session.peerId);
    session.joinedRooms.delete(roomName);
    sender.unsubscribe(roomName);

    const leftPayload: PeerLeftPayload = {
      peerId: session.peerId,
      room: roomName,
      wasHub: leaveResult.wasHub
    };
    this.broadcastRoom(roomName, sender, 'peer-left', leftPayload, now);

    // If the room was destroyed, notify remaining subscribers.
    if (leaveResult.destroyed) {
      this.broadcastRoom(roomName, sender, 'room-destroyed', { room: roomName }, now);
      return;
    }

    // If the hub left and a new hub was elected, notify remaining peers.
    if (leaveResult.wasHub) {
      const room = this.rooms.get(roomName);
      if (room?.hubPeerId) {
        const hubPeer = room.peers.get(room.hubPeerId);
        if (hubPeer) {
          const hubPayload: HubElectedPayload = {
            room: roomName,
            hubPeerId: hubPeer.peerId,
            hubUsername: hubPeer.username
          };
          this.broadcastRoom(roomName, sender, 'hub-elected', hubPayload, now);
        }
      }
    }
  }

  private handleHeartbeat (session: SignalingSession, _sender: PeerSender, now: number): HandleResult {
    if (session.username) {
      this.usernames.heartbeat(session.username, now);
    }
    for (const roomName of session.joinedRooms) {
      this.rooms.heartbeat(roomName, session.peerId, now);
    }
    return { action: 'continue' };
  }

  private handleOffer (session: SignalingSession, sender: PeerSender, envelope: SignalingEnvelope, now: number): HandleResult {
    return this.relayToPeer(session, sender, envelope, 'offer-relayed', now);
  }

  private handleAnswer (session: SignalingSession, sender: PeerSender, envelope: SignalingEnvelope, now: number): HandleResult {
    return this.relayToPeer(session, sender, envelope, 'answer-relayed', now);
  }

  private handleIceCandidate (session: SignalingSession, sender: PeerSender, envelope: SignalingEnvelope, now: number): HandleResult {
    return this.relayToPeer(session, sender, envelope, 'ice-candidate-relayed', now);
  }

  private relayToPeer (session: SignalingSession, sender: PeerSender, envelope: SignalingEnvelope, relayType: SignalingMessageType, now: number): HandleResult {
    const targetPeerId = envelope.to;
    if (!targetPeerId) {
      this.sendError(sender, 'unknown', 'Missing target peerId', now);
      return { action: 'continue' };
    }

    const targetSession = this.sessions.get(targetPeerId);
    if (!targetSession) {
      this.sendError(sender, 'unknown', 'Target peer not found', now);
      return { action: 'continue' };
    }

    // Relay the message to the target peer via their sender.
    // In the real WebSocket handler, we look up the target's sender.
    // For testability, we publish to a per-peer topic.
    const relayed = this.envelope(relayType, envelope.payload, now, envelope.room, session.peerId, targetPeerId);
    sender.publish(`peer:${targetPeerId}`, JSON.stringify(relayed));
    return { action: 'continue' };
  }

  private handleChatMessage (session: SignalingSession, sender: PeerSender, envelope: SignalingEnvelope, now: number): HandleResult {
    const roomName = envelope.room;
    if (!roomName || !session.joinedRooms.has(roomName)) {
      this.sendError(sender, 'not-joined', 'Not in this room', now);
      return { action: 'continue' };
    }

    // In mesh/star mode, chat messages flow P2P over DataChannels, not
    // through the signaling server. This handler is only used in relay
    // fallback mode, where the server broadcasts the message to the room.
    const room = this.rooms.get(roomName);
    if (room?.transportMode === 'relay') {
      const payload = envelope.payload as ChatMessagePayload;
      const broadcastPayload: RelayBroadcastPayload = { room: roomName, message: payload };
      this.broadcastRoom(roomName, sender, 'relay-broadcast', broadcastPayload, now);
    }
    return { action: 'continue' };
  }

  private handleTyping (session: SignalingSession, sender: PeerSender, envelope: SignalingEnvelope, now: number): HandleResult {
    const roomName = envelope.room;
    if (!roomName || !session.joinedRooms.has(roomName)) {
      return { action: 'continue' };
    }

    const payload = envelope.payload as TypingPayload;
    // Relay typing indicators to the room via pub/sub.
    this.broadcastRoom(roomName, sender, 'typing', payload, now);
    return { action: 'continue' };
  }

  // --- Helpers ---

  private send (sender: PeerSender, type: SignalingMessageType, payload: unknown, now: number): void {
    sender.send(JSON.stringify(this.envelope(type, payload, now)));
  }

  private sendError (sender: PeerSender, code: ErrorPayload['code'], message: string, now: number): void {
    this.send(sender, 'error', { code, message } satisfies ErrorPayload, now);
  }

  private broadcastRoom (roomName: string, sender: PeerSender, type: SignalingMessageType, payload: unknown, now: number): void {
    sender.publish(roomName, JSON.stringify(this.envelope(type, payload, now, roomName)));
  }

  private envelope (type: SignalingMessageType, payload: unknown, now: number, room?: string, from?: string, to?: string): SignalingEnvelope {
    return { type, payload, ts: now, room, from, to };
  }
}
