<template>
  <div class="h-screen flex flex-col overflow-hidden bg-white text-text-content">
    <div class="flex flex-1 overflow-hidden">
      <ShellIconRail
        :rooms="rooms"
        :active-room-name="activeRoomName"
        @create-room="onCreateRoom"
      />
      <div class="flex flex-col flex-1 overflow-hidden">
        <ShellHeader
          :room-name="activeRoomName"
          :member-count="memberCount"
          :transport-mode="transportMode"
          :username="username"
          @logout="onLogout"
        />
        <main class="flex-1 overflow-y-auto bg-white">
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

type TransportMode = 'mesh' | 'star' | 'relay' | 'offline'

interface RoomEntry {
  name: string
  icon?: string
}

const route = useRoute();
const session = useSessionStore();

// Placeholder store wiring (real stores arrive with feature work)
const rooms = ref<RoomEntry[]>([]);
const connected = ref(false);
const memberCount = ref<number | undefined>(undefined);
const transportMode = ref<TransportMode>('offline');

const username = computed(() => session.username);

const activeRoomName = computed(() => {
  const name = route.params?.name;
  return typeof name === 'string' ? decodeURIComponent(name) : undefined;
});

function onCreateRoom (): void {
  navigateTo('/rooms');
}

function onLogout (): void {
  session.clear();
  navigateTo('/login');
}
</script>
