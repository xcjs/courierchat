import type { TransportMode, PeerIdentity, PresenceStatus, ChatMessagePayload } from '#shared/types/Signaling';

/**
 * UI-side transport mode. Extends the wire TransportMode with an Offline
 * state used before the signaling connection is established or after it drops.
 */
export enum UiTransportMode {
  Mesh = 'mesh',
  Star = 'star',
  Relay = 'relay',
  Offline = 'offline'
}

/**
 * Connection state of the signaling WebSocket.
 */
export enum SignalingConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Reconnecting = 'reconnecting'
}

/**
 * Per-room transport state surfaced to the UI.
 */
export interface RoomTransportState {
  room: string;
  mode: UiTransportMode;
  hubPeerId: string | null;
  peers: PeerIdentity[];
  /** True when the local peer is the elected hub for this room. */
  isHub: boolean;
}

/**
 * Callbacks invoked by SignalingClient when server messages arrive.
 * The RTC manager and room transport composable register handlers here.
 */
export interface SignalingHandlers {
  onWelcome?: (peerId: string, onlineUsernames: string[]) => void;
  onPeerJoined?: (peer: PeerIdentity, room: string, isHub: boolean) => void;
  onPeerLeft?: (peerId: string, room: string, wasHub: boolean) => void;
  onRoomDestroyed?: (room: string) => void;
  onTransportMode?: (room: string, mode: TransportMode, hubPeerId?: string) => void;
  onHubElected?: (room: string, hubPeerId: string, hubUsername: string) => void;
  onOfferRelayed?: (from: string, sdp: string, label: string) => void;
  onAnswerRelayed?: (from: string, sdp: string) => void;
  onIceCandidateRelayed?: (from: string, candidate: string, sdpMLineIndex: number | null, sdpMid: string | null) => void;
  onRelayBroadcast?: (room: string, message: ChatMessagePayload) => void;
  onPong?: (id: string, sentAt: number, receivedAt: number) => void;
  onTyping?: (room: string, username: string, isTyping: boolean) => void;
  onPresence?: (username: string, status: PresenceStatus) => void;
  onError?: (code: string, message: string) => void;
}

/**
 * Transport interface for sending signaling messages.
 * Decouples SignalingClient from the actual WebSocket so it can be tested.
 */
export interface SignalingTransport {
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

/**
 * Callbacks the SignalingClient uses to notify about connection lifecycle.
 */
export interface SignalingLifecycleHandlers {
  onOpen?: () => void;
  onClose?: (code: number, reason: string) => void;
  onError?: (error: unknown) => void;
  onMessage?: (data: string) => void;
}
