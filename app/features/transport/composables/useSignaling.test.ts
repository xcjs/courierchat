// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SignalingConnectionState } from '../types/Transport';
import { useSignaling } from './useSignaling';
import { Tier } from '#shared/types/Tier';
import { PresenceStatus } from '#shared/types/Signaling';

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  isConnected: vi.fn(() => false),
  setHandlers: vi.fn(),
  addHandlers: vi.fn()
}));

vi.mock('../services/SignalingClient', () => {
  class MockSignalingClient {
    connect = mocks.connect;
    disconnect = mocks.disconnect;
    isConnected = mocks.isConnected;
    setHandlers = mocks.setHandlers;
    addHandlers = mocks.addHandlers;
  }
  return { SignalingClient: MockSignalingClient };
});

describe('useSignaling', () => {
  let signaling: ReturnType<typeof useSignaling>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connect.mockResolvedValue(undefined);
    mocks.isConnected.mockReturnValue(false);
    signaling = useSignaling();
  });

  afterEach(() => {
    signaling.disconnect();
  });

  it('starts disconnected with no client', () => {
    expect(signaling.isConnected.value).toBe(false);
    expect(signaling.connectionState.value).toBe(SignalingConnectionState.Disconnected);
    expect(signaling.getClient()).toBeNull();
    expect(signaling.signalingError.value).toBeNull();
  });

  it('connect creates a SignalingClient and calls connect with publicKey', async () => {
    await signaling.connect('alice', [Tier.Adult]);
    expect(mocks.connect).toHaveBeenCalledWith('alice', [Tier.Adult], expect.any(String), expect.any(String));
    expect(signaling.getClient()).not.toBeNull();
    expect(signaling.getCrypto()).not.toBeNull();
    expect(signaling.getEncryption()).not.toBeNull();
  });

  it('disconnect calls client.disconnect and clears state', async () => {
    await signaling.connect('alice', [Tier.Adult]);
    signaling.disconnect();

    expect(mocks.disconnect).toHaveBeenCalled();
    expect(signaling.getClient()).toBeNull();
    expect(signaling.getCrypto()).toBeNull();
    expect(signaling.getEncryption()).toBeNull();
    expect(signaling.connectionState.value).toBe(SignalingConnectionState.Disconnected);
    expect(signaling.isConnected.value).toBe(false);
  });

  it('disconnect resets the presence store', async () => {
    await signaling.connect('alice', [Tier.Adult]);
    const handlers = mocks.setHandlers.mock.calls[0]![0];
    handlers.onWelcome('peer-1', ['bob']);
    signaling.disconnect();
    const presence = usePresenceStore();
    expect(presence.onlineUsernames).toEqual([]);
  });

  it('does not reconnect if already connected', async () => {
    await signaling.connect('alice', [Tier.Adult]);
    mocks.connect.mockClear();
    mocks.isConnected.mockReturnValue(true);
    await signaling.connect('alice', [Tier.Adult]);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('registers presence handlers on the client', async () => {
    await signaling.connect('alice', [Tier.Adult]);
    expect(mocks.setHandlers).toHaveBeenCalled();
    const handlers = mocks.setHandlers.mock.calls[0]![0];
    expect(handlers.onWelcome).toBeDefined();
    expect(handlers.onPresence).toBeDefined();
  });

  it('onWelcome populates the presence store', async () => {
    await signaling.connect('alice', [Tier.Adult]);
    const handlers = mocks.setHandlers.mock.calls[0]![0];

    handlers.onWelcome('peer-1', ['bob', 'carol']);
    const presence = usePresenceStore();
    expect(presence.onlineUsernames).toEqual(['bob', 'carol']);
  });

  it('onPresence updates the presence store for online status', async () => {
    await signaling.connect('alice', [Tier.Adult]);
    const handlers = mocks.setHandlers.mock.calls[0]![0];

    handlers.onPresence('dave', PresenceStatus.Online);
    const presence = usePresenceStore();
    expect(presence.onlineUsernames).toContain('dave');
  });

  it('onPresence updates the presence store for offline status', async () => {
    await signaling.connect('alice', [Tier.Adult]);
    const handlers = mocks.setHandlers.mock.calls[0]![0];

    handlers.onWelcome('peer-1', ['dave']);
    handlers.onPresence('dave', PresenceStatus.Offline);
    const presence = usePresenceStore();
    expect(presence.onlineUsernames).not.toContain('dave');
  });

  it('addHandlers delegates to the client', async () => {
    await signaling.connect('alice', [Tier.Adult]);
    const handlers = { onPeerJoined: vi.fn() };
    signaling.addHandlers(handlers);
    expect(mocks.addHandlers).toHaveBeenCalledWith(handlers);
  });

  it('addHandlers is a no-op when no client exists', () => {
    signaling.addHandlers({ onPeerJoined: vi.fn() });
    expect(mocks.addHandlers).not.toHaveBeenCalled();
  });

  it('clears signalingError on new connect', async () => {
    await signaling.connect('alice', [Tier.Adult]);
    signaling.disconnect();
    await signaling.connect('bob', [Tier.Adult]);
    expect(signaling.signalingError.value).toBeNull();
  });
});
