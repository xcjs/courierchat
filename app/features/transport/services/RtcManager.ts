import type { PeerIdentity } from '#shared/types/Signaling';
import type { ChatMessage } from '#shared/types/ChatMessage';

/**
 * Callbacks invoked by RtcManager when peer connections change state or
 * messages arrive.
 */
export interface RtcManagerHandlers {
  /** A DataChannel to a remote peer opened and is ready to send. */
  onPeerConnected?: (peerId: string) => void;
  /** A peer connection closed (cleanly or on error). */
  onPeerDisconnected?: (peerId: string) => void;
  /** A chat message arrived over a DataChannel from a remote peer. */
  onMessage?: (peerId: string, message: ChatMessage) => void;
  /** An SDP offer needs to be sent to the remote peer via signaling. */
  onSendOffer?: (to: string, sdp: string, label: string) => void;
  /** An SDP answer needs to be sent to the remote peer via signaling. */
  onSendAnswer?: (to: string, sdp: string) => void;
  /** An ICE candidate needs to be sent to the remote peer via signaling. */
  onSendIceCandidate?: (to: string, candidate: RTCIceCandidateInit) => void;
  /** A file-transfer control message (JSON) arrived on the file channel. */
  onFileControl?: (peerId: string, data: string) => void;
  /** A binary chunk arrived on the file channel. */
  onFileBinary?: (peerId: string, buffer: ArrayBuffer) => void;
}

/**
 * ICE server configuration. Empty iceServers means host-candidates only
 * (no STUN/TURN). When the in-process STUN server is enabled, callers add
 * it here.
 */
export interface RtcConfig {
  iceServers?: RTCIceServer[];
  /** DataChannel label prefix for negotiated channels. */
  channelLabel?: string;
}

const DEFAULT_LABEL = 'chat';
const FILE_LABEL = 'file';

interface PeerEntry {
  peer: PeerIdentity;
  pc: RTCPeerConnection;
  channel: RTCDataChannel | null;
  fileChannel: RTCDataChannel | null;
  /** True when the local peer initiated the offer (impolite peer). */
  initiator: boolean;
}

/**
 * RtcManager owns RTCPeerConnection instances for each remote peer in a room
 * and provides a simple send() API for chat messages over DataChannels.
 *
 * In mesh mode every peer gets a connection. In star mode the hub connects to
 * all leaves; leaves connect only to the hub. The caller decides which peers
 * to connect to; RtcManager just manages the connections it is told to create.
 *
 * The class is browser-only (uses RTCPeerConnection) but the handler-based
 * design keeps signaling concerns out, so the wiring is straightforward to
 * follow and test at the integration level.
 */
export class RtcManager {
  private peers = new Map<string, PeerEntry>();
  private handlers: RtcManagerHandlers = {};
  private readonly config: RtcConfig;
  private readonly localPeerId: string;

  constructor (localPeerId: string, config?: RtcConfig) {
    this.localPeerId = localPeerId;
    this.config = config ?? {};
  }

  setHandlers (handlers: RtcManagerHandlers): void {
    this.handlers = handlers;
  }

  /**
   * Create a new RTCPeerConnection for a remote peer and initiate an offer
   * (local peer is the initiator / impolite).
   */
  async connectToPeer (peer: PeerIdentity): Promise<void> {
    if (this.peers.has(peer.peerId)) { return; }
    const pc = this.createPeerConnection();
    const channel = pc.createDataChannel(this.config.channelLabel ?? DEFAULT_LABEL, {
      ordered: true
    });
    this.attachChannelHandlers(peer.peerId, channel);
    const fileChannel = pc.createDataChannel(FILE_LABEL, {
      ordered: true
    });
    this.attachFileChannelHandlers(peer.peerId, fileChannel);
    const entry: PeerEntry = { peer, pc, channel: null, fileChannel: null, initiator: true };
    this.peers.set(peer.peerId, entry);
    entry.channel = channel;
    entry.fileChannel = fileChannel;
    await this.createAndSendOffer(peer.peerId, pc);
  }

  /**
   * Handle an incoming SDP offer from a remote peer (local peer is polite).
   * Creates a PeerConnection if one does not already exist, sets the remote
   * description, creates and sends an answer.
   */
  async handleOffer (from: string, peer: PeerIdentity, sdp: string, _label: string): Promise<void> {
    let entry = this.peers.get(from);
    if (!entry) {
      const pc = this.createPeerConnection();
      pc.ondatachannel = (ev) => {
        if (ev.channel.label === FILE_LABEL) {
          this.attachFileChannelHandlers(from, ev.channel);
          const e = this.peers.get(from);
          if (e) { e.fileChannel = ev.channel; }
        } else {
          this.attachChannelHandlers(from, ev.channel);
          const e = this.peers.get(from);
          if (e) { e.channel = ev.channel; }
        }
      };
      entry = { peer, pc, channel: null, fileChannel: null, initiator: false };
      this.peers.set(from, entry);
    }
    await entry.pc.setRemoteDescription({ type: 'offer', sdp });
    const answer = await entry.pc.createAnswer();
    await entry.pc.setLocalDescription(answer);
    this.handlers.onSendAnswer?.(from, answer.sdp ?? '');
  }

  /**
   * Handle an SDP answer from a remote peer (completes the initiator's offer).
   */
  async handleAnswer (from: string, sdp: string): Promise<void> {
    const entry = this.peers.get(from);
    if (!entry) { return; }
    await entry.pc.setRemoteDescription({ type: 'answer', sdp });
  }

  /**
   * Handle a remote ICE candidate relayed via signaling.
   */
  async handleIceCandidate (from: string, candidate: RTCIceCandidateInit): Promise<void> {
    const entry = this.peers.get(from);
    if (!entry) { return; }
    await entry.pc.addIceCandidate(candidate);
  }

  /**
   * Send a chat message over the DataChannel to a specific peer.
   * Returns true if sent, false if no open channel.
   */
  sendTo (peerId: string, message: ChatMessage): boolean {
    const entry = this.peers.get(peerId);
    if (!entry?.channel) { return false; }
    if (entry.channel.readyState !== 'open') { return false; }
    entry.channel.send(JSON.stringify(message));
    return true;
  }

  /**
   * Get the file DataChannel for a peer, or null if not open.
   */
  getFileChannel (peerId: string): RTCDataChannel | null {
    const entry = this.peers.get(peerId);
    if (!entry?.fileChannel) { return null; }
    if (entry.fileChannel.readyState !== 'open') { return null; }
    return entry.fileChannel;
  }

  /**
   * Broadcast a chat message to all connected peers. Returns the list of
   * peerIds it was delivered to. In mesh mode this is all peers; in star
   * mode the hub broadcasts to all leaves, leaves send only to the hub.
   */
  broadcast (message: ChatMessage): string[] {
    const delivered: string[] = [];
    for (const [peerId, entry] of this.peers) {
      if (entry.channel && entry.channel.readyState === 'open') {
        entry.channel.send(JSON.stringify(message));
        delivered.push(peerId);
      }
    }
    return delivered;
  }

  /**
   * Close the connection to a specific peer and remove it.
   */
  disconnectPeer (peerId: string): void {
    const entry = this.peers.get(peerId);
    if (!entry) { return; }
    if (entry.fileChannel) { entry.fileChannel.close(); }
    if (entry.channel) { entry.channel.close(); }
    entry.pc.close();
    this.peers.delete(peerId);
    this.handlers.onPeerDisconnected?.(peerId);
  }

  /**
   * Close all peer connections.
   */
  disconnectAll (): void {
    for (const peerId of [...this.peers.keys()]) {
      this.disconnectPeer(peerId);
    }
  }

  getConnectedPeerIds (): string[] {
    return [...this.peers.entries()]
      .filter(([, e]) => e.channel?.readyState === 'open')
      .map(([id]) => id);
  }

  getPeer (peerId: string): PeerIdentity | undefined {
    return this.peers.get(peerId)?.peer;
  }

  getAllPeers (): PeerIdentity[] {
    return [...this.peers.values()].map(e => e.peer);
  }

  isHubOf (peerId: string): boolean {
    return this.localPeerId === peerId;
  }

  private createPeerConnection (): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: this.config.iceServers ?? []
    });
    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        // Find the peerId for this connection
        for (const [peerId, entry] of this.peers) {
          if (entry.pc === pc) {
            this.handlers.onSendIceCandidate?.(peerId, ev.candidate.toJSON());
            break;
          }
        }
      }
    };
    pc.onconnectionstatechange = () => {
      for (const [peerId, entry] of this.peers) {
        if (entry.pc === pc) {
          if (pc.connectionState === 'connected') {
            this.handlers.onPeerConnected?.(peerId);
          } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            this.handlers.onPeerDisconnected?.(peerId);
          }
          break;
        }
      }
    };
    return pc;
  }

  private attachChannelHandlers (peerId: string, channel: RTCDataChannel): void {
    channel.onopen = () => {
      this.handlers.onPeerConnected?.(peerId);
    };
    channel.onclose = () => {
      this.handlers.onPeerDisconnected?.(peerId);
    };
    channel.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as ChatMessage;
        this.handlers.onMessage?.(peerId, msg);
      } catch {
        // Ignore malformed messages
      }
    };
  }

  private attachFileChannelHandlers (peerId: string, channel: RTCDataChannel): void {
    channel.binaryType = 'arraybuffer';
    channel.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        this.handlers.onFileControl?.(peerId, ev.data);
      } else {
        this.handlers.onFileBinary?.(peerId, ev.data as ArrayBuffer);
      }
    };
  }

  private async createAndSendOffer (peerId: string, pc: RTCPeerConnection): Promise<void> {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.handlers.onSendOffer?.(peerId, offer.sdp ?? '', this.config.channelLabel ?? DEFAULT_LABEL);
  }
}
