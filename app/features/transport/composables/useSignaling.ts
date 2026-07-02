import { computed, readonly, type ComputedRef, type Ref } from 'vue';
import { SignalingClient } from '../services/SignalingClient';
import { MessageCrypto } from '../services/MessageCrypto';
import { MessageEncryption } from '../services/MessageEncryption';
import { SignalingConnectionState } from '../types/Transport';
import type { SignalingHandlers } from '../types/Transport';
import type { Tier } from '#shared/types/Tier';
import { useRuntimeConfig } from '#imports';
import { usePresenceStore } from '~/stores/Presence';
import { useNotificationsStore, NotificationSeverity } from '~/stores/Notifications';
import { useRoomsStore } from '~/stores/Rooms';

/**
 * useSignaling wraps the framework-agnostic SignalingClient in a Nuxt
 * singleton with reactive connection state. The same SignalingClient instance
 * is shared across all consumers within a single client-side app lifecycle
 * (stored via useState so it survives route navigations).
 *
 * Room-specific wiring (RtcManager, room state) is handled by useRoomTransport,
 * which calls `getClient()` here and registers its own handlers via
 * `addHandlers`.
 */
export interface UseSignalingReturn {
  getClient: () => SignalingClient | null;
  getCrypto: () => MessageCrypto | null;
  getEncryption: () => MessageEncryption | null;
  connect: (username: string, tiers: Tier[]) => Promise<void>;
  disconnect: () => void;
  addHandlers: (handlers: Partial<SignalingHandlers>) => void;
  connectionState: Readonly<Ref<SignalingConnectionState>>;
  isConnected: ComputedRef<boolean>;
  signalingError: Readonly<Ref<string | null>>;
  iceServers: RTCIceServer[];
}

export function useSignaling (): UseSignalingReturn {
  const client = useState<SignalingClient | null>('signaling:client', () => null);
  const cryptoInstance = useState<MessageCrypto | null>('signaling:crypto', () => null);
  const encryptionInstance = useState<MessageEncryption | null>('signaling:encryption', () => null);
  const connectionState = useState<SignalingConnectionState>('signaling:state', () => SignalingConnectionState.Disconnected);
  const signalingError = useState<string | null>('signaling:error', () => null);

  const runtimeConfig = useRuntimeConfig();
  const stunEnabled = runtimeConfig.public?.stunEnabled ?? false;
  const stunHost = runtimeConfig.public?.stunHost || (import.meta.client ? window.location.hostname : 'localhost');
  const stunPort = runtimeConfig.public?.stunPort ?? 3478;

  const iceServers = stunEnabled
    ? [{ urls: `stun:${stunHost}:${stunPort}` }]
    : [];

  const isConnected = computed(() => connectionState.value === SignalingConnectionState.Connected);

  function getClient (): SignalingClient | null {
    return client.value;
  }

  function buildUrl (): string {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/signaling`;
  }

  /**
   * Connect to the signaling server using the current session credentials.
   * Resolves once the WebSocket handshake completes and hello is sent.
   */
  async function connect (username: string, tiers: Tier[]): Promise<void> {
    if (client.value?.isConnected()) { return; }

    const presence = usePresenceStore();
    const notifications = useNotificationsStore();

    // Generate the ECDSA keypair before connecting so the public key can be
    // sent in Hello and distributed to other peers for signature verification.
    const crypto = new MessageCrypto();
    const keyMaterial = await crypto.generateKey();
    cryptoInstance.value = crypto;

    // Generate the ECDH keypair for end-to-end message encryption (ADR 0003).
    const encryption = new MessageEncryption();
    const encKeyMaterial = await encryption.generateKey();
    encryptionInstance.value = encryption;

    const instance = new SignalingClient({
      url: buildUrl(),
      lifecycle: {
        onOpen: () => { connectionState.value = SignalingConnectionState.Connected; },
        onClose: () => { connectionState.value = SignalingConnectionState.Disconnected; },
        onError: () => {
          signalingError.value = 'Connection error';
          notifications.push('Signaling connection error', NotificationSeverity.Error);
        }
      }
    });
    // Register presence handlers before connecting so the Welcome snapshot
    // and subsequent Presence broadcasts are captured.
    instance.setHandlers({
      onWelcome: (_peerId, onlineUsernames) => {
        presence.setOnlineUsernames(onlineUsernames);
      },
      onPresence: (user, status) => {
        presence.updatePresence(user, status);
      },
      onRoomList: (rooms) => {
        useRoomsStore().setRoomsFromServer(rooms);
      }
    });
    client.value = instance;
    connectionState.value = SignalingConnectionState.Connecting;
    signalingError.value = null;
    await instance.connect(username, tiers, keyMaterial.publicKeyB64, encKeyMaterial.encPublicKeyB64);
  }

  /**
   * Disconnect from the signaling server and clear the singleton.
   */
  function getCrypto (): MessageCrypto | null {
    return cryptoInstance.value;
  }

  /**
   * Get the ECDH encryption singleton (or null if not connected).
   */
  function getEncryption (): MessageEncryption | null {
    return encryptionInstance.value;
  }

  /**
   * Disconnect from the signaling server and clear the singleton.
   */
  function disconnect (): void {
    client.value?.disconnect();
    client.value = null;
    cryptoInstance.value?.clear();
    cryptoInstance.value = null;
    encryptionInstance.value?.clear();
    encryptionInstance.value = null;
    connectionState.value = SignalingConnectionState.Disconnected;
    usePresenceStore().reset();
  }

  /**
   * Register additional message handlers (merged, non-destructive).
   */
  function addHandlers (handlers: Partial<SignalingHandlers>): void {
    client.value?.addHandlers(handlers);
  }

  return {
    getClient,
    getCrypto,
    getEncryption,
    connect,
    disconnect,
    addHandlers,
    connectionState: readonly(connectionState),
    isConnected,
    signalingError: readonly(signalingError),
    iceServers
  };
}
