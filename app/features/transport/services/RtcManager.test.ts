import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RtcManager, type RtcManagerHandlers } from './RtcManager';
import { Tier } from '#shared/types/Tier';
import type { PeerIdentity } from '#shared/types/Signaling';
import type { ChatMessage } from '#shared/types/ChatMessage';

interface MockDataChannel {
  label: string;
  readyState: RTCDataChannelState;
  binaryType: BinaryType;
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onmessage: ((ev: { data: string | ArrayBuffer }) => void) | null;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

function makeChannel (label: string): MockDataChannel {
  return {
    label,
    readyState: 'open',
    binaryType: 'blob',
    onopen: null,
    onclose: null,
    onmessage: null,
    send: vi.fn(),
    close: vi.fn()
  };
}

interface MockPC {
  connectionState: RTCPeerConnectionState;
  onicecandidate: ((ev: { candidate: RTCIceCandidate | null }) => void) | null;
  onconnectionstatechange: (() => void) | null;
  ondatachannel: ((ev: { channel: MockDataChannel }) => void) | null;
  createDataChannel: ReturnType<typeof vi.fn>;
  setRemoteDescription: ReturnType<typeof vi.fn>;
  createAnswer: ReturnType<typeof vi.fn>;
  createOffer: ReturnType<typeof vi.fn>;
  setLocalDescription: ReturnType<typeof vi.fn>;
  addIceCandidate: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

function makeMockPC (): MockPC {
  return {
    connectionState: 'new',
    onicecandidate: null,
    onconnectionstatechange: null,
    ondatachannel: null,
    createDataChannel: vi.fn((label: string) => makeChannel(label)),
    setRemoteDescription: vi.fn().mockResolvedValue(undefined),
    createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'answer-sdp' }),
    createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'offer-sdp' }),
    setLocalDescription: vi.fn().mockResolvedValue(undefined),
    addIceCandidate: vi.fn().mockResolvedValue(undefined),
    close: vi.fn()
  };
}

let createdPCs: MockPC[];

function installRTCPeerConnection (): void {
  createdPCs = [];
  class FakeRTCPeerConnection {
    constructor (_config: RTCConfiguration) {
      const pc = makeMockPC();
      createdPCs.push(pc);
      return pc;
    }
  }
  vi.stubGlobal('RTCPeerConnection', FakeRTCPeerConnection);
}

function makePeer (peerId: string, username: string = peerId): PeerIdentity {
  return { peerId, username, tiers: [Tier.Adult], publicKey: `pk-${username}`, encPublicKey: `enc-${username}` };
}

function makeHandlers (): RtcManagerHandlers {
  return {
    onPeerConnected: vi.fn(),
    onPeerDisconnected: vi.fn(),
    onMessage: vi.fn(),
    onSendOffer: vi.fn(),
    onSendAnswer: vi.fn(),
    onSendIceCandidate: vi.fn(),
    onFileControl: vi.fn(),
    onFileBinary: vi.fn()
  };
}

function makeMessage (content: string = 'hello'): ChatMessage {
  return { id: 'm-1', author: 'me', content, timestamp: Date.now() };
}

describe('RtcManager.connectToPeer', () => {
  let mgr: RtcManager;
  let handlers: RtcManagerHandlers;

  beforeEach(() => {
    installRTCPeerConnection();
    mgr = new RtcManager('local');
    handlers = makeHandlers();
    mgr.setHandlers(handlers);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates peer connection and fires onSendOffer', async () => {
    const peer = makePeer('p-1');
    await mgr.connectToPeer(peer);

    expect(createdPCs.length).toBe(1);
    const pc = createdPCs[0]!;
    expect(pc.createDataChannel).toHaveBeenCalledWith('chat', { ordered: true });
    expect(pc.createDataChannel).toHaveBeenCalledWith('file', { ordered: true });
    expect(handlers.onSendOffer).toHaveBeenCalledWith('p-1', 'offer-sdp', 'chat');
  });

  it('does not create a second connection for the same peer', async () => {
    await mgr.connectToPeer(makePeer('p-1'));
    await mgr.connectToPeer(makePeer('p-1'));

    expect(createdPCs.length).toBe(1);
    expect(handlers.onSendOffer).toHaveBeenCalledTimes(1);
  });
});

describe('RtcManager.handleOffer', () => {
  let mgr: RtcManager;
  let handlers: RtcManagerHandlers;

  beforeEach(() => {
    installRTCPeerConnection();
    mgr = new RtcManager('local');
    handlers = makeHandlers();
    mgr.setHandlers(handlers);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a new peer connection, sets remote description, and sends answer', async () => {
    const peer = makePeer('p-2');
    await mgr.handleOffer('p-2', peer, 'remote-sdp', 'chat');

    expect(createdPCs.length).toBe(1);
    const pc = createdPCs[0]!;
    expect(pc.setRemoteDescription).toHaveBeenCalledWith({ type: 'offer', sdp: 'remote-sdp' });
    expect(pc.createAnswer).toHaveBeenCalled();
    expect(pc.setLocalDescription).toHaveBeenCalled();
    expect(handlers.onSendAnswer).toHaveBeenCalledWith('p-2', 'answer-sdp');
  });

  it('does not create a new connection if peer already exists', async () => {
    const peer = makePeer('p-2');
    await mgr.handleOffer('p-2', peer, 'sdp-1', 'chat');
    await mgr.handleOffer('p-2', peer, 'sdp-2', 'chat');

    expect(createdPCs.length).toBe(1);
  });

  it('sets up ondatachannel handler for incoming data channels', async () => {
    const peer = makePeer('p-3');
    await mgr.handleOffer('p-3', peer, 'sdp', 'chat');

    const pc = createdPCs[0]!;
    expect(pc.ondatachannel).not.toBeNull();

    const chatChannel = makeChannel('chat');
    pc.ondatachannel!({ channel: chatChannel });
    expect(chatChannel.onopen).not.toBeNull();

    const fileChannel = makeChannel('file');
    pc.ondatachannel!({ channel: fileChannel });
    expect(fileChannel.binaryType).toBe('arraybuffer');
    expect(fileChannel.onmessage).not.toBeNull();
  });
});

describe('RtcManager.handleAnswer', () => {
  let mgr: RtcManager;

  beforeEach(() => {
    installRTCPeerConnection();
    mgr = new RtcManager('local');
    mgr.setHandlers(makeHandlers());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets remote description on the existing peer', async () => {
    await mgr.connectToPeer(makePeer('p-1'));
    const pc = createdPCs[0]!;

    await mgr.handleAnswer('p-1', 'answer-sdp');
    expect(pc.setRemoteDescription).toHaveBeenCalledWith({ type: 'answer', sdp: 'answer-sdp' });
  });

  it('does nothing for unknown peer', async () => {
    await mgr.handleAnswer('unknown', 'sdp');
    expect(createdPCs.length).toBe(0);
  });
});

describe('RtcManager.handleIceCandidate', () => {
  let mgr: RtcManager;

  beforeEach(() => {
    installRTCPeerConnection();
    mgr = new RtcManager('local');
    mgr.setHandlers(makeHandlers());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds ICE candidate to existing peer', async () => {
    await mgr.connectToPeer(makePeer('p-1'));
    const pc = createdPCs[0]!;

    const candidate = { candidate: 'ice', sdpMid: '0', sdpMLineIndex: 0 } as RTCIceCandidateInit;
    await mgr.handleIceCandidate('p-1', candidate);
    expect(pc.addIceCandidate).toHaveBeenCalledWith(candidate);
  });

  it('does nothing for unknown peer', async () => {
    await mgr.handleIceCandidate('unknown', {} as RTCIceCandidateInit);
    expect(createdPCs.length).toBe(0);
  });
});

describe('RtcManager.sendTo', () => {
  let mgr: RtcManager;

  beforeEach(() => {
    installRTCPeerConnection();
    mgr = new RtcManager('local');
    mgr.setHandlers(makeHandlers());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends a message to a connected peer and returns true', async () => {
    await mgr.connectToPeer(makePeer('p-1'));
    const pc = createdPCs[0]!;
    const chatChannel = pc.createDataChannel.mock.results[0]!.value as MockDataChannel;

    const msg = makeMessage('hi');
    const result = mgr.sendTo('p-1', msg);
    expect(result).toBe(true);
    expect(chatChannel.send).toHaveBeenCalledWith(JSON.stringify(msg));
  });

  it('returns false when channel is not open', async () => {
    await mgr.connectToPeer(makePeer('p-1'));
    const pc = createdPCs[0]!;
    const chatChannel = pc.createDataChannel.mock.results[0]!.value as MockDataChannel;
    chatChannel.readyState = 'closed';

    expect(mgr.sendTo('p-1', makeMessage())).toBe(false);
  });

  it('returns false for unknown peer', () => {
    expect(mgr.sendTo('unknown', makeMessage())).toBe(false);
  });
});

describe('RtcManager.broadcast', () => {
  let mgr: RtcManager;

  beforeEach(() => {
    installRTCPeerConnection();
    mgr = new RtcManager('local');
    mgr.setHandlers(makeHandlers());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends to all peers with open channels and returns delivered peer IDs', async () => {
    await mgr.connectToPeer(makePeer('p-1'));
    await mgr.connectToPeer(makePeer('p-2'));

    const pc1 = createdPCs[0]!;
    const pc2 = createdPCs[1]!;
    const ch1 = pc1.createDataChannel.mock.results[0]!.value as MockDataChannel;
    const ch2 = pc2.createDataChannel.mock.results[0]!.value as MockDataChannel;
    ch2.readyState = 'closed';

    const msg = makeMessage('broadcast');
    const delivered = mgr.broadcast(msg);

    expect(delivered).toEqual(['p-1']);
    expect(ch1.send).toHaveBeenCalledWith(JSON.stringify(msg));
    expect(ch2.send).not.toHaveBeenCalled();
  });

  it('returns empty array when no peers are connected', () => {
    expect(mgr.broadcast(makeMessage())).toEqual([]);
  });
});

describe('RtcManager.disconnectPeer', () => {
  let mgr: RtcManager;
  let handlers: RtcManagerHandlers;

  beforeEach(() => {
    installRTCPeerConnection();
    mgr = new RtcManager('local');
    handlers = makeHandlers();
    mgr.setHandlers(handlers);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('closes channels and PC, fires onPeerDisconnected', async () => {
    await mgr.connectToPeer(makePeer('p-1'));
    const pc = createdPCs[0]!;
    const chatChannel = pc.createDataChannel.mock.results[0]!.value as MockDataChannel;
    const fileChannel = pc.createDataChannel.mock.results[1]!.value as MockDataChannel;

    mgr.disconnectPeer('p-1');

    expect(chatChannel.close).toHaveBeenCalled();
    expect(fileChannel.close).toHaveBeenCalled();
    expect(pc.close).toHaveBeenCalled();
    expect(handlers.onPeerDisconnected).toHaveBeenCalledWith('p-1');
  });

  it('is a no-op for unknown peer', () => {
    mgr.disconnectPeer('unknown');
    expect(handlers.onPeerDisconnected).not.toHaveBeenCalled();
  });
});

describe('RtcManager.disconnectAll', () => {
  let mgr: RtcManager;
  let handlers: RtcManagerHandlers;

  beforeEach(() => {
    installRTCPeerConnection();
    mgr = new RtcManager('local');
    handlers = makeHandlers();
    mgr.setHandlers(handlers);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('disconnects all peers', async () => {
    await mgr.connectToPeer(makePeer('p-1'));
    await mgr.connectToPeer(makePeer('p-2'));

    mgr.disconnectAll();

    expect(handlers.onPeerDisconnected).toHaveBeenCalledTimes(2);
    expect(mgr.getAllPeers()).toHaveLength(0);
  });
});

describe('RtcManager queries', () => {
  let mgr: RtcManager;

  beforeEach(() => {
    installRTCPeerConnection();
    mgr = new RtcManager('local');
    mgr.setHandlers(makeHandlers());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getConnectedPeerIds returns only peers with open channels', async () => {
    await mgr.connectToPeer(makePeer('p-1'));
    await mgr.connectToPeer(makePeer('p-2'));
    const pc2 = createdPCs[1]!;
    const ch2 = pc2.createDataChannel.mock.results[0]!.value as MockDataChannel;
    ch2.readyState = 'closed';

    expect(mgr.getConnectedPeerIds()).toEqual(['p-1']);
  });

  it('getPeer returns peer identity', async () => {
    const peer = makePeer('p-1', 'alice');
    await mgr.connectToPeer(peer);
    expect(mgr.getPeer('p-1')).toEqual(peer);
  });

  it('getPeer returns undefined for unknown peer', () => {
    expect(mgr.getPeer('unknown')).toBeUndefined();
  });

  it('getAllPeers returns all peer identities', async () => {
    const p1 = makePeer('p-1', 'alice');
    const p2 = makePeer('p-2', 'bob');
    await mgr.connectToPeer(p1);
    await mgr.connectToPeer(p2);
    expect(mgr.getAllPeers()).toEqual([p1, p2]);
  });

  it('isHubOf returns true when local peer matches', () => {
    expect(mgr.isHubOf('local')).toBe(true);
    expect(mgr.isHubOf('other')).toBe(false);
  });
});

describe('RtcManager.getFileChannel', () => {
  let mgr: RtcManager;

  beforeEach(() => {
    installRTCPeerConnection();
    mgr = new RtcManager('local');
    mgr.setHandlers(makeHandlers());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the file channel when open', async () => {
    await mgr.connectToPeer(makePeer('p-1'));
    const pc = createdPCs[0]!;
    const fileChannel = pc.createDataChannel.mock.results[1]!.value as MockDataChannel;

    const result = mgr.getFileChannel('p-1');
    expect(result).toBe(fileChannel);
  });

  it('returns null when file channel is closed', async () => {
    await mgr.connectToPeer(makePeer('p-1'));
    const pc = createdPCs[0]!;
    const fileChannel = pc.createDataChannel.mock.results[1]!.value as MockDataChannel;
    fileChannel.readyState = 'closed';

    expect(mgr.getFileChannel('p-1')).toBeNull();
  });

  it('returns null for unknown peer', () => {
    expect(mgr.getFileChannel('unknown')).toBeNull();
  });
});

describe('RtcManager channel handlers', () => {
  let mgr: RtcManager;
  let handlers: RtcManagerHandlers;

  beforeEach(() => {
    installRTCPeerConnection();
    mgr = new RtcManager('local');
    handlers = makeHandlers();
    mgr.setHandlers(handlers);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('channel onopen fires onPeerConnected', async () => {
    await mgr.connectToPeer(makePeer('p-1'));
    const pc = createdPCs[0]!;
    const chatChannel = pc.createDataChannel.mock.results[0]!.value as MockDataChannel;

    chatChannel.onopen!();
    expect(handlers.onPeerConnected).toHaveBeenCalledWith('p-1');
  });

  it('channel onclose fires onPeerDisconnected', async () => {
    await mgr.connectToPeer(makePeer('p-1'));
    const pc = createdPCs[0]!;
    const chatChannel = pc.createDataChannel.mock.results[0]!.value as MockDataChannel;

    chatChannel.onclose!();
    expect(handlers.onPeerDisconnected).toHaveBeenCalledWith('p-1');
  });

  it('channel onmessage fires onMessage with parsed chat message', async () => {
    await mgr.connectToPeer(makePeer('p-1'));
    const pc = createdPCs[0]!;
    const chatChannel = pc.createDataChannel.mock.results[0]!.value as MockDataChannel;

    const msg = makeMessage('hello');
    chatChannel.onmessage!({ data: JSON.stringify(msg) });
    expect(handlers.onMessage).toHaveBeenCalledWith('p-1', msg);
  });

  it('channel onmessage ignores malformed JSON', async () => {
    await mgr.connectToPeer(makePeer('p-1'));
    const pc = createdPCs[0]!;
    const chatChannel = pc.createDataChannel.mock.results[0]!.value as MockDataChannel;

    chatChannel.onmessage!({ data: 'not-json' });
    expect(handlers.onMessage).not.toHaveBeenCalled();
  });
});

describe('RtcManager file channel handlers', () => {
  let mgr: RtcManager;
  let handlers: RtcManagerHandlers;

  beforeEach(() => {
    installRTCPeerConnection();
    mgr = new RtcManager('local');
    handlers = makeHandlers();
    mgr.setHandlers(handlers);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('string data on file channel fires onFileControl', async () => {
    await mgr.connectToPeer(makePeer('p-1'));
    const pc = createdPCs[0]!;
    const fileChannel = pc.createDataChannel.mock.results[1]!.value as MockDataChannel;

    fileChannel.onmessage!({ data: '{"type":"file-start"}' });
    expect(handlers.onFileControl).toHaveBeenCalledWith('p-1', '{"type":"file-start"}');
  });

  it('binary data on file channel fires onFileBinary', async () => {
    await mgr.connectToPeer(makePeer('p-1'));
    const pc = createdPCs[0]!;
    const fileChannel = pc.createDataChannel.mock.results[1]!.value as MockDataChannel;

    const buf = new ArrayBuffer(8);
    fileChannel.onmessage!({ data: buf });
    expect(handlers.onFileBinary).toHaveBeenCalledWith('p-1', buf);
  });
});

describe('RtcManager ICE and connection state', () => {
  let mgr: RtcManager;
  let handlers: RtcManagerHandlers;

  beforeEach(() => {
    installRTCPeerConnection();
    mgr = new RtcManager('local');
    handlers = makeHandlers();
    mgr.setHandlers(handlers);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('onicecandidate fires onSendIceCandidate', async () => {
    await mgr.connectToPeer(makePeer('p-1'));
    const pc = createdPCs[0]!;

    const candidateInit = { candidate: 'ice-candidate', sdpMid: '0', sdpMLineIndex: 0 };
    const candidate = { ...candidateInit, toJSON: () => candidateInit } as unknown as RTCIceCandidate;
    pc.onicecandidate!({ candidate });

    expect(handlers.onSendIceCandidate).toHaveBeenCalledWith('p-1', candidateInit);
  });

  it('onicecandidate does nothing when candidate is null', async () => {
    await mgr.connectToPeer(makePeer('p-1'));
    const pc = createdPCs[0]!;

    pc.onicecandidate!({ candidate: null });
    expect(handlers.onSendIceCandidate).not.toHaveBeenCalled();
  });

  it('connectionstatechange to connected fires onPeerConnected', async () => {
    await mgr.connectToPeer(makePeer('p-1'));
    const pc = createdPCs[0]!;

    pc.connectionState = 'connected';
    pc.onconnectionstatechange!();
    expect(handlers.onPeerConnected).toHaveBeenCalledWith('p-1');
  });

  it('connectionstatechange to failed fires onPeerDisconnected', async () => {
    await mgr.connectToPeer(makePeer('p-1'));
    const pc = createdPCs[0]!;

    pc.connectionState = 'failed';
    pc.onconnectionstatechange!();
    expect(handlers.onPeerDisconnected).toHaveBeenCalledWith('p-1');
  });

  it('connectionstatechange to closed fires onPeerDisconnected', async () => {
    await mgr.connectToPeer(makePeer('p-1'));
    const pc = createdPCs[0]!;

    pc.connectionState = 'closed';
    pc.onconnectionstatechange!();
    expect(handlers.onPeerDisconnected).toHaveBeenCalledWith('p-1');
  });
});
