/**
 * STUN protocol implementation (RFC 5389 subset).
 *
 * Only the Binding Request/Response flow is implemented — that's all
 * CourierChat needs for ICE server-reflexive candidate discovery. No
 * authentication, no long-term credentials, no other message types.
 *
 * Pure functions only: no sockets, no timers. The StunServer class
 * wires these to a dgram UDP socket.
 */

/** RFC 5389 magic cookie. */
export const MAGIC_COOKIE = 0x2112A442;

/** STUN message types. */
export const MSG_BINDING_REQUEST = 0x0001;
export const MSG_BINDING_RESPONSE = 0x0101;

/** STUN attribute types. */
export const ATTR_MAPPED_ADDRESS = 0x0001;
export const ATTR_XOR_MAPPED_ADDRESS = 0x0020;

/** Address family codes. */
export const FAMILY_IPV4 = 0x01;
export const FAMILY_IPV6 = 0x02;

/** STUN header is 20 bytes. */
export const STUN_HEADER_SIZE = 20;

/** Minimum valid STUN message size (header + at least no attributes is fine). */
export const STUN_MIN_SIZE = STUN_HEADER_SIZE;

/**
 * A parsed STUN message header.
 */
export interface StunHeader {
  messageType: number;
  messageLength: number;
  magicCookie: number;
  transactionId: Uint8Array; // 12 bytes
}

/**
 * Parse a STUN message header from a raw UDP packet.
 * Returns undefined if the packet is too small or the magic cookie is wrong.
 */
export function parseStunHeader (packet: Uint8Array): StunHeader | undefined {
  if (packet.length < STUN_HEADER_SIZE) {
    return undefined;
  }

  const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
  const messageType = view.getUint16(0);
  const messageLength = view.getUint16(2);
  const magicCookie = view.getUint32(4);

  if (magicCookie !== MAGIC_COOKIE) {
    return undefined;
  }

  const transactionId = packet.slice(8, 20);
  return { messageType, messageLength, magicCookie, transactionId };
}

/**
 * Check if a parsed header is a Binding Request.
 */
export function isBindingRequest (header: StunHeader): boolean {
  return header.messageType === MSG_BINDING_REQUEST;
}

/**
 * Build a XOR-MAPPED-ADDRESS attribute value for an IPv4 address.
 *
 * The port is XOR'd with the upper 16 bits of the magic cookie.
 * The IPv4 address is XOR'd with the full 32-bit magic cookie.
 */
export function buildXorMappedAddressV4 (ip: string, port: number): Uint8Array {
  // Attribute value: 1 reserved byte + 1 family byte + 2 X-Port + 4 X-Address = 8 bytes
  const value = new Uint8Array(8);
  const view = new DataView(value.buffer);

  // Reserved byte (0) + family
  view.setUint8(0, 0x00);
  view.setUint8(1, FAMILY_IPV4);

  // X-Port = port XOR (magicCookie >> 16)
  const xPort = port ^ (MAGIC_COOKIE >>> 16);
  view.setUint16(2, xPort);

  // X-Address = IPv4 XOR magicCookie
  const ipParts = ip.split('.');
  if (ipParts.length !== 4) {
    throw new Error(`Invalid IPv4 address: ${ip}`);
  }
  const ipInt = ipParts.reduce((acc, octet) => ((acc << 8) | (parseInt(octet, 10) & 0xFF)) >>> 0, 0);
  const xAddress = ((ipInt ^ MAGIC_COOKIE) >>> 0);
  view.setUint32(4, xAddress);

  return value;
}

/**
 * Build a MAPPED-ADDRESS attribute value for an IPv4 address (non-XOR'd, legacy).
 */
export function buildMappedAddressV4 (ip: string, port: number): Uint8Array {
  const value = new Uint8Array(8);
  const view = new DataView(value.buffer);

  view.setUint8(0, 0x00);
  view.setUint8(1, FAMILY_IPV4);
  view.setUint16(2, port);

  const ipParts = ip.split('.');
  if (ipParts.length !== 4) {
    throw new Error(`Invalid IPv4 address: ${ip}`);
  }
  for (let i = 0; i < 4; i++) {
    view.setUint8(4 + i, parseInt(ipParts[i], 10) & 0xFF);
  }

  return value;
}

/**
 * Build a complete STUN Binding Response packet with XOR-MAPPED-ADDRESS
 * and MAPPED-ADDRESS attributes for an IPv4 reflected address.
 *
 * @param transactionId - 12-byte transaction ID from the request
 * @param ip - the client's IPv4 address as seen by the server
 * @param port - the client's UDP port as seen by the server
 * @returns the complete response packet (20-byte header + attributes)
 */
export function buildBindingResponse (transactionId: Uint8Array, ip: string, port: number): Uint8Array {
  const xorValue = buildXorMappedAddressV4(ip, port);
  const mappedValue = buildMappedAddressV4(ip, port);

  // Each attribute: 2 bytes type + 2 bytes length + value (padded to 4-byte boundary)
  const xorAttrSize = 4 + xorValue.length; // 4 + 8 = 12
  const mappedAttrSize = 4 + mappedValue.length; // 4 + 8 = 12
  const bodySize = xorAttrSize + mappedAttrSize;

  const packet = new Uint8Array(STUN_HEADER_SIZE + bodySize);
  const view = new DataView(packet.buffer);

  // Header
  view.setUint16(0, MSG_BINDING_RESPONSE);
  view.setUint16(2, bodySize);
  view.setUint32(4, MAGIC_COOKIE);
  packet.set(transactionId, 8);

  // XOR-MAPPED-ADDRESS attribute
  let offset = STUN_HEADER_SIZE;
  view.setUint16(offset, ATTR_XOR_MAPPED_ADDRESS);
  view.setUint16(offset + 2, xorValue.length);
  packet.set(xorValue, offset + 4);

  // MAPPED-ADDRESS attribute (legacy compatibility)
  offset += xorAttrSize;
  view.setUint16(offset, ATTR_MAPPED_ADDRESS);
  view.setUint16(offset + 2, mappedValue.length);
  packet.set(mappedValue, offset + 4);

  return packet;
}
