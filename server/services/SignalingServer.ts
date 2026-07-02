import { UsernameRegistry } from './UsernameRegistry';
import { RoomRegistry, type RoomPeer, type LeaveResult } from './RoomRegistry';
import { createDefaultHubElectionChain } from './HubElectionStrategy';
import {
  SignalingMessageType,
  SignalingErrorCode,
  TransportMode,
  PresenceStatus,
  type SignalingEnvelope,
  type HelloPayload,
  type WelcomePayload,
  type JoinPayload,
  type PeerJoinedPayload,
  type PeerLeftPayload,
  type TransportModePayload,
  type HubElectedPayload,
  type ChatMessagePayload,
  type TypingPayload,
  type RelayBroadcastPayload,
  type RequestRelayPayload,
  type PingPayload,
  type PongPayload,
  type PeerMetricsPayload,
  type PresencePayload,
  type ErrorPayload
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
  /**
   * Base64 SPKI DER public key sent by the client in Hello. Distributed
   * to other peers via PeerJoined so they can verify message signatures.
   * Required for all connections.
   */
  publicKey: string | null = null;
  /**
   * Base64 SPKI DER ECDH P-256 public key sent by the client in Hello.
   * Distributed to other peers via PeerJoined so they can derive pairwise
   * encryption keys (ADR 0003). Required for all connections.
   */
  encPublicKey: string | null = null;

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
  private readonly senders = new Map<string, PeerSender>();

  constructor (opts: { meshThreshold?: number } = {}) {
    this.usernames = new UsernameRegistry();
    this.rooms = new RoomRegistry({ meshThreshold: opts.meshThreshold ?? 8 });
    this.rooms.setHubElector(createDefaultHubElectionChain());
  }

  /**
   * Check username availability against the live registry. Returns a
   * UsernameStatus suitable for the /api/username-status route.
   */
  checkUsernameAvailability (username: unknown, now: number = Date.now()): { available: boolean; reason?: 'in-use' | 'invalid'; tiers?: Tier[] } {
    if (typeof username !== 'string' || !username.trim()) {
      return { available: false, reason: 'invalid' };
    }
    const result = this.usernames.checkAvailability(username, now);
    if (result.available) { return { available: true }; }
    if (result.reason === 'in-use') {
      const holder = result.holderPeerId !== undefined ? this.sessions.get(result.holderPeerId) : undefined;
      return { available: false, reason: 'in-use', tiers: holder?.tiers ?? [] };
    }
    return { available: false, reason: 'invalid' };
  }

  /** Create a session for a new connection and register its sender. */
  connect (peerId: string, sender: PeerSender): SignalingSession {
    const session = new SignalingSession(peerId);
    this.sessions.set(peerId, session);
    this.senders.set(peerId, sender);
    return session;
  }

  /** Clean up on disconnect: release username, leave all rooms. */
  disconnect (peerId: string, now: number = Date.now()): Array<{ room: string; remaining: RoomPeer[]; wasHub: boolean; destroyed: boolean; leftUsername: string | null }> {
    const session = this.sessions.get(peerId);
    if (!session) { return []; }

    const sender = this.senders.get(peerId);
    const results: Array<{ room: string; remaining: RoomPeer[]; wasHub: boolean; destroyed: boolean; leftUsername: string | null }> = [];
    for (const roomName of session.joinedRooms) {
      if (sender) {
        const leaveResult = this.leaveRoom(session, sender, roomName, now);
        results.push({
          room: roomName,
          remaining: leaveResult.remaining,
          wasHub: leaveResult.wasHub,
          destroyed: leaveResult.destroyed,
          leftUsername: session.username
        });
      } else {
        const leaveResult = this.rooms.leave(roomName, peerId);
        results.push({
          room: roomName,
          remaining: leaveResult.remaining,
          wasHub: leaveResult.wasHub,
          destroyed: leaveResult.destroyed,
          leftUsername: session.username
        });
      }
    }

    if (session.username) {
      this.usernames.release(session.username, peerId);
    }
    this.sessions.delete(peerId);
    this.senders.delete(peerId);

    // Broadcast presence-offline to all remaining connected peers.
    if (session.username) {
      this.broadcastPresence(session.username, PresenceStatus.Offline, null, now);
    }
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
      this.sendError(sender, SignalingErrorCode.Unknown, 'Invalid JSON', now);
      return { action: 'continue' };
    }

    switch (envelope.type) {
      case SignalingMessageType.Hello: return this.handleHello(session, sender, envelope, now);
      case SignalingMessageType.Join: return this.handleJoin(session, sender, envelope, now);
      case SignalingMessageType.Leave: return this.handleLeave(session, sender, envelope, now);
      case SignalingMessageType.Heartbeat: return this.handleHeartbeat(session, sender, now);
      case SignalingMessageType.Offer: return this.handleOffer(session, sender, envelope, now);
      case SignalingMessageType.Answer: return this.handleAnswer(session, sender, envelope, now);
      case SignalingMessageType.IceCandidate: return this.handleIceCandidate(session, sender, envelope, now);
      case SignalingMessageType.ChatMessage: return this.handleChatMessage(session, sender, envelope, now);
      case SignalingMessageType.Typing: return this.handleTyping(session, sender, envelope, now);
      case SignalingMessageType.RequestRelay: return this.handleRequestRelay(session, sender, envelope, now);
      case SignalingMessageType.Ping: return this.handlePing(session, sender, envelope, now);
      case SignalingMessageType.PeerMetrics: return this.handlePeerMetrics(session, sender, envelope, now);
      default:
        this.sendError(sender, SignalingErrorCode.Unknown, `Unknown message type: ${envelope.type}`, now);
        return { action: 'continue' };
    }
  }

  /**
   * Reap stale peers across all registries. Evicted username claims trigger
   * presence-offline broadcasts; evicted room peers trigger PeerLeft (handled
   * by the room registry). Returns evicted peerIds grouped by room.
   */
  reapStale (now: number): Array<{ room: string; peerIds: string[] }> {
    // Evict stale username claims and broadcast presence-offline.
    const staleUsernames = this.usernames.reapStale(now);
    for (const { username } of staleUsernames) {
      this.broadcastPresence(username, PresenceStatus.Offline, null, now);
    }
    // Evict stale room peers (triggers PeerLeft via room registry).
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
      this.sendError(sender, SignalingErrorCode.UsernameInvalid, 'Missing username', now);
      return { action: 'continue' };
    }
    if (!payload.publicKey || typeof payload.publicKey !== 'string') {
      this.sendError(sender, SignalingErrorCode.UsernameInvalid, 'Missing public key', now);
      return { action: 'continue' };
    }
    if (!payload.encPublicKey || typeof payload.encPublicKey !== 'string') {
      this.sendError(sender, SignalingErrorCode.UsernameInvalid, 'Missing encryption public key', now);
      return { action: 'continue' };
    }

    const result = this.usernames.claim(payload.username, session.peerId, payload.tiers ?? [], now);
    if (!result.ok) {
      this.sendError(sender, result.reason === 'in-use' ? SignalingErrorCode.UsernameInUse : SignalingErrorCode.UsernameInvalid, `Username ${result.reason}`, now);
      return { action: 'continue' };
    }

    session.username = result.record.username;
    session.tiers = result.record.tiers;
    session.publicKey = payload.publicKey;
    session.encPublicKey = payload.encPublicKey;

    const welcomePayload: WelcomePayload = {
      peerId: session.peerId,
      onlineUsernames: this.usernames.onlineUsernames()
    };
    this.send(sender, SignalingMessageType.Welcome, welcomePayload, now);

    // Broadcast presence-online to all other connected peers.
    this.broadcastPresence(result.record.username, PresenceStatus.Online, sender, now);
    return { action: 'continue' };
  }

  private handleJoin (session: SignalingSession, sender: PeerSender, envelope: SignalingEnvelope, now: number): HandleResult {
    if (!session.isAuthenticated) {
      this.sendError(sender, SignalingErrorCode.NotJoined, 'Not authenticated', now);
      return { action: 'continue' };
    }

    const payload = envelope.payload as JoinPayload;
    const roomName = payload?.room ?? envelope.room;
    if (!roomName) {
      this.sendError(sender, SignalingErrorCode.Unknown, 'Missing room name', now);
      return { action: 'continue' };
    }

    if (session.joinedRooms.has(roomName)) {
      this.sendError(sender, SignalingErrorCode.NotJoined, 'Already joined this room', now);
      return { action: 'continue' };
    }

    const peer: RoomPeer = {
      peerId: session.peerId,
      username: session.username!,
      tiers: session.tiers,
      lastHeartbeat: now,
      publicKey: session.publicKey!,
      encPublicKey: session.encPublicKey!
    };

    const joinResult = this.rooms.join(roomName, peer);
    if (!joinResult.ok) {
      const code = joinResult.reason === 'tier-mismatch' ? SignalingErrorCode.TierMismatch : SignalingErrorCode.NotJoined;
      this.sendError(sender, code, `Join failed: ${joinResult.reason}`, now);
      return { action: 'continue' };
    }

    session.joinedRooms.add(roomName);
    sender.subscribe(roomName);

    const room = joinResult.room!;
    const existingPeers = joinResult.existingPeers ?? [];

    // Send transport mode to the joiner.
    this.send(sender, SignalingMessageType.TransportMode, {
      room: roomName,
      mode: room.transportMode,
      hubPeerId: room.hubPeerId
    } satisfies TransportModePayload, now);

    // Notify the joiner of existing peers.
    for (const existing of existingPeers) {
      const peerJoinedPayload: PeerJoinedPayload = {
        peer: { peerId: existing.peerId, username: existing.username, tiers: existing.tiers, publicKey: existing.publicKey, encPublicKey: existing.encPublicKey },
        room: roomName,
        isHub: room.hubPeerId === existing.peerId
      };
      this.send(sender, SignalingMessageType.PeerJoined, peerJoinedPayload, now);
    }

    // Notify existing peers that the new peer joined.
    const joinedPayload: PeerJoinedPayload = {
      peer: { peerId: session.peerId, username: session.username!, tiers: session.tiers, publicKey: session.publicKey!, encPublicKey: session.encPublicKey! },
      room: roomName,
      isHub: room.hubPeerId === session.peerId
    };
    sender.publish(roomName, JSON.stringify(this.envelope(SignalingMessageType.PeerJoined, joinedPayload, now, roomName)));

    // In star mode, broadcast hub-elected so all peers know who the hub is.
    // This covers both the mesh-to-star transition (existing peers learn the
    // hub) and the case where the joiner itself is the hub.
    if (room.transportMode === TransportMode.Star && room.hubPeerId) {
      const hubPeer = room.peers.get(room.hubPeerId);
      if (hubPeer) {
        const hubPayload: HubElectedPayload = {
          room: roomName,
          hubPeerId: hubPeer.peerId,
          hubUsername: hubPeer.username
        };
        this.broadcastRoom(roomName, sender, SignalingMessageType.HubElected, hubPayload, now);
      }
    }

    return { action: 'continue' };
  }

  private handleLeave (session: SignalingSession, sender: PeerSender, envelope: SignalingEnvelope, now: number): HandleResult {
    const payload = envelope.payload as JoinPayload;
    const roomName = payload?.room ?? envelope.room;
    if (!roomName || !session.joinedRooms.has(roomName)) {
      this.sendError(sender, SignalingErrorCode.NotJoined, 'Not in this room', now);
      return { action: 'continue' };
    }

    this.leaveRoom(session, sender, roomName, now);
    return { action: 'continue' };
  }

  private leaveRoom (session: SignalingSession, sender: PeerSender, roomName: string, now: number): LeaveResult {
    const leaveResult = this.rooms.leave(roomName, session.peerId);
    session.joinedRooms.delete(roomName);
    sender.unsubscribe(roomName);

    const leftPayload: PeerLeftPayload = {
      peerId: session.peerId,
      room: roomName,
      wasHub: leaveResult.wasHub
    };
    this.broadcastRoom(roomName, sender, SignalingMessageType.PeerLeft, leftPayload, now);

    // If the room was destroyed, notify remaining subscribers.
    if (leaveResult.destroyed) {
      this.broadcastRoom(roomName, sender, SignalingMessageType.RoomDestroyed, { room: roomName }, now);
      return leaveResult;
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
          this.broadcastRoom(roomName, sender, SignalingMessageType.HubElected, hubPayload, now);
        }
      }
    }
    return leaveResult;
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
    return this.relayToPeer(session, sender, envelope, SignalingMessageType.OfferRelayed, now);
  }

  private handleAnswer (session: SignalingSession, sender: PeerSender, envelope: SignalingEnvelope, now: number): HandleResult {
    return this.relayToPeer(session, sender, envelope, SignalingMessageType.AnswerRelayed, now);
  }

  private handleIceCandidate (session: SignalingSession, sender: PeerSender, envelope: SignalingEnvelope, now: number): HandleResult {
    return this.relayToPeer(session, sender, envelope, SignalingMessageType.IceCandidateRelayed, now);
  }

  private relayToPeer (session: SignalingSession, sender: PeerSender, envelope: SignalingEnvelope, relayType: SignalingMessageType, now: number): HandleResult {
    const targetPeerId = envelope.to;
    if (!targetPeerId) {
      this.sendError(sender, SignalingErrorCode.Unknown, 'Missing target peerId', now);
      return { action: 'continue' };
    }

    const targetSession = this.sessions.get(targetPeerId);
    if (!targetSession) {
      this.sendError(sender, SignalingErrorCode.Unknown, 'Target peer not found', now);
      return { action: 'continue' };
    }

    const targetSender = this.senders.get(targetPeerId);
    if (!targetSender) {
      this.sendError(sender, SignalingErrorCode.Unknown, 'Target peer not connected', now);
      return { action: 'continue' };
    }

    // Direct send to the target peer (not pub/sub). SDP/ICE relay is
    // point-to-point: the target is not subscribed to a peer:<id> topic.
    const relayed = this.envelope(relayType, envelope.payload, now, envelope.room, session.peerId, targetPeerId);
    targetSender.send(JSON.stringify(relayed));
    return { action: 'continue' };
  }

  private handleChatMessage (session: SignalingSession, sender: PeerSender, envelope: SignalingEnvelope, now: number): HandleResult {
    const roomName = envelope.room;
    if (!roomName || !session.joinedRooms.has(roomName)) {
      this.sendError(sender, SignalingErrorCode.NotJoined, 'Not in this room', now);
      return { action: 'continue' };
    }

    // In mesh/star mode, chat messages flow P2P over DataChannels, not
    // through the signaling server. This handler is only used in relay
    // fallback mode, where the server broadcasts the message to the room.
    const room = this.rooms.get(roomName);
    if (room?.transportMode === TransportMode.Relay) {
      const payload = envelope.payload as ChatMessagePayload;
      const broadcastPayload: RelayBroadcastPayload = { room: roomName, message: payload };
      this.broadcastRoom(roomName, sender, SignalingMessageType.RelayBroadcast, broadcastPayload, now);
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
    this.broadcastRoom(roomName, sender, SignalingMessageType.Typing, payload, now);
    return { action: 'continue' };
  }

  private handleRequestRelay (session: SignalingSession, sender: PeerSender, envelope: SignalingEnvelope, now: number): HandleResult {
    const payload = envelope.payload as RequestRelayPayload;
    const roomName = payload?.room ?? envelope.room;
    if (!roomName || !session.joinedRooms.has(roomName)) {
      this.sendError(sender, SignalingErrorCode.NotJoined, 'Not in this room', now);
      return { action: 'continue' };
    }

    const room = this.rooms.get(roomName);
    if (!room) {
      this.sendError(sender, SignalingErrorCode.Unknown, 'Room not found', now);
      return { action: 'continue' };
    }

    // Transition to Relay mode and broadcast to all peers in the room.
    this.rooms.setRelay(roomName);
    const modePayload: TransportModePayload = {
      room: roomName,
      mode: TransportMode.Relay,
      hubPeerId: undefined
    };
    // Broadcast to all peers including the requester (the requester needs
    // to confirm the transition). publish() excludes the sender, so we also
    // send directly to the requester.
    this.broadcastRoom(roomName, sender, SignalingMessageType.TransportMode, modePayload, now);
    this.send(sender, SignalingMessageType.TransportMode, modePayload, now);
    return { action: 'continue' };
  }

  private handlePing (_session: SignalingSession, sender: PeerSender, envelope: SignalingEnvelope, now: number): HandleResult {
    const payload = envelope.payload as PingPayload;
    const pong: PongPayload = { id: payload?.id ?? '', sentAt: payload?.sentAt ?? 0, receivedAt: now };
    this.send(sender, SignalingMessageType.Pong, pong, now);
    return { action: 'continue' };
  }

  private handlePeerMetrics (session: SignalingSession, _sender: PeerSender, envelope: SignalingEnvelope, _now: number): HandleResult {
    const payload = envelope.payload as PeerMetricsPayload;
    const roomName = payload?.room ?? envelope.room;
    if (!roomName || !session.joinedRooms.has(roomName)) {
      return { action: 'continue' };
    }
    // Store the reported metrics on the peer's RoomPeer record so the
    // election chain can use them on the next hub election.
    const room = this.rooms.get(roomName);
    if (!room) { return { action: 'continue' }; }
    const peer = room.peers.get(session.peerId);
    if (!peer) { return { action: 'continue' }; }
    if (typeof payload.latencyMs === 'number') { peer.latencyMs = payload.latencyMs; }
    if (typeof payload.bandwidthKbps === 'number') { peer.bandwidthKbps = payload.bandwidthKbps; }
    return { action: 'continue' };
  }

  // --- Helpers ---

  private send (sender: PeerSender, type: SignalingMessageType, payload: unknown, now: number): void {
    sender.send(JSON.stringify(this.envelope(type, payload, now)));
  }

  private sendError (sender: PeerSender, code: ErrorPayload['code'], message: string, now: number): void {
    this.send(sender, SignalingMessageType.Error, { code, message } satisfies ErrorPayload, now);
  }

  private broadcastRoom (roomName: string, sender: PeerSender, type: SignalingMessageType, payload: unknown, now: number): void {
    sender.publish(roomName, JSON.stringify(this.envelope(type, payload, now, roomName)));
  }

  /**
   * Broadcast a presence update to all connected peers except the source
   * peer (if a sender is provided). Presence is site-wide, not room-scoped.
   */
  private broadcastPresence (username: string, status: PresenceStatus, sender: PeerSender | null, now: number): void {
    const payload: PresencePayload = { username, status };
    const envelopeStr = JSON.stringify(this.envelope(SignalingMessageType.Presence, payload, now));
    for (const [peerId, peerSender] of this.senders) {
      if (sender !== null && peerId === sender.peerId) { continue; }
      peerSender.send(envelopeStr);
    }
  }

  private envelope (type: SignalingMessageType, payload: unknown, now: number, room?: string, from?: string, to?: string): SignalingEnvelope {
    return { type, payload, ts: now, room, from, to };
  }
}
