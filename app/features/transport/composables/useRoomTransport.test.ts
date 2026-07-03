// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UiTransportMode } from '../types/Transport';
import { useRoomTransport } from './useRoomTransport';
import { Tier } from '#shared/types/Tier';
import { TransportMode } from '#shared/types/Signaling';
import type { PeerIdentity } from '#shared/types/Signaling';
import type { ChatMessage } from '#shared/types/ChatMessage';

const mockSignaling = vi.hoisted(() => ({
  getClient: vi.fn(),
  getCrypto: vi.fn().mockReturnValue(null),
  getEncryption: vi.fn().mockReturnValue(null),
  isConnected: { value: true },
  addHandlers: vi.fn(),
  iceServers: [{ urls: 'stun:test:3478' }]
}));

vi.mock('./useSignaling', () => ({
  useSignaling: () => mockSignaling
}));

const rtcMocks = vi.hoisted(() => ({
  setHandlers: vi.fn(),
  connectToPeer: vi.fn().mockResolvedValue(undefined),
  handleOffer: vi.fn().mockResolvedValue(undefined),
  handleAnswer: vi.fn().mockResolvedValue(undefined),
  handleIceCandidate: vi.fn().mockResolvedValue(undefined),
  broadcast: vi.fn().mockReturnValue([]),
  disconnectPeer: vi.fn(),
  disconnectAll: vi.fn(),
  getConnectedPeerIds: vi.fn().mockReturnValue([]),
  getFileChannel: vi.fn().mockReturnValue(null)
}));

vi.mock('../services/RtcManager', () => ({
  RtcManager: class {
    setHandlers = rtcMocks.setHandlers;
    connectToPeer = rtcMocks.connectToPeer;
    handleOffer = rtcMocks.handleOffer;
    handleAnswer = rtcMocks.handleAnswer;
    handleIceCandidate = rtcMocks.handleIceCandidate;
    broadcast = rtcMocks.broadcast;
    disconnectPeer = rtcMocks.disconnectPeer;
    disconnectAll = rtcMocks.disconnectAll;
    getConnectedPeerIds = rtcMocks.getConnectedPeerIds;
    getFileChannel = rtcMocks.getFileChannel;
  }
}));

const fileTransferMocks = vi.hoisted(() => ({
  setHandlers: vi.fn(),
  sendFile: vi.fn().mockResolvedValue('transfer-1'),
  handleControlMessage: vi.fn(),
  handleBinaryMessage: vi.fn()
}));

vi.mock('../services/FileTransferManager', () => ({
  FileTransferManager: class {
    setHandlers = fileTransferMocks.setHandlers;
    sendFile = fileTransferMocks.sendFile;
    handleControlMessage = fileTransferMocks.handleControlMessage;
    handleBinaryMessage = fileTransferMocks.handleBinaryMessage;
  }
}));

const mockClient = {
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
  sendChatMessage: vi.fn(),
  sendTyping: vi.fn(),
  sendOffer: vi.fn(),
  sendAnswer: vi.fn(),
  sendIceCandidate: vi.fn(),
  sendRequestRelay: vi.fn(),
  sendPing: vi.fn(),
  sendPeerMetrics: vi.fn(),
  getPeerId: vi.fn().mockReturnValue(null)
};

function makePeer (peerId: string, username = peerId): PeerIdentity {
  return { peerId, username, tiers: [Tier.Adult], publicKey: `pk-${username}`, encPublicKey: `enc-${username}` };
}

function makeMessage (id: string): ChatMessage {
  return { id, author: 'alice', content: 'hello', timestamp: Date.now() };
}

/**
 * Mock crypto + encryption pair for sendMessage tests. `sign` returns a fixed
 * signature; `encrypt` returns fixed wire fields (ciphertext replaces
 * plaintext). Mirrors the real MessageCrypto + MessageEncryption contract.
 */
function mockCryptoAndEncryption (overrides: { sign?: ReturnType<typeof vi.fn>; encrypt?: ReturnType<typeof vi.fn>; verify?: ReturnType<typeof vi.fn>; decrypt?: ReturnType<typeof vi.fn> } = {}): void {
  const sign = overrides.sign ?? vi.fn().mockResolvedValue('sig-b64');
  const encrypt = overrides.encrypt ?? vi.fn().mockResolvedValue({ content: 'ct-b64', encIv: 'iv-b64', encKeys: { 'peer-2': 'wk-b64' } });
  const verify = overrides.verify ?? vi.fn().mockResolvedValue(true);
  const decrypt = overrides.decrypt ?? vi.fn().mockResolvedValue('decrypted');
  mockSignaling.getCrypto.mockReturnValue({ sign, verify });
  mockSignaling.getEncryption.mockReturnValue({ encrypt, decrypt });
}

describe('useRoomTransport', () => {
  let transport: ReturnType<typeof useRoomTransport>;
  let registeredHandlers: Record<string, ((...args: any[]) => void) | undefined>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    rtcMocks.connectToPeer.mockResolvedValue(undefined);
    rtcMocks.broadcast.mockReturnValue([]);
    rtcMocks.getConnectedPeerIds.mockReturnValue([]);
    rtcMocks.getFileChannel.mockReturnValue(null);
    fileTransferMocks.sendFile.mockResolvedValue('transfer-1');
    mockSignaling.getClient.mockReturnValue(mockClient);
    mockSignaling.getCrypto.mockReturnValue(null);
    mockSignaling.getEncryption.mockReturnValue(null);
    mockSignaling.isConnected.value = true;
    Object.values(mockClient).forEach((fn) => {
      if (typeof fn === 'function') { (fn as ReturnType<typeof vi.fn>).mockClear(); }
    });
    registeredHandlers = {};
    transport = useRoomTransport('test-room');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function captureHandlers (): void {
    const calls = mockSignaling.addHandlers.mock.calls;
    const last = calls[calls.length - 1]?.[0] as Record<string, ((...args: any[]) => void) | undefined> | undefined;
    if (last) {
      for (const key of Object.keys(last)) {
        registeredHandlers[key] = last[key];
      }
    }
  }

  describe('initial state', () => {
    it('starts offline with no peers and not joined', () => {
      expect(transport.mode.value).toBe(UiTransportMode.Offline);
      expect(transport.hubPeerId.value).toBeNull();
      expect(transport.peers.value).toEqual([]);
      expect(transport.isHub.value).toBe(false);
      expect(transport.joined.value).toBe(false);
      expect(transport.state.room).toBe('test-room');
    });
  });

  describe('join', () => {
    it('does nothing without a client', () => {
      mockSignaling.getClient.mockReturnValue(null);
      transport.join();
      expect(mockClient.joinRoom).not.toHaveBeenCalled();
      expect(transport.joined.value).toBe(false);
    });

    it('does nothing when not connected', () => {
      mockSignaling.isConnected.value = false;
      transport.join();
      expect(mockClient.joinRoom).not.toHaveBeenCalled();
    });

    it('registers handlers, sets joined, calls joinRoom', () => {
      transport.join();
      expect(mockSignaling.addHandlers).toHaveBeenCalled();
      expect(mockClient.joinRoom).toHaveBeenCalledWith('test-room', undefined);
      expect(transport.joined.value).toBe(true);
    });

    it('starts metrics loop on join', () => {
      transport.join();
      vi.advanceTimersByTime(10_000);
      expect(mockClient.sendPing).toHaveBeenCalledTimes(1);
    });
  });

  describe('leave', () => {
    it('does nothing when not joined', () => {
      transport.leave();
      expect(mockClient.leaveRoom).not.toHaveBeenCalled();
    });

    it('tears down and sends leaveRoom', () => {
      transport.join();
      captureHandlers();
      registeredHandlers.onWelcome!('me');
      registeredHandlers.onTransportMode!('test-room', TransportMode.Mesh);
      // Trigger rtc creation by having a peer join
      registeredHandlers.onPeerJoined!(makePeer('peer-2'), 'test-room', false);
      transport.leave();
      expect(transport.joined.value).toBe(false);
      expect(mockClient.leaveRoom).toHaveBeenCalledWith('test-room');
      expect(rtcMocks.disconnectAll).toHaveBeenCalled();
      expect(transport.peers.value).toEqual([]);
      expect(transport.mode.value).toBe(UiTransportMode.Offline);
    });

    it('stops metrics loop on leave', () => {
      transport.join();
      transport.leave();
      vi.advanceTimersByTime(10_000);
      expect(mockClient.sendPing).not.toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    it('returns empty when no client', async () => {
      mockSignaling.getClient.mockReturnValue(null);
      expect(await transport.sendMessage(makeMessage('m1'))).toEqual([]);
    });

    it('sends via relay in relay mode and returns empty', async () => {
      mockCryptoAndEncryption();
      transport.join();
      captureHandlers();
      registeredHandlers.onWelcome!('me');
      registeredHandlers.onTransportMode!('test-room', TransportMode.Relay);
      const msg = makeMessage('m1');
      const result = await transport.sendMessage(msg);
      expect(mockClient.sendChatMessage).toHaveBeenCalledWith('test-room', expect.objectContaining({ id: 'm1', signature: 'sig-b64', content: 'ct-b64', encIv: 'iv-b64', encKeys: { 'peer-2': 'wk-b64' } }));
      expect(result).toEqual([]);
    });

    it('broadcasts via rtc in mesh mode and returns delivered peerIds', async () => {
      mockCryptoAndEncryption();
      transport.join();
      captureHandlers();
      registeredHandlers.onWelcome!('me');
      registeredHandlers.onTransportMode!('test-room', TransportMode.Mesh);
      // Trigger rtc creation by having a peer join
      registeredHandlers.onPeerJoined!(makePeer('peer-2'), 'test-room', false);
      rtcMocks.broadcast.mockReturnValue(['peer-2', 'peer-3']);
      const msg = makeMessage('m1');
      const result = await transport.sendMessage(msg);
      expect(rtcMocks.broadcast).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1', signature: 'sig-b64', content: 'ct-b64', encIv: 'iv-b64' }));
      expect(result).toEqual(['peer-2', 'peer-3']);
    });

    it('signs message with crypto when available', async () => {
      const sign = vi.fn().mockResolvedValue('sig-b64');
      const encrypt = vi.fn().mockResolvedValue({ content: 'ct-b64', encIv: 'iv-b64', encKeys: {} });
      mockCryptoAndEncryption({ sign, encrypt });
      transport.join();
      captureHandlers();
      registeredHandlers.onWelcome!('me');
      registeredHandlers.onTransportMode!('test-room', TransportMode.Relay);
      const msg = makeMessage('m1');
      await transport.sendMessage(msg);
      expect(sign).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1', author: 'alice', content: 'hello' }));
      expect(encrypt).toHaveBeenCalledWith('hello', 'test-room', expect.any(Array), 'me');
      expect(mockClient.sendChatMessage).toHaveBeenCalledWith('test-room', expect.objectContaining({ signature: 'sig-b64' }));
      mockSignaling.getCrypto.mockReturnValue(null);
      mockSignaling.getEncryption.mockReturnValue(null);
    });

    it('does not send when crypto is unavailable', async () => {
      mockSignaling.getCrypto.mockReturnValue(null);
      mockSignaling.getEncryption.mockReturnValue(null);
      transport.join();
      captureHandlers();
      registeredHandlers.onTransportMode!('test-room', TransportMode.Relay);
      const msg = makeMessage('m1');
      const result = await transport.sendMessage(msg);
      expect(mockClient.sendChatMessage).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('does not send when encryption is unavailable', async () => {
      const sign = vi.fn().mockResolvedValue('sig-b64');
      mockSignaling.getCrypto.mockReturnValue({ sign });
      mockSignaling.getEncryption.mockReturnValue(null);
      transport.join();
      captureHandlers();
      registeredHandlers.onTransportMode!('test-room', TransportMode.Relay);
      const msg = makeMessage('m1');
      const result = await transport.sendMessage(msg);
      expect(mockClient.sendChatMessage).not.toHaveBeenCalled();
      expect(result).toEqual([]);
      mockSignaling.getCrypto.mockReturnValue(null);
    });
  });

  describe('sendTyping', () => {
    it('delegates to client.sendTyping', () => {
      transport.join();
      transport.sendTyping(true);
      expect(mockClient.sendTyping).toHaveBeenCalledWith('test-room', true);
    });
  });

  describe('onPeerJoined handler', () => {
    it('adds peer to list and calls external handler', () => {
      const onPeerJoined = vi.fn();
      transport.setHandlers({ onPeerJoined });
      transport.join();
      captureHandlers();

      const peer = makePeer('peer-2', 'bob');
      registeredHandlers.onPeerJoined!(peer, 'test-room', false);

      expect(transport.peers.value).toHaveLength(1);
      expect(transport.peers.value[0]?.peerId).toBe('peer-2');
      expect(onPeerJoined).toHaveBeenCalledWith(peer);
    });

    it('ignores peers from other rooms', () => {
      transport.join();
      captureHandlers();
      registeredHandlers.onPeerJoined!(makePeer('peer-2'), 'other-room', false);
      expect(transport.peers.value).toHaveLength(0);
    });

    it('does not add duplicate peers', () => {
      transport.join();
      captureHandlers();
      const peer = makePeer('peer-2');
      registeredHandlers.onPeerJoined!(peer, 'test-room', false);
      registeredHandlers.onPeerJoined!(peer, 'test-room', false);
      expect(transport.peers.value).toHaveLength(1);
    });

    it('connects to new peer in mesh mode after joined', () => {
      transport.join();
      captureHandlers();
      registeredHandlers.onWelcome!('me');
      registeredHandlers.onTransportMode!('test-room', TransportMode.Mesh);
      const peer = makePeer('peer-2');
      registeredHandlers.onPeerJoined!(peer, 'test-room', false);
      expect(rtcMocks.connectToPeer).toHaveBeenCalledWith(peer);
    });

    it('does not connect to self', () => {
      transport.join();
      captureHandlers();
      registeredHandlers.onWelcome!('me');
      registeredHandlers.onTransportMode!('test-room', TransportMode.Mesh);
      registeredHandlers.onPeerJoined!(makePeer('me'), 'test-room', false);
      expect(rtcMocks.connectToPeer).not.toHaveBeenCalled();
    });
  });

  describe('onPeerLeft handler', () => {
    it('removes peer and calls external handler', () => {
      const onPeerLeft = vi.fn();
      transport.setHandlers({ onPeerLeft });
      transport.join();
      captureHandlers();
      const peer = makePeer('peer-2');
      registeredHandlers.onPeerJoined!(peer, 'test-room', false);
      registeredHandlers.onPeerLeft!('peer-2', 'test-room', false);
      expect(transport.peers.value).toHaveLength(0);
      expect(rtcMocks.disconnectPeer).toHaveBeenCalledWith('peer-2');
      expect(onPeerLeft).toHaveBeenCalledWith('peer-2');
    });

    it('ignores other rooms', () => {
      transport.join();
      captureHandlers();
      registeredHandlers.onPeerLeft!('peer-2', 'other-room', false);
      expect(rtcMocks.disconnectPeer).not.toHaveBeenCalled();
    });
  });

  describe('onRoomDestroyed handler', () => {
    it('pushes notification and leaves', () => {
      transport.join();
      captureHandlers();
      registeredHandlers.onRoomDestroyed!('test-room');
      expect(transport.joined.value).toBe(false);
      expect(mockClient.leaveRoom).toHaveBeenCalled();
    });

    it('ignores other rooms', () => {
      transport.join();
      captureHandlers();
      registeredHandlers.onRoomDestroyed!('other-room');
      expect(transport.joined.value).toBe(true);
    });
  });

  describe('onTransportMode handler', () => {
    it('updates mode to mesh', () => {
      transport.join();
      captureHandlers();
      registeredHandlers.onTransportMode!('test-room', TransportMode.Mesh);
      expect(transport.mode.value).toBe(UiTransportMode.Mesh);
    });

    it('updates mode to star with hub', () => {
      transport.join();
      captureHandlers();
      registeredHandlers.onWelcome!('me');
      registeredHandlers.onTransportMode!('test-room', TransportMode.Star, 'hub-1');
      expect(transport.mode.value).toBe(UiTransportMode.Star);
      expect(transport.hubPeerId.value).toBe('hub-1');
      expect(transport.isHub.value).toBe(false);
    });

    it('sets isHub when hubId matches localPeerId', () => {
      transport.join();
      captureHandlers();
      registeredHandlers.onWelcome!('me');
      registeredHandlers.onTransportMode!('test-room', TransportMode.Star, 'me');
      expect(transport.isHub.value).toBe(true);
    });

    it('tears down rtc on relay mode', () => {
      transport.join();
      captureHandlers();
      registeredHandlers.onWelcome!('me');
      registeredHandlers.onTransportMode!('test-room', TransportMode.Mesh);
      // Trigger rtc creation
      registeredHandlers.onPeerJoined!(makePeer('peer-2'), 'test-room', false);
      registeredHandlers.onTransportMode!('test-room', TransportMode.Relay);
      expect(rtcMocks.disconnectAll).toHaveBeenCalled();
      expect(transport.mode.value).toBe(UiTransportMode.Relay);
    });

    it('ignores other rooms', () => {
      transport.join();
      captureHandlers();
      registeredHandlers.onTransportMode!('other-room', TransportMode.Mesh);
      expect(transport.mode.value).toBe(UiTransportMode.Offline);
    });
  });

  describe('onHubElected handler', () => {
    it('updates hub and isHub', () => {
      transport.join();
      captureHandlers();
      registeredHandlers.onWelcome!('me');
      registeredHandlers.onHubElected!('test-room', 'me', 'alice');
      expect(transport.hubPeerId.value).toBe('me');
      expect(transport.isHub.value).toBe(true);
    });

    it('connects to all peers when becoming hub in star mode', () => {
      transport.join();
      captureHandlers();
      registeredHandlers.onWelcome!('me');
      registeredHandlers.onTransportMode!('test-room', TransportMode.Star, 'other-hub');
      const peer1 = makePeer('peer-2');
      const peer2 = makePeer('peer-3');
      registeredHandlers.onPeerJoined!(peer1, 'test-room', false);
      registeredHandlers.onPeerJoined!(peer2, 'test-room', false);
      // Now become hub
      registeredHandlers.onHubElected!('test-room', 'me', 'alice');
      expect(rtcMocks.connectToPeer).toHaveBeenCalledWith(peer1);
      expect(rtcMocks.connectToPeer).toHaveBeenCalledWith(peer2);
    });

    it('ignores other rooms', () => {
      transport.join();
      captureHandlers();
      registeredHandlers.onHubElected!('other-room', 'me', 'alice');
      expect(transport.hubPeerId.value).toBeNull();
    });
  });

  describe('relay handlers', () => {
    it('onRelayBroadcast drops unsigned message', async () => {
      const onMessage = vi.fn();
      transport.setHandlers({ onMessage });
      transport.join();
      captureHandlers();
      const peer = makePeer('peer-2', 'bob');
      registeredHandlers.onPeerJoined!(peer, 'test-room', false);
      const verify = vi.fn();
      const decrypt = vi.fn();
      mockSignaling.getCrypto.mockReturnValue({ verify });
      mockSignaling.getEncryption.mockReturnValue({ decrypt });
      const msg = { id: 'm1', author: 'bob', content: 'hi', timestamp: 123 };
      registeredHandlers.onRelayBroadcast!('test-room', msg);
      await vi.waitFor(() => { expect(onMessage).not.toHaveBeenCalled(); });
      expect(verify).not.toHaveBeenCalled();
      expect(decrypt).not.toHaveBeenCalled();
      mockSignaling.getCrypto.mockReturnValue(null);
      mockSignaling.getEncryption.mockReturnValue(null);
    });

    it('onRelayBroadcast ignores other rooms', async () => {
      const onMessage = vi.fn();
      transport.setHandlers({ onMessage });
      transport.join();
      captureHandlers();
      registeredHandlers.onRelayBroadcast!('other-room', { id: 'm1', author: 'a', content: 'b', timestamp: 0 });
      await vi.waitFor(() => { expect(onMessage).not.toHaveBeenCalled(); });
    });

    it('onRelayBroadcast drops message when signature verification fails', async () => {
      const onMessage = vi.fn();
      transport.setHandlers({ onMessage });
      transport.join();
      captureHandlers();
      registeredHandlers.onWelcome!('me');
      // Add a peer with a public key so verification is attempted
      const peer = makePeer('peer-2', 'bob');
      registeredHandlers.onPeerJoined!(peer, 'test-room', false);
      const verify = vi.fn().mockResolvedValue(false);
      const decrypt = vi.fn().mockResolvedValue('hi');
      mockSignaling.getCrypto.mockReturnValue({ verify });
      mockSignaling.getEncryption.mockReturnValue({ decrypt });
      const msg = { id: 'm1', author: 'bob', content: 'ct', timestamp: 123, signature: 'bad-sig', encIv: 'iv', encKeys: { me: 'wk' } };
      registeredHandlers.onRelayBroadcast!('test-room', msg);
      await vi.waitFor(() => { expect(verify).toHaveBeenCalled(); });
      expect(onMessage).not.toHaveBeenCalled();
      mockSignaling.getCrypto.mockReturnValue(null);
      mockSignaling.getEncryption.mockReturnValue(null);
    });

    it('onRelayBroadcast delivers message when signature verification passes', async () => {
      const onMessage = vi.fn();
      transport.setHandlers({ onMessage });
      transport.join();
      captureHandlers();
      registeredHandlers.onWelcome!('me');
      const peer = makePeer('peer-2', 'bob');
      registeredHandlers.onPeerJoined!(peer, 'test-room', false);
      const verify = vi.fn().mockResolvedValue(true);
      const decrypt = vi.fn().mockResolvedValue('hi');
      mockSignaling.getCrypto.mockReturnValue({ verify });
      mockSignaling.getEncryption.mockReturnValue({ decrypt });
      const msg = { id: 'm1', author: 'bob', content: 'ct', timestamp: 123, signature: 'good-sig', encIv: 'iv', encKeys: { me: 'wk' } };
      registeredHandlers.onRelayBroadcast!('test-room', msg);
      await vi.waitFor(() => { expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1', author: 'bob', content: 'hi' })); });
      expect(decrypt).toHaveBeenCalledWith({ content: 'ct', encIv: 'iv', encKeys: { me: 'wk' } }, 'test-room', peer.encPublicKey, 'me');
      mockSignaling.getCrypto.mockReturnValue(null);
      mockSignaling.getEncryption.mockReturnValue(null);
    });

    it('onRelayBroadcast drops message when decryption fails', async () => {
      const onMessage = vi.fn();
      transport.setHandlers({ onMessage });
      transport.join();
      captureHandlers();
      registeredHandlers.onWelcome!('me');
      const peer = makePeer('peer-2', 'bob');
      registeredHandlers.onPeerJoined!(peer, 'test-room', false);
      const verify = vi.fn();
      const decrypt = vi.fn().mockResolvedValue(null);
      mockSignaling.getCrypto.mockReturnValue({ verify });
      mockSignaling.getEncryption.mockReturnValue({ decrypt });
      const msg = { id: 'm1', author: 'bob', content: 'ct', timestamp: 123, signature: 'sig', encIv: 'iv', encKeys: { me: 'wk' } };
      registeredHandlers.onRelayBroadcast!('test-room', msg);
      await vi.waitFor(() => { expect(decrypt).toHaveBeenCalled(); });
      expect(verify).not.toHaveBeenCalled();
      expect(onMessage).not.toHaveBeenCalled();
      mockSignaling.getCrypto.mockReturnValue(null);
      mockSignaling.getEncryption.mockReturnValue(null);
    });

    it('onRelayBroadcast drops message when peer has no matching publicKey', async () => {
      const onMessage = vi.fn();
      transport.setHandlers({ onMessage });
      transport.join();
      captureHandlers();
      // No peer added — so author 'bob' has no publicKey in the peer list.
      const verify = vi.fn();
      const decrypt = vi.fn();
      mockSignaling.getCrypto.mockReturnValue({ verify });
      mockSignaling.getEncryption.mockReturnValue({ decrypt });
      const msg = { id: 'm1', author: 'bob', content: 'hi', timestamp: 123, signature: 'some-sig', encIv: 'iv', encKeys: { me: 'wk' } };
      registeredHandlers.onRelayBroadcast!('test-room', msg);
      await vi.waitFor(() => { expect(onMessage).not.toHaveBeenCalled(); });
      mockSignaling.getCrypto.mockReturnValue(null);
      mockSignaling.getEncryption.mockReturnValue(null);
    });

    it('onRelayBroadcast drops unencrypted message (no encIv/encKeys)', async () => {
      const onMessage = vi.fn();
      transport.setHandlers({ onMessage });
      transport.join();
      captureHandlers();
      registeredHandlers.onWelcome!('me');
      const peer = makePeer('peer-2', 'bob');
      registeredHandlers.onPeerJoined!(peer, 'test-room', false);
      const verify = vi.fn().mockResolvedValue(true);
      const decrypt = vi.fn();
      mockSignaling.getCrypto.mockReturnValue({ verify });
      mockSignaling.getEncryption.mockReturnValue({ decrypt });
      const msg = { id: 'm1', author: 'bob', content: 'hi', timestamp: 123, signature: 'sig' };
      registeredHandlers.onRelayBroadcast!('test-room', msg);
      await vi.waitFor(() => { expect(onMessage).not.toHaveBeenCalled(); });
      expect(decrypt).not.toHaveBeenCalled();
      mockSignaling.getCrypto.mockReturnValue(null);
      mockSignaling.getEncryption.mockReturnValue(null);
    });

    it('onTyping calls external handler', () => {
      const onTyping = vi.fn();
      transport.setHandlers({ onTyping });
      transport.join();
      captureHandlers();
      registeredHandlers.onTyping!('test-room', 'bob', true);
      expect(onTyping).toHaveBeenCalledWith('bob', true);
    });

    it('onTyping ignores other rooms', () => {
      const onTyping = vi.fn();
      transport.setHandlers({ onTyping });
      transport.join();
      captureHandlers();
      registeredHandlers.onTyping!('other-room', 'bob', true);
      expect(onTyping).not.toHaveBeenCalled();
    });
  });

  describe('WebRTC relay handlers', () => {
    it('onOfferRelayed calls rtc.handleOffer with peer', () => {
      transport.join();
      captureHandlers();
      const peer = makePeer('peer-2');
      registeredHandlers.onPeerJoined!(peer, 'test-room', false);
      registeredHandlers.onTransportMode!('test-room', TransportMode.Mesh);
      registeredHandlers.onOfferRelayed!('peer-2', 'sdp-offer', 'chat');
      expect(rtcMocks.handleOffer).toHaveBeenCalledWith('peer-2', peer, 'sdp-offer', 'chat');
    });

    it('onOfferRelayed ignores unknown peer', () => {
      transport.join();
      captureHandlers();
      registeredHandlers.onOfferRelayed!('unknown', 'sdp', 'chat');
      expect(rtcMocks.handleOffer).not.toHaveBeenCalled();
    });

    it('onAnswerRelayed calls rtc.handleAnswer', () => {
      transport.join();
      captureHandlers();
      registeredHandlers.onWelcome!('me');
      registeredHandlers.onTransportMode!('test-room', TransportMode.Mesh);
      // Trigger rtc creation
      registeredHandlers.onPeerJoined!(makePeer('peer-2'), 'test-room', false);
      registeredHandlers.onAnswerRelayed!('peer-2', 'sdp-answer');
      expect(rtcMocks.handleAnswer).toHaveBeenCalledWith('peer-2', 'sdp-answer');
    });

    it('onIceCandidateRelayed calls rtc.handleIceCandidate', () => {
      transport.join();
      captureHandlers();
      registeredHandlers.onWelcome!('me');
      registeredHandlers.onTransportMode!('test-room', TransportMode.Mesh);
      // Trigger rtc creation
      registeredHandlers.onPeerJoined!(makePeer('peer-2'), 'test-room', false);
      registeredHandlers.onIceCandidateRelayed!('peer-2', 'cand', 0, 'mid');
      expect(rtcMocks.handleIceCandidate).toHaveBeenCalledWith('peer-2', { candidate: 'cand', sdpMLineIndex: 0, sdpMid: 'mid' });
    });
  });

  describe('onPong handler', () => {
    it('computes RTT and sends peer metrics', () => {
      transport.join();
      captureHandlers();
      const sentAt = Date.now();
      vi.advanceTimersByTime(50);
      registeredHandlers.onPong!('ping-1', sentAt);
      expect(mockClient.sendPeerMetrics).toHaveBeenCalledWith('test-room', expect.objectContaining({ latencyMs: expect.any(Number) }));
    });
  });

  describe('sendFile', () => {
    it('returns null in relay mode', async () => {
      transport.join();
      captureHandlers();
      registeredHandlers.onTransportMode!('test-room', TransportMode.Relay);
      const result = await transport.sendFile('peer-2', new File([], 'test.txt'));
      expect(result).toBeNull();
    });

    it('returns null when no file channel', async () => {
      transport.join();
      captureHandlers();
      registeredHandlers.onTransportMode!('test-room', TransportMode.Mesh);
      rtcMocks.getFileChannel.mockReturnValue(null);
      const result = await transport.sendFile('peer-2', new File([], 'test.txt'));
      expect(result).toBeNull();
    });

    it('delegates to fileTransfer when channel exists', async () => {
      transport.join();
      captureHandlers();
      registeredHandlers.onTransportMode!('test-room', TransportMode.Mesh);
      const channel = { readyState: 'open' } as unknown as RTCDataChannel;
      rtcMocks.getFileChannel.mockReturnValue(channel);
      const file = new File(['data'], 'test.txt');
      const result = await transport.sendFile('peer-2', file);
      expect(result).toBe('transfer-1');
      expect(fileTransferMocks.sendFile).toHaveBeenCalledWith('peer-2', file, channel);
    });

    it('returns null on send error', async () => {
      transport.join();
      captureHandlers();
      registeredHandlers.onTransportMode!('test-room', TransportMode.Mesh);
      const channel = { readyState: 'open' } as unknown as RTCDataChannel;
      rtcMocks.getFileChannel.mockReturnValue(channel);
      fileTransferMocks.sendFile.mockRejectedValue(new Error('fail'));
      const result = await transport.sendFile('peer-2', new File([], 'test.txt'));
      expect(result).toBeNull();
    });
  });

  describe('setFileTransferHandlers', () => {
    it('delegates to fileTransfer', () => {
      const handlers = { onTransferComplete: vi.fn() };
      transport.setFileTransferHandlers(handlers);
      expect(fileTransferMocks.setHandlers).toHaveBeenCalledWith(handlers);
    });
  });

  describe('state object', () => {
    it('reflects current reactive values', () => {
      transport.join();
      captureHandlers();
      registeredHandlers.onTransportMode!('test-room', TransportMode.Mesh);
      const peer = makePeer('peer-2');
      registeredHandlers.onPeerJoined!(peer, 'test-room', false);
      expect(transport.state.room).toBe('test-room');
      expect(transport.state.mode).toBe(UiTransportMode.Mesh);
      expect(transport.state.peers).toHaveLength(1);
      expect(transport.state.isHub).toBe(false);
    });
  });
});
