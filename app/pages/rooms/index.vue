<template>
  <div class="flex flex-col h-full max-w-md mx-auto p-6">
    <div class="flex items-center gap-3 mb-6">
      <h1 class="text-2xl font-semibold text-text-content">
        Rooms
      </h1>
      <span class="text-sm text-text-content/50">
        {{ rooms.length }}
      </span>
    </div>

    <div class="relative mb-4">
      <Icon
        name="lucide:search"
        size="16"
        class="absolute left-3 top-1/2 -translate-y-1/2 text-text-content/40 pointer-events-none"
      />
      <input
        v-model="searchQuery"
        type="search"
        placeholder="Search rooms"
        class="w-full pl-9 pr-4 py-2 rounded border border-text-content/15 bg-white text-text-content text-sm focus:outline-none focus:border-background-interactive"
        @input="onSearch"
      >
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto -mx-2">
      <ul v-if="filteredRooms.length" class="space-y-1 px-2">
        <li>
          <button
            type="button"
            class="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-background-interactive/10 text-left"
            @click="showCreate = true"
          >
            <span class="w-9 h-9 rounded-full bg-white flex items-center justify-center text-background-interactive shrink-0">
              <Icon name="lucide:plus" size="18" />
            </span>
            <span class="text-sm font-medium text-text-content">Create a Room</span>
          </button>
        </li>
        <li v-for="room in filteredRooms" :key="room.name">
          <NuxtLink
            :to="`/rooms/${encodeURIComponent(room.name)}`"
            class="flex items-center gap-3 px-3 py-2 rounded hover:bg-background-interactive/10 group"
          >
            <span class="w-9 h-9 rounded-full bg-white flex items-center justify-center text-background-interactive shrink-0">
              <template v-if="room.icon">
                <Icon v-if="!room.icon.startsWith('emoji:')" :name="room.icon" size="18" class="text-background-interactive" />
                <span v-else aria-hidden="true">{{ room.icon.slice(6) }}</span>
              </template>
              <img v-else src="/courierchat.svg" alt="" class="w-full h-full rounded-full">
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-medium text-text-content truncate">{{ room.name }}</span>
              <span class="block text-xs text-text-content/50">
                {{ room.memberCount ?? 0 }} {{ (room.memberCount ?? 0) === 1 ? 'member' : 'members' }}
              </span>
            </span>
            <Icon name="lucide:chevron-right" size="16" class="text-text-content/30 group-hover:text-text-content/60 shrink-0" />
          </NuxtLink>
        </li>
      </ul>
      <div v-else class="px-2 py-12 text-center">
        <p class="text-text-content/50 mb-4">
          {{ rooms.length === 0 ? "You're the first. Give people something to talk about!" : 'No rooms match your search.' }}
        </p>
        <button
          v-if="rooms.length === 0"
          type="button"
          class="px-4 py-2 rounded bg-background-interactive text-text-content-inverted font-medium shadow-courier-drop"
          @click="showCreate = true"
        >
          Create a Room
        </button>
      </div>
    </div>

    <CreateRoomModal v-if="showCreate" :tiers="sessionTiers" @create="onCreate" @close="showCreate = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoomsStore } from '~/stores/Rooms';
import { useSessionStore } from '~/stores/Session';
import { useCreateRoom } from '~/features/room/composables/useCreateRoom';
import CreateRoomModal from '~/components/rooms/CreateRoomModal.vue';
import type { Tier } from '#shared/types/Tier';

definePageMeta({ layout: 'default' });

const roomsStore = useRoomsStore();
const sessionStore = useSessionStore();

const rooms = computed(() => roomsStore.roomsVisibleToTiers(sessionTiers.value));
const filteredRooms = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (q === '') { return rooms.value; }
  return rooms.value.filter(r => r.name.toLowerCase().includes(q));
});
const searchQuery = ref(roomsStore.search);
const sessionTiers = computed<Tier[]>(() => sessionStore.tiers);

const showCreate = ref(false);

function onSearch (): void {
  roomsStore.setSearch(searchQuery.value);
}

function onCreate (name: string, tiers: Tier[], icon?: string): void {
  useCreateRoom().createRoom(name, tiers, icon);
  showCreate.value = false;
}
</script>
