/**
 * MessageCrypto provides ECDSA P-256 message integrity for CourierChat.
 *
 * Each client generates a keypair on connect (before sending Hello). The
 * public key (SPKI DER, base64) travels in HelloPayload and is distributed
 * to other peers via Welcome/PeerJoined. Messages carry a base64 signature
 * over the canonical representation `${id}|${author}|${content}|${timestamp}`.
 * Recipients verify against the author's public key and drop on mismatch.
 *
 * This is integrity + authenticity, NOT confidentiality. A hub in star mode
 * can still read message content; it cannot tamper without invalidating the
 * signature. E2E encryption remains a separate future concern.
 */

export interface KeyMaterial {
  /** Base64 SPKI DER public key, safe to distribute via signaling. */
  publicKeyB64: string;
  /** Web Crypto private key handle, non-extractable. */
  privateKey: CryptoKey;
}

export interface SignableMessage {
  id: string;
  author: string;
  content: string;
  timestamp: number;
}

const ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const SIGN_ALGORITHM = { name: 'ECDSA', hash: 'SHA-256' } as const;
const KEY_USAGE: KeyUsage[] = ['sign', 'verify'];
const EXPORT_FORMAT = 'spki';

/**
 * Convert an ArrayBuffer to a base64 string. Works in both browser and Node
 * (via Buffer when available, or manual encoding for broader compatibility).
 */
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

/**
 * Convert a base64 string to an ArrayBuffer.
 */
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

/**
 * Canonical representation of a message for signing/verification.
 * The fields are joined with `|` in fixed order: id, author, content, timestamp.
 */
function canonical (message: SignableMessage): string {
  return `${message.id}|${message.author}|${message.content}|${message.timestamp}`;
}

/**
 * Encode the canonical string as UTF-8 bytes for signing/verification.
 */
function encodeCanonical (message: SignableMessage): ArrayBuffer {
  const text = canonical(message);
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text).buffer as ArrayBuffer;
  }
  const buf = Buffer.from(text, 'utf-8');
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

/**
 * Import a base64 SPKI public key into a CryptoKey for verification.
 * Cached so repeated verifications with the same key don't re-import.
 */
const publicKeyCache = new Map<string, Promise<CryptoKey>>();

export class MessageCrypto {
  private keyMaterial: KeyMaterial | null = null;

  /**
   * Generate a new ECDSA P-256 keypair. Called once on connect, before
   * sending Hello. The public key is exported as SPKI DER base64 for
   * distribution; the private key stays non-extractable in memory.
   */
  async generateKey (): Promise<KeyMaterial> {
    const keyPair = await crypto.subtle.generateKey(
      ALGORITHM,
      false, // non-extractable private key
      KEY_USAGE
    );
    const exported = await crypto.subtle.exportKey(EXPORT_FORMAT, keyPair.publicKey);
    const publicKeyB64 = bufferToBase64(exported);
    this.keyMaterial = {
      publicKeyB64,
      privateKey: keyPair.privateKey
    };
    return this.keyMaterial;
  }

  /** The base64 public key, or null if generateKey has not been called. */
  getPublicKeyB64 (): string | null {
    return this.keyMaterial?.publicKeyB64 ?? null;
  }

  /**
   * Sign a message with the local private key. Returns the base64 signature.
   * Throws if generateKey has not been called.
   */
  async sign (message: SignableMessage): Promise<string> {
    if (!this.keyMaterial) {
      throw new Error('MessageCrypto.sign called before generateKey');
    }
    const data = encodeCanonical(message);
    const signature = await crypto.subtle.sign(
      SIGN_ALGORITHM,
      this.keyMaterial.privateKey,
      data
    );
    return bufferToBase64(signature);
  }

  /**
   * Verify a message signature against the author's public key.
   * Returns true if the signature is valid, false otherwise.
   * Returns false (does not throw) if the public key is missing or malformed.
   */
  async verify (message: SignableMessage, signatureB64: string, publicKeyB64: string): Promise<boolean> {
    try {
      let publicKey = await publicKeyCache.get(publicKeyB64);
      if (!publicKey) {
        const keyData = base64ToBuffer(publicKeyB64);
        const imported = crypto.subtle.importKey(
          EXPORT_FORMAT,
          keyData,
          ALGORITHM,
          false,
          ['verify']
        );
        publicKeyCache.set(publicKeyB64, imported);
        publicKey = await imported;
      }
      const data = encodeCanonical(message);
      const signature = base64ToBuffer(signatureB64);
      return await crypto.subtle.verify(SIGN_ALGORITHM, publicKey, signature, data);
    } catch {
      return false;
    }
  }

  /**
   * Clear the key material. Called on disconnect.
   */
  clear (): void {
    this.keyMaterial = null;
  }
}
