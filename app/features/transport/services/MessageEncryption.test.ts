import { describe, it, expect, beforeEach } from 'vitest';
import { MessageEncryption } from './MessageEncryption';
import type { PeerIdentity } from '#shared/types/Signaling';
import { Tier } from '#shared/types/Tier';

function makePeer (peerId: string, enc: MessageEncryption): PeerIdentity {
  const b64 = enc.getEncPublicKeyB64();
  if (!b64) { throw new Error('no key'); }
  return { peerId, username: peerId, tiers: [Tier.Adult], publicKey: `sig-${peerId}`, encPublicKey: b64 };
}

describe('MessageEncryption', () => {
  let enc: MessageEncryption;

  beforeEach(() => {
    enc = new MessageEncryption();
  });

  describe('generateKey', () => {
    it('returns EncKeyMaterial with base64 public key', async () => {
      const km = await enc.generateKey();
      expect(km.encPublicKeyB64).toBeTruthy();
      expect(typeof km.encPublicKeyB64).toBe('string');
      expect(km.encPublicKeyB64.length).toBeGreaterThan(0);
      expect(km.encPrivateKey).toBeDefined();
    });

    it('getEncPublicKeyB64 returns null before generateKey', () => {
      expect(enc.getEncPublicKeyB64()).toBeNull();
    });

    it('getEncPublicKeyB64 returns the key after generateKey', async () => {
      const km = await enc.generateKey();
      expect(enc.getEncPublicKeyB64()).toBe(km.encPublicKeyB64);
    });
  });

  describe('encrypt / decrypt', () => {
    it('encrypts and the intended recipient decrypts to the original plaintext', async () => {
      await enc.generateKey();
      const peer = makePeer('p2', enc);
      const encrypted = await enc.encrypt('hello world', 'room1', [peer], 'me');
      expect(encrypted.content).not.toBe('hello world');
      expect(encrypted.encIv).toBeTruthy();
      expect(Object.keys(encrypted.encKeys)).toEqual(['p2']);

      const plaintext = await enc.decrypt(encrypted, 'room1', peer.encPublicKey, 'p2');
      expect(plaintext).toBe('hello world');
    });

    it('two peers can exchange messages bidirectionally', async () => {
      const alice = new MessageEncryption();
      const bob = new MessageEncryption();
      await alice.generateKey();
      await bob.generateKey();
      const alicePeer: PeerIdentity = { peerId: 'alice', username: 'alice', tiers: [Tier.Adult], publicKey: 'sig-a', encPublicKey: alice.getEncPublicKeyB64()! };
      const bobPeer: PeerIdentity = { peerId: 'bob', username: 'bob', tiers: [Tier.Adult], publicKey: 'sig-b', encPublicKey: bob.getEncPublicKeyB64()! };

      const fromAlice = await alice.encrypt('hi bob', 'room', [bobPeer], 'alice');
      expect(await bob.decrypt(fromAlice, 'room', alicePeer.encPublicKey, 'bob')).toBe('hi bob');

      const fromBob = await bob.encrypt('hi alice', 'room', [alicePeer], 'bob');
      expect(await alice.decrypt(fromBob, 'room', bobPeer.encPublicKey, 'alice')).toBe('hi alice');
    });

    it('different recipients get different wrapped CEKs', async () => {
      await enc.generateKey();
      const bob = new MessageEncryption();
      await bob.generateKey();
      const carol = new MessageEncryption();
      await carol.generateKey();
      const bobPeer = makePeer('bob', bob);
      const carolPeer = makePeer('carol', carol);
      const encrypted = await enc.encrypt('group msg', 'room', [bobPeer, carolPeer], 'me');
      expect(encrypted.encKeys.bob).not.toBe(encrypted.encKeys.carol);
      expect(await bob.decrypt(encrypted, 'room', enc.getEncPublicKeyB64()!, 'bob')).toBe('group msg');
      expect(await carol.decrypt(encrypted, 'room', enc.getEncPublicKeyB64()!, 'carol')).toBe('group msg');
    });

    it('a peer not in encKeys cannot decrypt (returns null)', async () => {
      await enc.generateKey();
      const bob = new MessageEncryption();
      await bob.generateKey();
      const bobPeer = makePeer('bob', bob);
      const encrypted = await enc.encrypt('secret', 'room', [bobPeer], 'me');
      const eve = new MessageEncryption();
      await eve.generateKey();
      expect(await eve.decrypt(encrypted, 'room', enc.getEncPublicKeyB64()!, 'eve')).toBeNull();
    });

    it('decrypt returns null when not addressed to local peer', async () => {
      await enc.generateKey();
      const bob = new MessageEncryption();
      await bob.generateKey();
      const bobPeer = makePeer('bob', bob);
      const encrypted = await enc.encrypt('not for me', 'room', [bobPeer], 'me');
      expect(await enc.decrypt(encrypted, 'room', bobPeer.encPublicKey, 'me')).toBeNull();
    });

    it('tampered ciphertext causes decryption to fail (returns null)', async () => {
      await enc.generateKey();
      const bob = new MessageEncryption();
      await bob.generateKey();
      const bobPeer = makePeer('bob', bob);
      const encrypted = await enc.encrypt('original', 'room', [bobPeer], 'me');
      // Flip a bit in the ciphertext by replacing with a different base64 string of same length
      const tampered = { ...encrypted, content: encrypted.content.slice(0, -2) + 'AA' };
      expect(await bob.decrypt(tampered, 'room', enc.getEncPublicKeyB64()!, 'bob')).toBeNull();
    });

    it('keys are room-scoped: same peer pair in different rooms produces different wrapping', async () => {
      await enc.generateKey();
      const bob = new MessageEncryption();
      await bob.generateKey();
      const bobPeer = makePeer('bob', bob);
      const e1 = await enc.encrypt('msg', 'roomA', [bobPeer], 'me');
      const e2 = await enc.encrypt('msg', 'roomB', [bobPeer], 'me');
      // Wrapped CEKs differ because wrapping keys are derived with different room salts
      expect(e1.encKeys.bob).not.toBe(e2.encKeys.bob);
      // But bob can decrypt both
      expect(await bob.decrypt(e1, 'roomA', enc.getEncPublicKeyB64()!, 'bob')).toBe('msg');
      expect(await bob.decrypt(e2, 'roomB', enc.getEncPublicKeyB64()!, 'bob')).toBe('msg');
    });

    it('encrypt excludes the local peer from encKeys', async () => {
      await enc.generateKey();
      const me = makePeer('me', enc);
      const encrypted = await enc.encrypt('solo', 'room', [me], 'me');
      expect(encrypted.encKeys.me).toBeUndefined();
    });

    it('encrypt throws if generateKey has not been called', async () => {
      await expect(enc.encrypt('x', 'room', [], 'me')).rejects.toThrow('generateKey');
    });

    it('decrypt returns null if generateKey has not been called', async () => {
      const result = await enc.decrypt({ content: 'x', encIv: 'y', encKeys: { me: 'z' } }, 'room', 'pk', 'me');
      expect(result).toBeNull();
    });

    it('encrypts and decrypts unicode content correctly', async () => {
      await enc.generateKey();
      const bob = new MessageEncryption();
      await bob.generateKey();
      const bobPeer = makePeer('bob', bob);
      const text = 'héllo 世界 🎉';
      const encrypted = await enc.encrypt(text, 'room', [bobPeer], 'me');
      expect(await bob.decrypt(encrypted, 'room', enc.getEncPublicKeyB64()!, 'bob')).toBe(text);
    });

    it('caches wrapping key: repeated encrypts to same peer reuse derived key', async () => {
      await enc.generateKey();
      const bob = new MessageEncryption();
      await bob.generateKey();
      const bobPeer = makePeer('bob', bob);
      await enc.encrypt('first', 'room', [bobPeer], 'me');
      await enc.encrypt('second', 'room', [bobPeer], 'me');
      // No assertion on internals; verifies no error and both decryptable
      const e1 = await enc.encrypt('third', 'room', [bobPeer], 'me');
      expect(await bob.decrypt(e1, 'room', enc.getEncPublicKeyB64()!, 'bob')).toBe('third');
    });
  });

  describe('clear', () => {
    it('clears key material', async () => {
      await enc.generateKey();
      expect(enc.getEncPublicKeyB64()).not.toBeNull();
      enc.clear();
      expect(enc.getEncPublicKeyB64()).toBeNull();
      await expect(enc.encrypt('x', 'room', [], 'me')).rejects.toThrow('generateKey');
    });
  });
});
