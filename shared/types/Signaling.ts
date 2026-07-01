import type { Tier } from './Tier';

/**
 * Transport mode for a room.
 * - mesh: full peer-to-peer mesh (small rooms, <= mesh threshold)
 * - star: hub-and-spoke with an elected hub peer retransmitting to leaves
 * - relay: server WebSocket relay (last resort when no reachable hub exists)
 */
export type TransportMode = 'mesh' | 'star' | 'relay';

/**
 * Identity of a participant in a room. The peerId is a server-assigned
 * stable identifier for the connection; the username is the human-readable
 * claimed name. Tiers are the age-attestation tiers the session holds.
 */
export interface PeerIdentity {
  peerId: string;
  username: string;
  tiers: Tier[];
}

export type SignalingMessageType =
  // Client -> server: connection lifecycle
  | 'hello'
  | 'join'
  | 'leave'
  | 'heartbeat'
  // Client -> server: WebRTC signaling relay
  | 'offer'
  | 'answer'
  | 'ice-candidate'
  // Server -> client: room state
  | 'welcome'
  | 'peer-joined'
  | 'peer-left'
  | 'room-destroyed'
  | 'transport-mode'
  // Server -> client: hub election
  | 'hub-elected'
  // Server -> client: relayed WebRTC signaling
  | 'offer-relayed'
  | 'answer-relayed'
  | 'ice-candidate-relayed'
  // Server -> client: errors
  | 'error'
  // Peer -> peer (relayed by server): chat transport
  | 'chat-message'
  | 'typing'
  | 'presence'
  // Relay-mode broadcast (server relays chat content when no hub reachable)
  | 'relay-broadcast';

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
}

/**
 * Client -> server: join a room. Server adds the peer to the room, picks
 * the transport mode, and notifies existing peers.
 */
export interface JoinPayload {
  room: string;
}

/**
 * Server -> client: accepted connection. Contains the assigned peerId and
 * the current global username registry snapshot (for presence).
 */
export interface WelcomePayload {
  peerId: string;
  onlineUsernames: string[];
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
}

export interface TypingPayload {
  room: string;
  username: string;
  isTyping: boolean;
}

export interface PresencePayload {
  username: string;
  status: 'online' | 'offline';
}

export interface RelayBroadcastPayload {
  room: string;
  message: ChatMessagePayload;
}

export type SignalingErrorCode =
  | 'username-in-use'
  | 'username-invalid'
  | 'not-joined'
  | 'tier-mismatch'
  | 'unknown';

/**
 * Server -> client: error response.
 */
export interface ErrorPayload {
  code: SignalingErrorCode;
  message: string;
}
