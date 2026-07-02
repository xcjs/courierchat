import { describe, it, expect } from 'vitest';
import {
  MAGIC_COOKIE,
  MSG_BINDING_REQUEST,
  MSG_BINDING_RESPONSE,
  ATTR_MAPPED_ADDRESS,
  ATTR_XOR_MAPPED_ADDRESS,
  FAMILY_IPV4,
  STUN_HEADER_SIZE,
  parseStunHeader,
  isBindingRequest,
  buildXorMappedAddressV4,
  buildMappedAddressV4,
  buildBindingResponse,
  type StunHeader
} from './StunProtocol';

function makeTransactionId (): Uint8Array {
  const id = new Uint8Array(12);
  for (let i = 0; i < 12; i++) {
    id[i] = i;
  }
  return id;
}

function makeBindingRequest (transactionId: Uint8Array): Uint8Array {
  const packet = new Uint8Array(STUN_HEADER_SIZE);
  const view = new DataView(packet.buffer);
  view.setUint16(0, MSG_BINDING_REQUEST);
  view.setUint16(2, 0);
  view.setUint32(4, MAGIC_COOKIE);
  packet.set(transactionId, 8);
  return packet;
}

describe('parseStunHeader', () => {
  it('parses a valid STUN binding request', () => {
    const txId = makeTransactionId();
    const packet = makeBindingRequest(txId);
    const header = parseStunHeader(packet);

    expect(header).toBeDefined();
    expect(header!.messageType).toBe(MSG_BINDING_REQUEST);
    expect(header!.messageLength).toBe(0);
    expect(header!.magicCookie).toBe(MAGIC_COOKIE);
    expect(header!.transactionId).toEqual(txId);
  });

  it('returns undefined for packets smaller than 20 bytes', () => {
    const packet = new Uint8Array(10);
    expect(parseStunHeader(packet)).toBeUndefined();
  });

  it('returns undefined when magic cookie does not match', () => {
    const packet = new Uint8Array(STUN_HEADER_SIZE);
    const view = new DataView(packet.buffer);
    view.setUint16(0, MSG_BINDING_REQUEST);
    view.setUint32(4, 0xDEADBEEF);
    expect(parseStunHeader(packet)).toBeUndefined();
  });
});

describe('isBindingRequest', () => {
  it('returns true for binding request type', () => {
    const header: StunHeader = {
      messageType: MSG_BINDING_REQUEST,
      messageLength: 0,
      magicCookie: MAGIC_COOKIE,
      transactionId: makeTransactionId()
    };
    expect(isBindingRequest(header)).toBe(true);
  });

  it('returns false for binding response type', () => {
    const header: StunHeader = {
      messageType: MSG_BINDING_RESPONSE,
      messageLength: 0,
      magicCookie: MAGIC_COOKIE,
      transactionId: makeTransactionId()
    };
    expect(isBindingRequest(header)).toBe(false);
  });
});

describe('buildXorMappedAddressV4', () => {
  it('builds XOR-mapped address with correct family and XOR values', () => {
    const value = buildXorMappedAddressV4('192.168.1.1', 12345);
    expect(value.length).toBe(8);

    const view = new DataView(value.buffer);
    expect(view.getUint8(0)).toBe(0x00);
    expect(view.getUint8(1)).toBe(FAMILY_IPV4);

    const expectedXPort = 12345 ^ (MAGIC_COOKIE >>> 16);
    expect(view.getUint16(2)).toBe(expectedXPort);

    const ipInt = ((192 << 24) | (168 << 16) | (1 << 8) | 1) >>> 0;
    const expectedXAddr = (ipInt ^ MAGIC_COOKIE) >>> 0;
    expect(view.getUint32(4)).toBe(expectedXAddr);
  });

  it('throws for invalid IPv4 address', () => {
    expect(() => buildXorMappedAddressV4('not-an-ip', 1234)).toThrow('Invalid IPv4 address');
  });
});

describe('buildMappedAddressV4', () => {
  it('builds mapped address with plain port and IP', () => {
    const value = buildMappedAddressV4('10.0.0.5', 8080);
    expect(value.length).toBe(8);

    const view = new DataView(value.buffer);
    expect(view.getUint8(0)).toBe(0x00);
    expect(view.getUint8(1)).toBe(FAMILY_IPV4);
    expect(view.getUint16(2)).toBe(8080);
    expect(view.getUint8(4)).toBe(10);
    expect(view.getUint8(5)).toBe(0);
    expect(view.getUint8(6)).toBe(0);
    expect(view.getUint8(7)).toBe(5);
  });

  it('throws for invalid IPv4 address', () => {
    expect(() => buildMappedAddressV4('bad', 1)).toThrow('Invalid IPv4 address');
  });
});

describe('buildBindingResponse', () => {
  it('builds a complete response with header and both address attributes', () => {
    const txId = makeTransactionId();
    const response = buildBindingResponse(txId, '192.168.1.100', 5000);

    const header = parseStunHeader(response);
    expect(header).toBeDefined();
    expect(header!.messageType).toBe(MSG_BINDING_RESPONSE);
    expect(header!.transactionId).toEqual(txId);

    const view = new DataView(response.buffer);
    const bodySize = view.getUint16(2);
    expect(bodySize).toBe(response.length - STUN_HEADER_SIZE);

    const xorAttrSize = 4 + 8;
    let offset = STUN_HEADER_SIZE;
    expect(view.getUint16(offset)).toBe(ATTR_XOR_MAPPED_ADDRESS);
    expect(view.getUint16(offset + 2)).toBe(8);

    offset += xorAttrSize;
    expect(view.getUint16(offset)).toBe(ATTR_MAPPED_ADDRESS);
    expect(view.getUint16(offset + 2)).toBe(8);
  });

  it('round-trips: parse response header and extract XOR-mapped address', () => {
    const txId = makeTransactionId();
    const ip = '172.16.254.1';
    const port = 3478;
    const response = buildBindingResponse(txId, ip, port);

    const header = parseStunHeader(response);
    expect(header).toBeDefined();
    expect(header!.messageType).toBe(MSG_BINDING_RESPONSE);
    expect(isBindingRequest(header!)).toBe(false);

    const xorValue = new Uint8Array(response.buffer, response.byteOffset + STUN_HEADER_SIZE + 4, 8);
    const xorView = new DataView(xorValue.buffer, xorValue.byteOffset, xorValue.byteLength);

    const xPort = xorView.getUint16(2);
    const actualPort = xPort ^ (MAGIC_COOKIE >>> 16);
    expect(actualPort).toBe(port);

    const xAddr = xorView.getUint32(4);
    const actualAddr = (xAddr ^ MAGIC_COOKIE) >>> 0;
    const octet1 = (actualAddr >>> 24) & 0xFF;
    const octet2 = (actualAddr >>> 16) & 0xFF;
    const octet3 = (actualAddr >>> 8) & 0xFF;
    const octet4 = actualAddr & 0xFF;
    expect(`${octet1}.${octet2}.${octet3}.${octet4}`).toBe(ip);
  });
});
