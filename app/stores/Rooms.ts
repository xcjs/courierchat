import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Tier } from '#shared/types/Tier';

export interface RoomEntry {
  name: string;
  icon?: string;
  memberCount?: number;
  tiers: Tier[];
}

export const useRoomsStore = defineStore('rooms', () => {
  const rooms = ref<RoomEntry[]>([]);
  const search = ref('');

  const filteredRooms = computed(() => {
    const q = search.value.trim().toLowerCase();
    if (q === '') { return rooms.value; }
    return rooms.value.filter(r => r.name.toLowerCase().includes(q));
  });

  function roomsVisibleToTiers (sessionTiers: readonly Tier[]): RoomEntry[] {
    return rooms.value.filter(r => r.tiers.some(t => sessionTiers.includes(t)));
  }

  function addRoom (name: string, tiers: Tier[], icon?: string): void {
    if (rooms.value.some(r => r.name === name)) { return; }
    rooms.value.push({ name, icon, memberCount: 1, tiers });
  }

  function removeRoom (name: string): void {
    rooms.value = rooms.value.filter(r => r.name !== name);
  }

  function getRoom (name: string): RoomEntry | undefined {
    return rooms.value.find(r => r.name === name);
  }

  function setSearch (query: string): void {
    search.value = query;
  }

  return { rooms, search, filteredRooms, roomsVisibleToTiers, addRoom, removeRoom, getRoom, setSearch };
});
