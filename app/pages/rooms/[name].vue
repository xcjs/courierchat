<template>
  <div class="flex flex-col h-full">
    <div v-if="!room" class="flex flex-col items-center justify-center h-full text-center px-6">
      <Icon name="lucide:door-closed" size="32" class="mb-3 text-text-content/20" />
      <h2 class="text-lg font-medium text-text-content mb-1">
        Room not found
      </h2>
      <p class="text-sm text-text-content/50 mb-4">
        "{{ roomName }}" doesn't exist or isn't visible to your session.
      </p>
      <NuxtLink
        to="/rooms"
        class="px-4 py-2 rounded bg-background-interactive text-text-content-inverted font-medium shadow-courier-drop"
      >
        Back to Rooms
      </NuxtLink>
    </div>

    <RoomChat v-else :room-name="roomName" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from '#imports';
import { useRoomsStore } from '~/stores/Rooms';
import { useSessionStore } from '~/stores/Session';

definePageMeta({ layout: 'default' });

const route = useRoute();
const roomsStore = useRoomsStore();
const session = useSessionStore();

const roomName = computed(() => {
  const name = route.params?.name;
  return typeof name === 'string' ? decodeURIComponent(name) : '';
});

const room = computed(() => {
  const r = roomsStore.getRoom(roomName.value);
  if (!r) { return undefined; }
  const visible = r.tiers.some(t => session.tiers.includes(t));
  return visible ? r : undefined;
});
</script>
