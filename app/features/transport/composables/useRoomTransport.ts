import { readonly, ref, type DeepReadonly, type Ref } from 'vue';
import { RtcManager } from '../services/RtcManager';
import type { RtcManagerHandlers } from '../services/RtcManager';
import type { RoomTransportState } from '../types/Transport';
import { UiTransportMode } from '../types/Transport';
import { useSignaling } from './useSignaling';
import { TransportMode, type PeerIdentity, type ChatMessagePayload } from '#shared/types/Signaling';
import type { ChatMessage } from '#shared/types/ChatMessage';

/**
 * useRoomTransport wires the SignalingClient to an RtcManager for a single
 * room. It owns the reactive RoomTransportState for that room and exposes
 * `sendMessage` / `sendTyping` that route through the correct transport
 * (DataChannel in mesh/star, server relay in relay mode).
 *
 * Call `join()` to enter the room and `leave()` to exit. The composable
 * registers handlers on the shared SignalingClient via addHandlers; they are
 * removed when `leave()` is called.
 */
export interface UseRoomTransportReturn {
  join: () => void;
  leave: () => void;
  sendMessage: (message: ChatMessage) => void;
  sendTyping: (isTyping: boolean) => void;
  setHandlers: (handlers: {
    onMessage?: (message: ChatMessage) => void;
    onPeerJoined?: (peer: PeerIdentity) => void;
    onPeerLeft?: (peerId: string) => void;
  }) => void;
  mode: Readonly<Ref<UiTransportMode>>;
  hubPeerId: Readonly<Ref<string | null>>;
  peers: DeepReadonly<Ref<PeerIdentity[]>>;
  isHub: Readonly<Ref<boolean>>;
  joined: Readonly<Ref<boolean>>;
  state: RoomTransportState;
}

export function useRoomTransport (roomName: string): UseRoomTransportReturn {
  const signaling = useSignaling();

  const mode = ref<UiTransportMode>(UiTransportMode.Offline);
  const hubPeerId = ref<string | null>(null);
  const peers = ref<PeerIdentity[]>([]);
  const isHub = ref(false);
  const joined = ref(false);
  const localPeerId = ref<string | null>(null);

  let rtc: RtcManager | null = null;
  let handlersRegistered = false;

  /** Callbacks invoked when messages arrive over any transport. */
  interface RoomTransportHandlers {
    onMessage?: (message: ChatMessage) => void;
    onPeerJoined?: (peer: PeerIdentity) => void;
    onPeerLeft?: (peerId: string) => void;
  }
  let externalHandlers: RoomTransportHandlers = {};

  function setHandlers (handlers: RoomTransportHandlers): void {
    externalHandlers = handlers;
  }

  function toUiMode (wire: TransportMode): UiTransportMode {
    switch (wire) {
      case TransportMode.Mesh: return UiTransportMode.Mesh;
      case TransportMode.Star: return UiTransportMode.Star;
      case TransportMode.Relay: return UiTransportMode.Relay;
    }
  }

  function ensureRtc (): RtcManager {
    if (rtc !== null) { return rtc; }
    const id = localPeerId.value ?? 'unknown';
    rtc = new RtcManager(id, { iceServers: signaling.iceServers });
    const rtcHandlers: RtcManagerHandlers = {
      onSendOffer: (to, sdp, label) => { signaling.getClient()?.sendOffer(to, sdp, label); },
      onSendAnswer: (to, sdp) => { signaling.getClient()?.sendAnswer(to, sdp); },
      onSendIceCandidate: (to, candidate) => {
        const payload = {
          candidate: candidate.candidate ?? '',
          sdpMLineIndex: candidate.sdpMLineIndex ?? null,
          sdpMid: candidate.sdpMid ?? null
        };
        signaling.getClient()?.sendIceCandidate(to, payload);
      },
      onMessage: (_peerId, message) => { externalHandlers.onMessage?.(message); },
      onPeerConnected: () => {},
      onPeerDisconnected: (peerId) => {
        if (mode.value !== UiTransportMode.Relay) { externalHandlers.onPeerLeft?.(peerId); }
      }
    };
    rtc.setHandlers(rtcHandlers);
    return rtc;
  }

  function registerSignalingHandlers (): void {
    if (handlersRegistered) { return; }
    signaling.addHandlers({
      onWelcome: (peerId) => { localPeerId.value = peerId; },
      onPeerJoined: (peer, room, _isHubPeer) => {
        if (room !== roomName) { return; }
        if (!peers.value.some(p => p.peerId === peer.peerId)) {
          peers.value = [...peers.value, peer];
        }
        externalHandlers.onPeerJoined?.(peer);
        // In mesh/star, the existing peer initiates the connection to the
        // newcomer. We only connect if we are already in the room and the new
        // peer is not us.
        if (joined.value && peer.peerId !== localPeerId.value) {
          const r = ensureRtc();
          const targets = mode.value === UiTransportMode.Mesh
            ? [peer]
            : (isHub.value ? [peer] : (peer.peerId === hubPeerId.value ? [peer] : []));
          for (const t of targets) {
            r.connectToPeer(t).catch(() => { /* ICE failure; leave to reaper */ });
          }
        }
      },
      onPeerLeft: (peerId, room, _wasHub) => {
        if (room !== roomName) { return; }
        peers.value = peers.value.filter(p => p.peerId !== peerId);
        rtc?.disconnectPeer(peerId);
        externalHandlers.onPeerLeft?.(peerId);
      },
      onRoomDestroyed: (room) => {
        if (room !== roomName) { return; }
        leave();
      },
      onTransportMode: (room, wireMode, hubId) => {
        if (room !== roomName) { return; }
        mode.value = toUiMode(wireMode);
        hubPeerId.value = hubId ?? null;
        isHub.value = hubId === localPeerId.value;
        if (mode.value === UiTransportMode.Relay) {
          rtc?.disconnectAll();
          rtc = null;
        }
      },
      onHubElected: (room, newHubPeerId, _hubUsername) => {
        if (room !== roomName) { return; }
        const wasHub = isHub.value;
        hubPeerId.value = newHubPeerId;
        isHub.value = newHubPeerId === localPeerId.value;
        // If we became the hub, connect to all existing peers we aren't
        // already connected to. If we lost hub status, drop connections to
        // non-hub peers (leaves only keep the hub connection).
        if (mode.value === UiTransportMode.Star) {
          const r = ensureRtc();
          if (isHub.value && !wasHub) {
            for (const p of peers.value) {
              if (p.peerId !== localPeerId.value) {
                r.connectToPeer(p).catch(() => {});
              }
            }
          } else if (!isHub.value && wasHub) {
            for (const p of peers.value) {
              if (p.peerId !== newHubPeerId) { r.disconnectPeer(p.peerId); }
            }
          }
        }
      },
      onOfferRelayed: (from, sdp, label) => {
        const peer = peers.value.find(p => p.peerId === from);
        if (!peer) { return; }
        ensureRtc().handleOffer(from, peer, sdp, label).catch(() => {});
      },
      onAnswerRelayed: (from, sdp) => {
        rtc?.handleAnswer(from, sdp).catch(() => {});
      },
      onIceCandidateRelayed: (from, candidate, sdpMLineIndex, sdpMid) => {
        rtc?.handleIceCandidate(from, { candidate, sdpMLineIndex, sdpMid }).catch(() => {});
      },
      onRelayBroadcast: (room, message) => {
        if (room !== roomName) { return; }
        externalHandlers.onMessage?.(message as ChatMessage);
      }
    });
    handlersRegistered = true;
  }

  /**
   * Join the room. Sends a join message over signaling and establishes
   * DataChannels to existing peers per the transport mode the server assigns.
   */
  function join (): void {
    const client = signaling.getClient();
    if (!client || !signaling.isConnected.value) { return; }
    registerSignalingHandlers();
    joined.value = true;
    client.joinRoom(roomName);
    // Existing peers list is populated by the peer-joined messages the server
    // sends in response to our join (the server sends peer-joined for each
    // existing peer to the newcomer). Connections are initiated in the
    // onPeerJoined handler. For mesh/star we also need to connect to peers;
    // this happens as peer-joined events arrive.
  }

  /**
   * Leave the room. Tears down DataChannels and sends a leave message.
   */
  function leave (): void {
    if (!joined.value) { return; }
    joined.value = false;
    rtc?.disconnectAll();
    rtc = null;
    peers.value = [];
    mode.value = UiTransportMode.Offline;
    hubPeerId.value = null;
    isHub.value = false;
    signaling.getClient()?.leaveRoom(roomName);
  }

  /**
   * Send a chat message over the appropriate transport. In mesh/star the
   * message is broadcast over DataChannels to connected peers. In relay mode
   * it is sent to the server for relay-broadcast. Also returns the message
   * locally so the caller can echo it into its own message list.
   */
  function sendMessage (message: ChatMessage): void {
    const client = signaling.getClient();
    if (!client) { return; }
    if (mode.value === UiTransportMode.Relay) {
      const payload: ChatMessagePayload = {
        id: message.id,
        author: message.author,
        content: message.content,
        timestamp: message.timestamp
      };
      client.sendChatMessage(roomName, payload);
    } else if (rtc !== null) {
      rtc.broadcast(message);
    }
  }

  function sendTyping (isTyping: boolean): void {
    signaling.getClient()?.sendTyping(roomName, isTyping);
  }

  const state: RoomTransportState = {
    get room () { return roomName; },
    get mode () { return mode.value; },
    get hubPeerId () { return hubPeerId.value; },
    get peers () { return peers.value; },
    get isHub () { return isHub.value; }
  };

  return {
    join,
    leave,
    sendMessage,
    sendTyping,
    setHandlers,
    mode: readonly(mode),
    hubPeerId: readonly(hubPeerId),
    peers: readonly(peers),
    isHub: readonly(isHub),
    joined: readonly(joined),
    state
  };
}
