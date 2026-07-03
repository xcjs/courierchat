import { describe, it, expect, beforeEach } from 'vitest';
import { MessageCrypto } from './MessageCrypto';

describe('MessageCrypto', () => {
  let crypto: MessageCrypto;

  beforeEach(() => {
    crypto = new MessageCrypto();
  });

  describe('generateKey', () => {
    it('returns KeyMaterial with base64 public key', async () => {
      const keyMaterial = await crypto.generateKey();
      expect(keyMaterial.publicKeyB64).toBeTruthy();
      expect(typeof keyMaterial.publicKeyB64).toBe('string');
      // Base64 string should be non-empty
      expect(keyMaterial.publicKeyB64.length).toBeGreaterThan(0);
      expect(keyMaterial.privateKey).toBeDefined();
    });

    it('getPublicKeyB64 returns null before generateKey', () => {
      expect(crypto.getPublicKeyB64()).toBeNull();
    });

    it('getPublicKeyB64 returns the key after generateKey', async () => {
      const keyMaterial = await crypto.generateKey();
      expect(crypto.getPublicKeyB64()).toBe(keyMaterial.publicKeyB64);
    });
  });

  describe('sign and verify', () => {
    const message = { id: 'm-1', author: 'alice', content: 'hello', timestamp: 12345 };

    it('signs a message and verifies it with the correct public key', async () => {
      const keyMaterial = await crypto.generateKey();
      const signature = await crypto.sign(message);
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);

      const ok = await crypto.verify(message, signature, keyMaterial.publicKeyB64);
      expect(ok).toBe(true);
    });

    it('verification fails with wrong public key', async () => {
      await crypto.generateKey();
      const signature = await crypto.sign(message);

      // Generate a second keypair to get a different public key
      const crypto2 = new MessageCrypto();
      const key2 = await crypto2.generateKey();

      const ok = await crypto.verify(message, signature, key2.publicKeyB64);
      expect(ok).toBe(false);
    });

    it('verification fails with tampered message content', async () => {
      const keyMaterial = await crypto.generateKey();
      const signature = await crypto.sign(message);

      const tampered = { ...message, content: 'hacked' };
      const ok = await crypto.verify(tampered, signature, keyMaterial.publicKeyB64);
      expect(ok).toBe(false);
    });

    it('verification fails with tampered message author', async () => {
      const keyMaterial = await crypto.generateKey();
      const signature = await crypto.sign(message);

      const tampered = { ...message, author: 'mallory' };
      const ok = await crypto.verify(tampered, signature, keyMaterial.publicKeyB64);
      expect(ok).toBe(false);
    });

    it('verification fails with tampered message timestamp', async () => {
      const keyMaterial = await crypto.generateKey();
      const signature = await crypto.sign(message);

      const tampered = { ...message, timestamp: 99999 };
      const ok = await crypto.verify(tampered, signature, keyMaterial.publicKeyB64);
      expect(ok).toBe(false);
    });

    it('verification fails with tampered message id', async () => {
      const keyMaterial = await crypto.generateKey();
      const signature = await crypto.sign(message);

      const tampered = { ...message, id: 'different-id' };
      const ok = await crypto.verify(tampered, signature, keyMaterial.publicKeyB64);
      expect(ok).toBe(false);
    });

    it('sign throws if generateKey has not been called', async () => {
      await expect(crypto.sign(message)).rejects.toThrow('generateKey');
    });

    it('verify returns false for invalid base64 signature', async () => {
      const keyMaterial = await crypto.generateKey();
      const ok = await crypto.verify(message, '!!!invalid-base64!!!', keyMaterial.publicKeyB64);
      expect(ok).toBe(false);
    });

    it('verify returns false for invalid public key', async () => {
      const signature = await crypto.sign(message).catch(() => 'sig');
      const ok = await crypto.verify(message, signature, '!!!invalid-key!!!');
      expect(ok).toBe(false);
    });

    it('signs and verifies multiple messages independently', async () => {
      const keyMaterial = await crypto.generateKey();
      const messages = [
        { id: 'm1', author: 'alice', content: 'first', timestamp: 100 },
        { id: 'm2', author: 'alice', content: 'second', timestamp: 200 },
        { id: 'm3', author: 'alice', content: 'third', timestamp: 300 }
      ];
      for (const msg of messages) {
        const sig = await crypto.sign(msg);
        const ok = await crypto.verify(msg, sig, keyMaterial.publicKeyB64);
        expect(ok).toBe(true);
      }
    });
  });

  describe('clear', () => {
    it('clears key material', async () => {
      await crypto.generateKey();
      expect(crypto.getPublicKeyB64()).not.toBeNull();
      crypto.clear();
      expect(crypto.getPublicKeyB64()).toBeNull();
      await expect(crypto.sign({ id: 'x', author: 'x', content: 'x', timestamp: 0 })).rejects.toThrow();
    });
  });

  describe('canonical representation', () => {
    it('treats same content identically regardless of object key order', async () => {
      const keyMaterial = await crypto.generateKey();
      const msg1 = { id: 'm1', author: 'a', content: 'c', timestamp: 1 };
      const msg2 = { content: 'c', id: 'm1', timestamp: 1, author: 'a' };
      const sig1 = await crypto.sign(msg1);
      const ok = await crypto.verify(msg2, sig1, keyMaterial.publicKeyB64);
      expect(ok).toBe(true);
    });
  });
});
