<template>
  <div class="h-screen flex flex-col bg-white text-text-content">
    <ShellHeader
      :room-name="activeRoomName ?? undefined"
      :member-count="memberCount"
      :transport-mode="transportMode"
      :username="username"
      @logout="onLogout"
    />
    <div class="flex flex-1 min-h-0">
      <ShellIconRail
        :rooms="rooms"
        :active-room-name="activeRoomName ?? undefined"
        @create-room="onCreateRoom"
      />
      <div class="flex flex-col flex-1 min-w-0 overflow-hidden">
        <main class="flex-1 w-full overflow-y-auto bg-white">
          <slot />
        </main>
        <ShellStatusBar
          :connected="signalingConnected"
          :heartbeat="heartbeatActive"
          :transport-mode="transportMode"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute } from '#imports';
import { useRoomsStore } from '~/stores/Rooms';
import { useSessionStore } from '~/stores/Session';
import { useConnectionStore } from '~/stores/Connection';
import { useSignaling } from '~/features/transport/composables/useSignaling';
import { UiTransportMode } from '~/features/transport/types/Transport';

const route = useRoute();
const session = useSessionStore();
const roomsStore = useRoomsStore();
const connection = useConnectionStore();
const signaling = useSignaling();

const rooms = computed(() => roomsStore.roomsVisibleToTiers(session.tiers));
const username = computed(() => session.username);

const activeRoomName = computed(() => {
  const name = route.params?.name;
  return typeof name === 'string' ? decodeURIComponent(name) : null;
});

const memberCount = computed(() => {
  if (activeRoomName.value === null) { return undefined; }
  return roomsStore.getRoom(activeRoomName.value)?.memberCount;
});

const transportMode = computed<UiTransportMode>(() => connection.transportMode);
const signalingConnected = computed(() => connection.signalingConnected);
const heartbeatActive = computed(() => connection.heartbeatActive);

// Keep the connection store in sync with the active route.
watch(activeRoomName, (name) => {
  connection.setActiveRoom(name);
});

watch(() => signaling.isConnected.value, (isConn) => {
  connection.setSignalingConnected(isConn);
  connection.setHeartbeatActive(isConn);
});

async function ensureConnected (): Promise<void> {
  if (!session.isAuthenticated) { return; }
  if (signaling.isConnected.value) { return; }
  if (import.meta.server) { return; }
  if (!session.username) { return; }
  await signaling.connect(session.username, session.tiers);
}

onMounted(() => {
  connection.setActiveRoom(activeRoomName.value);
  ensureConnected().catch(() => { /* transport will retry */ });
});

onBeforeUnmount(() => {
  signaling.disconnect();
  connection.reset();
});

// Reconnect if the session changes (e.g. re-login without full reload).
watch(() => session.username, () => {
  if (session.isAuthenticated) { ensureConnected().catch(() => {}); }
});

function onCreateRoom (): void {
  navigateTo('/rooms');
}

function onLogout (): void {
  signaling.disconnect();
  connection.reset();
  session.clear();
  navigateTo('/login');
}
</script>
