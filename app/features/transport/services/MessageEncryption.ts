/**
 * MessageEncryption provides end-to-end message confidentiality for
 * CourierChat (ADR 0003).
 *
 * Each client generates an ECDH P-256 keypair on connect (separate from the
 * ECDSA signing keypair). The ECDH public key is distributed via Hello →
 * PeerJoined alongside the signing key. When sending a message, the sender
 * derives a pairwise shared secret with each recipient via ECDH, derives a
 * wrapping key via HKDF-SHA-256 (room-scoped), and wraps a random
 * AES-GCM-256 content encryption key (CEK) for each recipient. The content
 * is encrypted once with the CEK. Recipients look up their peerId in the
 * `encKeys` map, unwrap the CEK using the pairwise key derived from their
 * own ECDH private key and the sender's ECDH public key, and decrypt.
 *
 * The hub (in star mode) and the relay server see only ciphertext and
 * wrapped CEKs they cannot unwrap, so message content stays confidential
 * end-to-end.
 */

import type { PeerIdentity } from '#shared/types/Signaling';

export interface EncKeyMaterial {
  /** Base64 SPKI DER ECDH public key, safe to distribute via signaling. */
  encPublicKeyB64: string;
  /** Web Crypto ECDH private key handle, non-extractable. */
  encPrivateKey: CryptoKey;
}

/**
 * Fields produced by encryption that merge into a ChatMessage / ChatMessagePayload.
 * `content` is the base64 ciphertext; `encIv` is the base64 96-bit AES-GCM IV;
 * `encKeys` maps recipient peerId → base64 wrapped CEK (iv||ciphertext||tag).
 */
export interface EncryptedMessage {
  content: string;
  encIv: string;
  encKeys: Record<string, string>;
}

const ECDH_ALGORITHM = { name: 'ECDH', namedCurve: 'P-256' } as const;
const AES_GCM = 'AES-GCM' as const;
const AES_GCM_LENGTH = 256;
const IV_LENGTH = 12;
const HKDF_INFO = new TextEncoder().encode('courierchat:v1:encryption');
const EXPORT_FORMAT = 'spki';

function bufferToBase64 (buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBuffer (b64: string): ArrayBuffer {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(b64, 'base64');
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function randomIv (): ArrayBuffer {
  const iv = new Uint8Array(IV_LENGTH);
  crypto.getRandomValues(iv);
  return iv.buffer;
}

export class MessageEncryption {
  private keyMaterial: EncKeyMaterial | null = null;
  /**
   * Cache of pairwise wrapping keys, keyed by `${peerId}|${room}`. Avoids
   * redoing ECDH + HKDF for every message to the same peer in the same room.
   */
  private readonly wrappingKeyCache = new Map<string, Promise<CryptoKey>>();
  /** Cache of imported remote ECDH public keys, keyed by base64 SPKI DER. */
  private readonly remotePublicKeyCache = new Map<string, Promise<CryptoKey>>();

  /**
   * Generate a new ECDH P-256 keypair. Called once on connect, before
   * sending Hello. The public key is exported as SPKI DER base64 for
   * distribution; the private key stays non-extractable in memory.
   */
  async generateKey (): Promise<EncKeyMaterial> {
    const keyPair = await crypto.subtle.generateKey(
      ECDH_ALGORITHM,
      false,
      ['deriveKey', 'deriveBits']
    );
    const exported = await crypto.subtle.exportKey(EXPORT_FORMAT, keyPair.publicKey);
    const encPublicKeyB64 = bufferToBase64(exported);
    this.keyMaterial = {
      encPublicKeyB64,
      encPrivateKey: keyPair.privateKey
    };
    return this.keyMaterial;
  }

  /** The base64 ECDH public key, or null if generateKey has not been called. */
  getEncPublicKeyB64 (): string | null {
    return this.keyMaterial?.encPublicKeyB64 ?? null;
  }

  /**
   * Encrypt plaintext content for a set of recipients. Produces the wire
   * fields to merge into the outgoing message. `localPeerId` is excluded
   * from the recipients map (the sender does not need to decrypt its own
   * message). Throws if generateKey has not been called.
   */
  async encrypt (
    plaintext: string,
    room: string,
    recipients: PeerIdentity[],
    localPeerId: string
  ): Promise<EncryptedMessage> {
    if (!this.keyMaterial) {
      throw new Error('MessageEncryption.encrypt called before generateKey');
    }

    // Generate a random content encryption key (CEK) for this message.
    const cek = await crypto.subtle.generateKey(
      { name: AES_GCM, length: AES_GCM_LENGTH },
      true,
      ['encrypt', 'decrypt']
    );
    const cekRaw = await crypto.subtle.exportKey('raw', cek);

    // Encrypt the content with the CEK.
    const iv = randomIv();
    const plaintextBytes = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt(
      { name: AES_GCM, iv },
      cek,
      plaintextBytes
    );

    // Wrap the CEK for each recipient using their pairwise wrapping key.
    const encKeys: Record<string, string> = {};
    for (const recipient of recipients) {
      if (recipient.peerId === localPeerId) { continue; }
      if (!recipient.encPublicKey) { continue; }
      const wrappingKey = await this.getWrappingKey(recipient.encPublicKey, recipient.peerId, room);
      const wrapIv = randomIv();
      const wrapped = await crypto.subtle.encrypt(
        { name: AES_GCM, iv: wrapIv },
        wrappingKey,
        cekRaw
      );
      // Prepend the wrap IV so the recipient can decrypt.
      const combined = new Uint8Array(wrapIv.byteLength + wrapped.byteLength);
      combined.set(new Uint8Array(wrapIv), 0);
      combined.set(new Uint8Array(wrapped), wrapIv.byteLength);
      encKeys[recipient.peerId] = bufferToBase64(combined.buffer);
    }

    return {
      content: bufferToBase64(ciphertext),
      encIv: bufferToBase64(iv),
      encKeys
    };
  }

  /**
   * Decrypt an incoming message. Looks up `localPeerId` in `encKeys`,
   * unwraps the CEK using the pairwise key derived from the local ECDH
   * private key and the sender's ECDH public key, then decrypts the
   * content. Returns the plaintext, or null if the message is not addressed
   * to us or decryption fails.
   */
  async decrypt (
    encrypted: EncryptedMessage,
    room: string,
    senderEncPublicKeyB64: string,
    localPeerId: string
  ): Promise<string | null> {
    if (!this.keyMaterial) { return null; }
    const wrapped = encrypted.encKeys?.[localPeerId];
    if (!wrapped) { return null; }
    try {
      const wrappingKey = await this.getWrappingKey(senderEncPublicKeyB64, localPeerId, room);
      const combined = new Uint8Array(base64ToBuffer(wrapped));
      if (combined.length < IV_LENGTH) { return null; }
      const wrapIv = combined.slice(0, IV_LENGTH).buffer;
      const wrappedCek = combined.slice(IV_LENGTH).buffer;
      const cekRaw = await crypto.subtle.decrypt(
        { name: AES_GCM, iv: wrapIv },
        wrappingKey,
        wrappedCek
      );
      const cek = await crypto.subtle.importKey('raw', cekRaw, { name: AES_GCM, length: AES_GCM_LENGTH }, false, ['decrypt']);
      const iv = base64ToBuffer(encrypted.encIv);
      const plaintext = await crypto.subtle.decrypt(
        { name: AES_GCM, iv },
        cek,
        base64ToBuffer(encrypted.content)
      );
      return new TextDecoder().decode(plaintext);
    } catch {
      return null;
    }
  }

  /**
   * Clear key material and caches. Called on disconnect.
   */
  clear (): void {
    this.keyMaterial = null;
    this.wrappingKeyCache.clear();
    this.remotePublicKeyCache.clear();
  }

  /**
   * Get (or derive and cache) the pairwise AES-GCM-256 wrapping key for a
   * remote peer in a room. Derived via ECDH then HKDF-SHA-256 with the
   * room name as salt and a purpose-bound info string.
   */
  private getWrappingKey (remoteEncPublicKeyB64: string, peerId: string, room: string): Promise<CryptoKey> {
    const cacheKey = `${peerId}|${room}`;
    const cached = this.wrappingKeyCache.get(cacheKey);
    if (cached) { return cached; }
    const promise = (async () => {
      const remotePublic = await this.importRemotePublic(remoteEncPublicKeyB64);
      const sharedSecret = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: remotePublic },
        this.keyMaterial!.encPrivateKey,
        256
      );
      const salt = new TextEncoder().encode(room);
      // Import the ECDH shared secret as an HKDF base key — deriveKey requires
      // a CryptoKey, not a raw BufferSource, for HKDF in this environment.
      const baseKey = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveKey']);
      return crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt, info: HKDF_INFO },
        baseKey,
        { name: AES_GCM, length: AES_GCM_LENGTH },
        false,
        ['encrypt', 'decrypt']
      );
    })();
    this.wrappingKeyCache.set(cacheKey, promise);
    return promise;
  }

  private importRemotePublic (b64: string): Promise<CryptoKey> {
    let promise = this.remotePublicKeyCache.get(b64);
    if (!promise) {
      const keyData = base64ToBuffer(b64);
      promise = crypto.subtle.importKey(EXPORT_FORMAT, keyData, ECDH_ALGORITHM, false, []);
      this.remotePublicKeyCache.set(b64, promise);
    }
    return promise;
  }
}
