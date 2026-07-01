import { readonly, ref, type DeepReadonly, type Ref } from 'vue';
import { RtcManager } from '../services/RtcManager';
import type { RtcManagerHandlers } from '../services/RtcManager';
import { FileTransferManager } from '../services/FileTransferManager';
import type { FileTransferHandlers } from '../services/FileTransferManager';
import type { RoomTransportState } from '../types/Transport';
import { UiTransportMode } from '../types/Transport';
import { useSignaling } from './useSignaling';
import { useNotificationsStore } from '~/stores/Notifications';
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
  sendMessage: (message: ChatMessage) => string[];
  sendTyping: (isTyping: boolean) => void;
  sendFile: (peerId: string, file: File) => Promise<string | null>;
  setFileTransferHandlers: (handlers: FileTransferHandlers) => void;
  setHandlers: (handlers: {
    onMessage?: (message: ChatMessage) => void;
    onPeerJoined?: (peer: PeerIdentity) => void;
    onPeerLeft?: (peerId: string) => void;
    onTyping?: (username: string, isTyping: boolean) => void;
  }) => void;
  mode: Readonly<Ref<UiTransportMode>>;
  hubPeerId: Readonly<Ref<string | null>>;
  peers: DeepReadonly<Ref<PeerIdentity[]>>;
  isHub: Readonly<Ref<boolean>>;
  joined: Readonly<Ref<boolean>>;
  state: RoomTransportState;
}

const RELAY_PROBE_DELAY_MS = 5_000;
const METRIC_PING_INTERVAL_MS = 10_000;

export function useRoomTransport (roomName: string): UseRoomTransportReturn {
  const signaling = useSignaling();

  const mode = ref<UiTransportMode>(UiTransportMode.Offline);
  const hubPeerId = ref<string | null>(null);
  const peers = ref<PeerIdentity[]>([]);
  const isHub = ref(false);
  const joined = ref(false);
  const localPeerId = ref<string | null>(null);

  let rtc: RtcManager | null = null;
  const fileTransfer = new FileTransferManager();
  let handlersRegistered = false;
  let relayProbeTimer: ReturnType<typeof setTimeout> | null = null;
  let metricsTimer: ReturnType<typeof setInterval> | null = null;
  let pingCounter = 0;
  const pendingPings = new Map<string, number>();

  /** Callbacks invoked when messages arrive over any transport. */
  interface RoomTransportHandlers {
    onMessage?: (message: ChatMessage) => void;
    onPeerJoined?: (peer: PeerIdentity) => void;
    onPeerLeft?: (peerId: string) => void;
    onTyping?: (username: string, isTyping: boolean) => void;
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
      onFileControl: (peerId, data) => { fileTransfer.handleControlMessage(peerId, data); },
      onFileBinary: (peerId, buffer) => { fileTransfer.handleBinaryMessage(peerId, buffer); },
      onPeerConnected: () => {
        // A DataChannel opened; cancel any pending relay probe since we have
        // at least one reachable peer now.
        if (relayProbeTimer !== null) {
          clearTimeout(relayProbeTimer);
          relayProbeTimer = null;
        }
      },
      onPeerDisconnected: (peerId) => {
        if (mode.value !== UiTransportMode.Relay) { externalHandlers.onPeerLeft?.(peerId); }
        // If we just lost our last connected peer in mesh/star, probe for
        // relay fallback after a short grace period (allows reconnection).
        if (mode.value === UiTransportMode.Mesh || mode.value === UiTransportMode.Star) {
          if (rtc !== null && rtc.getConnectedPeerIds().length === 0 && peers.value.length > 0) {
            scheduleRelayProbe();
          }
        }
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
        useNotificationsStore().push(`Room "${room}" was destroyed`, 'info');
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
      },
      onPong: (id, sentAt) => {
        const rtt = Date.now() - sentAt;
        pendingPings.delete(id);
        signaling.getClient()?.sendPeerMetrics(roomName, { latencyMs: Math.max(0, rtt) });
      },
      onTyping: (room, username, isTyping) => {
        if (room !== roomName) { return; }
        externalHandlers.onTyping?.(username, isTyping);
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
    startMetricsLoop();
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
    if (relayProbeTimer !== null) {
      clearTimeout(relayProbeTimer);
      relayProbeTimer = null;
    }
    stopMetricsLoop();
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
   * it is sent to the server for relay-broadcast. Returns the list of peer IDs
   * the message was delivered to (empty in relay mode since delivery is
   * server-mediated and unconfirmed).
   */
  function sendMessage (message: ChatMessage): string[] {
    const client = signaling.getClient();
    if (!client) { return []; }
    if (mode.value === UiTransportMode.Relay) {
      const payload: ChatMessagePayload = {
        id: message.id,
        author: message.author,
        content: message.content,
        timestamp: message.timestamp
      };
      client.sendChatMessage(roomName, payload);
      return [];
    } else if (rtc !== null) {
      return rtc.broadcast(message);
    }
    return [];
  }

  function sendTyping (isTyping: boolean): void {
    signaling.getClient()?.sendTyping(roomName, isTyping);
  }

  function setFileTransferHandlers (handlers: FileTransferHandlers): void {
    fileTransfer.setHandlers(handlers);
  }

  async function sendFile (peerId: string, file: File): Promise<string | null> {
    if (mode.value === UiTransportMode.Relay) { return null; }
    const r = ensureRtc();
    const channel = r.getFileChannel(peerId);
    if (!channel) { return null; }
    try {
      return await fileTransfer.sendFile(peerId, file, channel);
    } catch {
      return null;
    }
  }

  /**
   * Schedule a relay-fallback probe. After a grace period, if we still have
   * zero connected DataChannels in mesh/star mode, request relay fallback
   * from the server. The server transitions the room to Relay mode and
   * broadcasts it; our onTransportMode handler tears down RTC.
   */
  function scheduleRelayProbe (): void {
    if (relayProbeTimer !== null) { clearTimeout(relayProbeTimer); }
    relayProbeTimer = setTimeout(() => {
      relayProbeTimer = null;
      if (!joined.value) { return; }
      if (mode.value !== UiTransportMode.Mesh && mode.value !== UiTransportMode.Star) { return; }
      if (rtc === null || rtc.getConnectedPeerIds().length === 0) {
        signaling.getClient()?.sendRequestRelay(roomName);
      }
    }, RELAY_PROBE_DELAY_MS);
  }

  /**
   * Start a periodic latency probe. Every METRIC_PING_INTERVAL_MS the client
   * sends a Ping with a unique id and a timestamp; the server echoes a Pong.
   * The onPong handler computes RTT and reports it via PeerMetrics so the
   * hub election chain can use it (ADR-0002 §resolved #2: peers report
   * metrics passively).
   */
  function startMetricsLoop (): void {
    stopMetricsLoop();
    metricsTimer = setInterval(() => {
      const client = signaling.getClient();
      if (!client || !joined.value) { return; }
      const id = `ping-${++pingCounter}`;
      pendingPings.set(id, Date.now());
      client.sendPing(id, Date.now());
    }, METRIC_PING_INTERVAL_MS);
  }

  function stopMetricsLoop (): void {
    if (metricsTimer !== null) {
      clearInterval(metricsTimer);
      metricsTimer = null;
    }
    pendingPings.clear();
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
    sendFile,
    setFileTransferHandlers,
    setHandlers,
    mode: readonly(mode),
    hubPeerId: readonly(hubPeerId),
    peers: readonly(peers),
    isHub: readonly(isHub),
    joined: readonly(joined),
    state
  };
}
