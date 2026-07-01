<template>
  <div class="h-screen flex flex-col bg-white text-text-content">
    <ShellHeader
      :room-name="activeRoomName"
      :member-count="memberCount"
      :transport-mode="transportMode"
      :username="username"
      @logout="onLogout"
    />
    <div class="flex flex-1 min-h-0">
      <ShellIconRail
        :rooms="rooms"
        :active-room-name="activeRoomName"
        @create-room="onCreateRoom"
      />
      <div class="flex flex-col flex-1 min-w-0 overflow-hidden">
        <main class="flex-1 w-full overflow-y-auto bg-white">
          <slot />
        </main>
        <ShellStatusBar
          :connected="connected"
          :heartbeat="connected"
          :transport-mode="transportMode"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from '#imports';
import { useRoomsStore } from '~/stores/Rooms';
import { UiTransportMode } from '~/features/transport/types/Transport';

const route = useRoute();
const session = useSessionStore();
const roomsStore = useRoomsStore();

const connected = ref(false);
const transportMode = ref<UiTransportMode>(UiTransportMode.Offline);

const rooms = computed(() => roomsStore.roomsVisibleToTiers(session.tiers));
const username = computed(() => session.username);

const activeRoomName = computed(() => {
  const name = route.params?.name;
  return typeof name === 'string' ? decodeURIComponent(name) : undefined;
});

const memberCount = computed(() => {
  if (activeRoomName.value === undefined) { return undefined; }
  return roomsStore.getRoom(activeRoomName.value)?.memberCount;
});

function onCreateRoom (): void {
  navigateTo('/rooms');
}

function onLogout (): void {
  session.clear();
  navigateTo('/login');
}
</script>
