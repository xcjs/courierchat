import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { UiTransportMode } from '~/features/transport/types/Transport';

/**
 * Connection store holds cross-cutting transport state per ADR 0001 hybrid
 * decision. Signaling connection + active-room transport mode are shared by
 * the layout shell, settings page, and status bar. Room-local message/participant
 * state stays in feature composables (useState) per the same decision.
 */
export const useConnectionStore = defineStore('connection', () => {
  const signalingConnected = ref(false);
  const heartbeatActive = ref(false);
  const activeRoomName = ref<string | null>(null);
  const activeRoomMode = ref<UiTransportMode>(UiTransportMode.Offline);
  const activeRoomPeerCount = ref(0);

  const transportMode = computed<UiTransportMode>(() => {
    if (!signalingConnected.value) { return UiTransportMode.Offline; }
    return activeRoomName.value === null
      ? UiTransportMode.Offline
      : activeRoomMode.value;
  });

  function setSignalingConnected (value: boolean): void {
    signalingConnected.value = value;
  }

  function setHeartbeatActive (value: boolean): void {
    heartbeatActive.value = value;
  }

  function setActiveRoom (name: string | null): void {
    activeRoomName.value = name;
    if (name === null) {
      activeRoomMode.value = UiTransportMode.Offline;
      activeRoomPeerCount.value = 0;
    }
  }

  function setActiveRoomMode (mode: UiTransportMode): void {
    activeRoomMode.value = mode;
  }

  function setActiveRoomPeerCount (count: number): void {
    activeRoomPeerCount.value = count;
  }

  function reset (): void {
    signalingConnected.value = false;
    heartbeatActive.value = false;
    activeRoomName.value = null;
    activeRoomMode.value = UiTransportMode.Offline;
    activeRoomPeerCount.value = 0;
  }

  return {
    signalingConnected,
    heartbeatActive,
    activeRoomName,
    activeRoomMode,
    activeRoomPeerCount,
    transportMode,
    setSignalingConnected,
    setHeartbeatActive,
    setActiveRoom,
    setActiveRoomMode,
    setActiveRoomPeerCount,
    reset
  };
});
