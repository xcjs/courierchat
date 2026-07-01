import { describe, it, expect } from 'vitest';
import {
  MAGIC_COOKIE,
  MSG_BINDING_REQUEST,
  MSG_BINDING_RESPONSE,
  ATTR_XOR_MAPPED_ADDRESS,
  ATTR_MAPPED_ADDRESS,
  FAMILY_IPV4,
  STUN_HEADER_SIZE,
  parseStunHeader,
  isBindingRequest,
  buildXorMappedAddressV4,
  buildMappedAddressV4,
  buildBindingResponse
} from './StunProtocol';

/**
 * Build a minimal STUN Binding Request for testing.
 */
function makeBindingRequest (transactionId: Uint8Array = new Uint8Array(12).fill(0xAB)): Uint8Array {
  const packet = new Uint8Array(STUN_HEADER_SIZE);
  const view = new DataView(packet.buffer);
  view.setUint16(0, MSG_BINDING_REQUEST);
  view.setUint16(2, 0); // no attributes
  view.setUint32(4, MAGIC_COOKIE);
  packet.set(transactionId, 8);
  return packet;
}

describe('StunProtocol', () => {
  describe('parseStunHeader', () => {
    it('parses a valid STUN header', () => {
      const txId = new Uint8Array(12).fill(0x42);
      const packet = makeBindingRequest(txId);
      const header = parseStunHeader(packet);
      expect(header).toBeDefined();
      expect(header!.messageType).toBe(MSG_BINDING_REQUEST);
      expect(header!.messageLength).toBe(0);
      expect(header!.magicCookie).toBe(MAGIC_COOKIE);
      expect(header!.transactionId).toEqual(txId);
    });

    it('returns undefined for a packet too small', () => {
      expect(parseStunHeader(new Uint8Array(10))).toBeUndefined();
    });

    it('returns undefined for wrong magic cookie', () => {
      const packet = new Uint8Array(STUN_HEADER_SIZE);
      const view = new DataView(packet.buffer);
      view.setUint16(0, MSG_BINDING_REQUEST);
      view.setUint32(4, 0xDEADBEEF); // wrong cookie
      expect(parseStunHeader(packet)).toBeUndefined();
    });
  });

  describe('isBindingRequest', () => {
    it('returns true for binding request type', () => {
      const header = { messageType: MSG_BINDING_REQUEST, messageLength: 0, magicCookie: MAGIC_COOKIE, transactionId: new Uint8Array(12) };
      expect(isBindingRequest(header)).toBe(true);
    });

    it('returns false for binding response type', () => {
      const header = { messageType: MSG_BINDING_RESPONSE, messageLength: 0, magicCookie: MAGIC_COOKIE, transactionId: new Uint8Array(12) };
      expect(isBindingRequest(header)).toBe(false);
    });
  });

  describe('buildXorMappedAddressV4', () => {
    it('XORs the port and address with the magic cookie', () => {
      const value = buildXorMappedAddressV4('192.168.1.100', 12345);
      expect(value).toHaveLength(8);

      const view = new DataView(value.buffer);
      expect(view.getUint8(0)).toBe(0x00); // reserved
      expect(view.getUint8(1)).toBe(FAMILY_IPV4);

      // X-Port = 12345 XOR (MAGIC_COOKIE >> 16)
      const expectedXPort = 12345 ^ (MAGIC_COOKIE >>> 16);
      expect(view.getUint16(2)).toBe(expectedXPort);

      // X-Address = IP XOR magicCookie
      const ipInt = ((192 << 24) | (168 << 16) | (1 << 8) | 100) >>> 0;
      const expectedXAddr = (ipInt ^ MAGIC_COOKIE) >>> 0;
      expect(view.getUint32(4)).toBe(expectedXAddr);
    });

    it('throws for invalid IPv4 address', () => {
      expect(() => buildXorMappedAddressV4('not-an-ip', 80)).toThrow();
    });
  });

  describe('buildMappedAddressV4', () => {
    it('encodes the port and address without XOR', () => {
      const value = buildMappedAddressV4('10.0.0.5', 5000);
      expect(value).toHaveLength(8);

      const view = new DataView(value.buffer);
      expect(view.getUint8(0)).toBe(0x00);
      expect(view.getUint8(1)).toBe(FAMILY_IPV4);
      expect(view.getUint16(2)).toBe(5000);
      expect(view.getUint8(4)).toBe(10);
      expect(view.getUint8(5)).toBe(0);
      expect(view.getUint8(6)).toBe(0);
      expect(view.getUint8(7)).toBe(5);
    });
  });

  describe('buildBindingResponse', () => {
    it('builds a complete response with both attributes', () => {
      const txId = new Uint8Array(12).fill(0x77);
      const response = buildBindingResponse(txId, '1.2.3.4', 5678);

      // Header (20) + XOR-MAPPED-ADDRESS attr (4+8=12) + MAPPED-ADDRESS attr (4+8=12) = 44
      expect(response).toHaveLength(44);

      const view = new DataView(response.buffer);
      expect(view.getUint16(0)).toBe(MSG_BINDING_RESPONSE);
      expect(view.getUint32(4)).toBe(MAGIC_COOKIE);
      expect(response.slice(8, 20)).toEqual(txId);

      // First attribute: XOR-MAPPED-ADDRESS
      expect(view.getUint16(20)).toBe(ATTR_XOR_MAPPED_ADDRESS);
      expect(view.getUint16(22)).toBe(8); // value length

      // Second attribute: MAPPED-ADDRESS
      expect(view.getUint16(32)).toBe(ATTR_MAPPED_ADDRESS);
      expect(view.getUint16(34)).toBe(8);
    });

    it('preserves the transaction ID from the request', () => {
      const txId = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      const response = buildBindingResponse(txId, '1.2.3.4', 5678);
      expect(response.slice(8, 20)).toEqual(txId);
    });
  });
});
