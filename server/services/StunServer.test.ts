// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StunServer } from './StunServer';
import {
  MAGIC_COOKIE,
  MSG_BINDING_REQUEST,
  STUN_HEADER_SIZE
} from './StunProtocol';

const mockSocket = {
  on: vi.fn(),
  bind: vi.fn(),
  close: vi.fn(),
  send: vi.fn(),
  address: vi.fn(() => ({ port: 3478, address: '0.0.0.0', family: 'IPv4' }))
};

vi.mock('node:dgram', () => ({
  createSocket: vi.fn(() => mockSocket)
}));

function makeBindingRequest (transactionId: Uint8Array): Buffer {
  const packet = Buffer.alloc(STUN_HEADER_SIZE);
  const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
  view.setUint16(0, MSG_BINDING_REQUEST);
  view.setUint16(2, 0);
  view.setUint32(4, MAGIC_COOKIE);
  for (let i = 0; i < 12; i++) {
    packet[8 + i] = transactionId[i]!;
  }
  return packet;
}

describe('StunServer', () => {
  let server: StunServer;
  let messageHandler: ((msg: Buffer, rinfo: { address: string; port: number }) => void) | undefined;
  let bindCallback: (() => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.on.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'message') {
        messageHandler = handler as typeof messageHandler;
      }
    });
    mockSocket.bind.mockImplementation((_port: number, _host: string, cb: () => void) => {
      bindCallback = cb;
    });
    mockSocket.close.mockImplementation((cb: () => void) => {
      cb();
    });
    mockSocket.address.mockReturnValue({ port: 3478, address: '0.0.0.0', family: 'IPv4' });
    server = new StunServer({ port: 3478, host: '0.0.0.0' });
  });

  afterEach(async () => {
    await server.stop();
  });

  it('starts not running', () => {
    expect(server.isRunning).toBe(false);
    expect(server.boundPort).toBeUndefined();
  });

  it('start binds the UDP socket and sets running state', async () => {
    const promise = server.start();
    bindCallback!();
    await promise;

    expect(server.isRunning).toBe(true);
    expect(server.boundPort).toBe(3478);
  });

  it('start is idempotent if already started', async () => {
    const promise1 = server.start();
    bindCallback!();
    await promise1;

    await server.start();
    expect(mockSocket.bind).toHaveBeenCalledTimes(1);
  });

  it('stop closes the socket and clears running state', async () => {
    const promise = server.start();
    bindCallback!();
    await promise;

    await server.stop();

    expect(server.isRunning).toBe(false);
    expect(server.boundPort).toBeUndefined();
  });

  it('stop is a no-op when not running', async () => {
    await server.stop();
    expect(mockSocket.close).not.toHaveBeenCalled();
  });

  it('handles binding request and sends response back', async () => {
    const promise = server.start();
    bindCallback!();
    await promise;

    const txId = new Uint8Array(12);
    for (let i = 0; i < 12; i++) { txId[i] = i + 1; }
    const request = makeBindingRequest(txId);

    messageHandler!(request, { address: '192.168.1.50', port: 12345 });

    expect(mockSocket.send).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      12345,
      '192.168.1.50'
    );

    const sentData = mockSocket.send.mock.calls[0]![0] as Uint8Array;
    expect(sentData.length).toBeGreaterThan(STUN_HEADER_SIZE);
  });

  it('silently drops non-STUN packets', async () => {
    const promise = server.start();
    bindCallback!();
    await promise;

    const garbage = Buffer.alloc(20, 0xFF);
    messageHandler!(garbage, { address: '10.0.0.1', port: 9999 });

    expect(mockSocket.send).not.toHaveBeenCalled();
  });

  it('drops packets smaller than STUN header', async () => {
    const promise = server.start();
    bindCallback!();
    await promise;

    const small = Buffer.alloc(10);
    messageHandler!(small, { address: '10.0.0.1', port: 9999 });

    expect(mockSocket.send).not.toHaveBeenCalled();
  });

  it('drops packets with wrong magic cookie', async () => {
    const promise = server.start();
    bindCallback!();
    await promise;

    const packet = Buffer.alloc(STUN_HEADER_SIZE);
    const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
    view.setUint16(0, MSG_BINDING_REQUEST);
    view.setUint32(4, 0xDEADBEEF);
    messageHandler!(packet, { address: '10.0.0.1', port: 9999 });

    expect(mockSocket.send).not.toHaveBeenCalled();
  });

  it('drops binding response packets (only handles requests)', async () => {
    const promise = server.start();
    bindCallback!();
    await promise;

    const packet = Buffer.alloc(STUN_HEADER_SIZE);
    const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
    view.setUint16(0, 0x0101);
    view.setUint32(4, MAGIC_COOKIE);
    messageHandler!(packet, { address: '10.0.0.1', port: 9999 });

    expect(mockSocket.send).not.toHaveBeenCalled();
  });

  it('uses default port 3478 and host 0.0.0.0', async () => {
    const defaultServer = new StunServer();
    const p = defaultServer.start();
    bindCallback!();
    await p;

    expect(mockSocket.bind).toHaveBeenCalledWith(3478, '0.0.0.0', expect.any(Function));

    await defaultServer.stop();
  });
});
