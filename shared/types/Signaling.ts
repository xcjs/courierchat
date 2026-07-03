import type { Tier } from './Tier';

/**
 * Transport mode for a room.
 * - Mesh: full peer-to-peer mesh (small rooms, <= mesh threshold)
 * - Star: hub-and-spoke with an elected hub peer retransmitting to leaves
 * - Relay: server WebSocket relay (last resort when no reachable hub exists)
 */
export enum TransportMode {
  Mesh = 'mesh',
  Star = 'star',
  Relay = 'relay'
}

/**
 * Connection presence status for a peer.
 */
export enum PresenceStatus {
  Online = 'online',
  Offline = 'offline'
}

/**
 * Signaling message types exchanged over the signaling WebSocket.
 * Client-to-server types are sent by the client; server-to-client types are
 * dispatched by SignalingClient.handleIncoming and SignalingServer.handle.
 */
export enum SignalingMessageType {
  // Client -> server: connection lifecycle
  Hello = 'hello',
  Join = 'join',
  Leave = 'leave',
  Heartbeat = 'heartbeat',
  // Client -> server: WebRTC signaling relay
  Offer = 'offer',
  Answer = 'answer',
  IceCandidate = 'ice-candidate',
  // Server -> client: room state
  Welcome = 'welcome',
  PeerJoined = 'peer-joined',
  PeerLeft = 'peer-left',
  RoomDestroyed = 'room-destroyed',
  TransportMode = 'transport-mode',
  // Server -> client: hub election
  HubElected = 'hub-elected',
  // Server -> client: relayed WebRTC signaling
  OfferRelayed = 'offer-relayed',
  AnswerRelayed = 'answer-relayed',
  IceCandidateRelayed = 'ice-candidate-relayed',
  // Server -> client: errors
  Error = 'error',
  // Client -> server: request relay fallback (no reachable hub / RTC failure)
  RequestRelay = 'request-relay',
  // Client -> server: latency probe
  Ping = 'ping',
  // Server -> client: latency probe response
  Pong = 'pong',
  // Client -> server: self-reported peer metrics for hub election
  PeerMetrics = 'peer-metrics',
  // Peer -> peer (relayed by server): chat transport
  ChatMessage = 'chat-message',
  Typing = 'typing',
  Presence = 'presence',
  // Relay-mode broadcast (server relays chat content when no hub reachable)
  RelayBroadcast = 'relay-broadcast',
  // Server -> client: full room list snapshot (tier-filtered for the recipient)
  RoomList = 'room-list',
  // Server -> client: acknowledges a join completed and the full peer list
  // for the room has been sent (all PeerJoined messages precede this).
  JoinAck = 'join-ack'
}

/**
 * Error codes returned by the server in an ErrorPayload.
 */
export enum SignalingErrorCode {
  UsernameInUse = 'username-in-use',
  UsernameInvalid = 'username-invalid',
  NotJoined = 'not-joined',
  TierMismatch = 'tier-mismatch',
  Unknown = 'unknown'
}

/**
 * Identity of a participant in a room. The peerId is a server-assigned
 * stable identifier for the connection; the username is the human-readable
 * claimed name. Tiers are the age-attestation tiers the session holds.
 */
export interface PeerIdentity {
  peerId: string;
  username: string;
  tiers: Tier[];
  /**
   * Base64 SPKI DER encoding of the peer's ECDSA P-256 public key. Used by
   * recipients to verify message signatures. Required for all connections.
   */
  publicKey: string;
  /**
   * Base64 SPKI DER encoding of the peer's ECDH P-256 public key. Used by
   * senders to derive pairwise shared secrets for end-to-end message
   * encryption (ADR 0003). Required for all connections.
   */
  encPublicKey: string;
}

/**
 * Signaling envelope. Every message exchanged over the signaling WebSocket
 * has this shape. `from` is omitted on server-originated messages and on
 * client messages that have not yet been assigned a peerId.
 */
export interface SignalingEnvelope<T = unknown> {
  type: SignalingMessageType;
  room?: string;
  from?: string;
  to?: string;
  payload: T;
  /** Server-assigned timestamp (ms since epoch). */
  ts: number;
}

/**
 * Client -> server: initial greeting. Carries the claimed username and tiers.
 * Server validates username availability and either accepts (welcome) or
 * rejects (error).
 */
export interface HelloPayload {
  username: string;
  tiers: Tier[];
  /**
   * Base64 SPKI DER encoding of the client's ECDSA P-256 public key. The
   * server stores this on the session and distributes it to other peers via
   * PeerJoined. Required for all connections.
   */
  publicKey: string;
  /**
   * Base64 SPKI DER encoding of the client's ECDH P-256 public key. Used by
   * other peers to derive pairwise shared secrets for end-to-end message
   * encryption (ADR 0003). Required for all connections.
   */
  encPublicKey: string;
}

/**
 * Client -> server: join a room. Server adds the peer to the room, picks
 * the transport mode, and notifies existing peers. The optional icon is sent
 * so the server can attach it to the room record for the room list.
 */
export interface JoinPayload {
  room: string;
  icon?: string;
}

/**
 * Summary of a room sent in the room list. Contains only the information
 * clients need to display and join rooms — no peer identities or transport
 * details. `memberCount` is the current peer count; `icon` is the optional
 * lucide/emoji icon set when the room was created.
 */
export interface RoomSummary {
  name: string;
  tiers: Tier[];
  memberCount: number;
  icon?: string;
}

/**
 * Server -> client: full room list snapshot, tier-filtered for the recipient.
 * Sent on Welcome and broadcast whenever the room set changes (room created,
 * peer joined/left, room destroyed).
 */
export interface RoomListPayload {
  rooms: RoomSummary[];
}

/**
 * Server -> client: accepted connection. Contains the assigned peerId,
 * the current global username registry snapshot (for presence), and the
 * list of rooms visible to the session's tiers.
 */
export interface WelcomePayload {
  peerId: string;
  onlineUsernames: string[];
  rooms: RoomSummary[];
}

/**
 * Server -> client: a peer joined a room the receiver is in.
 */
export interface PeerJoinedPayload {
  peer: PeerIdentity;
  room: string;
  /** True when the new peer was elected as the hub. */
  isHub: boolean;
}

/**
 * Server -> client: a peer left a room the receiver is in.
 */
export interface PeerLeftPayload {
  peerId: string;
  room: string;
  /** True when the departed peer was the hub; a new hub may follow. */
  wasHub: boolean;
}

/**
 * Server -> client: acknowledges that a Join completed and that all
 * PeerJoined messages for existing room peers have been sent. Clients use
 * this to know the peer list is settled before sending the first message,
 * avoiding an encryption-with-no-recipients race.
 */
export interface JoinAckPayload {
  room: string;
}

/**
 * Server -> client: the room's transport mode has been set/changed.
 */
export interface TransportModePayload {
  room: string;
  mode: TransportMode;
  /** Present in star mode; the elected hub peerId. */
  hubPeerId?: string;
}

/**
 * Server -> client: a new hub has been elected for a star-mode room.
 */
export interface HubElectedPayload {
  room: string;
  hubPeerId: string;
  hubUsername: string;
}

/**
 * SDP offer payload (client -> server -> relayed to target peer).
 */
export interface OfferPayload {
  sdp: string;
  /** DataChannel label being negotiated. */
  label: string;
}

export interface AnswerPayload {
  sdp: string;
}

export interface IceCandidatePayload {
  candidate: string;
  sdpMLineIndex: number | null;
  sdpMid: string | null;
}

/**
 * Chat message carried peer-to-peer (mesh/star) or relayed.
 */
export interface ChatMessagePayload {
  id: string;
  author: string;
  content: string;
  timestamp: number;
  /**
   * Base64 ECDSA signature over `${id}|${author}|${content}|${timestamp}`.
   * Computed over the **plaintext** content before encryption. Required on
   * all wire-format messages. Recipients verify it against the author's
   * public key (distributed via signaling) and drop the message on mismatch.
   */
  signature: string;
  /**
   * Base64 96-bit initialization vector for AES-GCM-256 content encryption
   * (ADR 0003). Required on all wire-format messages.
   */
  encIv: string;
  /**
   * Per-recipient wrapped content encryption keys (ADR 0003). Each key is
   * the base64 AES-GCM-256 encryption of the random CEK using the pairwise
   * ECDH-derived key for that recipient. The map key is the recipient's
   * peerId. Required on all wire-format messages; recipients look up their
   * peerId to unwrap the CEK and decrypt the content.
   */
  encKeys: Record<string, string>;
}

export interface TypingPayload {
  room: string;
  username: string;
  isTyping: boolean;
}

export interface PresencePayload {
  username: string;
  status: PresenceStatus;
}

/**
 * Client -> server: request relay fallback for a room. Sent when the client
 * detects that no DataChannel to the hub (or any peer in mesh) can be
 * established. The server transitions the room to Relay mode and broadcasts
 * a TransportMode message to all peers.
 */
export interface RequestRelayPayload {
  room: string;
}

/**
 * Client -> server: latency probe. The server echoes a Pong with the same
 * id so the client can measure round-trip time. Carries the room so the
 * server can update the peer's lastHeartbeat for the room.
 */
export interface PingPayload {
  /** Client-generated unique id echoed back in Pong. */
  id: string;
  /** Client-local timestamp (ms) sent in the ping. */
  sentAt: number;
}

/** Server -> client: latency probe response. */
export interface PongPayload {
  id: string;
  /** The client-sent timestamp echoed back so the client can compute RTT. */
  sentAt: number;
  /** Server-receive timestamp (ms) for diagnostic purposes. */
  receivedAt: number;
}

/**
 * Client -> server: self-reported metrics for hub election. Peers report
 * passively (ADR-0002 §resolved #2). The server stores these on the peer's
 * RoomPeer record so the election chain (LowestLatency, HighestBandwidth)
 * can use them.
 */
export interface PeerMetricsPayload {
  room: string;
  /** Round-trip latency to the server in ms (from ping/pong). */
  latencyMs?: number;
  /** Estimated downstream bandwidth in kbps. */
  bandwidthKbps?: number;
}

export interface RelayBroadcastPayload {
  room: string;
  message: ChatMessagePayload;
}

/**
 * Server -> client: error response.
 */
export interface ErrorPayload {
  code: SignalingErrorCode;
  message: string;
}
