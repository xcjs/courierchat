import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Tier } from '#shared/types/Tier';
import type { RoomSummary } from '#shared/types/Signaling';

export interface RoomEntry {
  name: string;
  icon?: string;
  memberCount?: number;
  tiers: Tier[];
  /** Whether the local user is currently a member of this room. */
  joined?: boolean;
}

export const useRoomsStore = defineStore('rooms', () => {
  const rooms = ref<RoomEntry[]>([]);
  const search = ref('');

  const filteredRooms = computed(() => {
    const q = search.value.trim().toLowerCase();
    if (q === '') { return rooms.value; }
    return rooms.value.filter(r => r.name.toLowerCase().includes(q));
  });

  const joinedRooms = computed(() => rooms.value.filter(r => r.joined));

  function roomsVisibleToTiers (sessionTiers: readonly Tier[]): RoomEntry[] {
    return rooms.value.filter(r => r.tiers.some(t => sessionTiers.includes(t)));
  }

  function joinedRoomsVisibleToTiers (sessionTiers: readonly Tier[]): RoomEntry[] {
    return joinedRooms.value.filter(r => r.tiers.some(t => sessionTiers.includes(t)));
  }

  function addRoom (name: string, tiers: Tier[], icon?: string): void {
    if (rooms.value.some(r => r.name === name)) {
      markJoined(name);
      return;
    }
    rooms.value.push({ name, icon, memberCount: 1, tiers, joined: true });
  }

  function removeRoom (name: string): void {
    rooms.value = rooms.value.filter(r => r.name !== name);
  }

  function getRoom (name: string): RoomEntry | undefined {
    return rooms.value.find(r => r.name === name);
  }

  /**
   * Replace the room list from a server RoomList payload. The server sends
   * all rooms visible to the session's tiers. The local `joined` status is
   * preserved across the replacement so the sidebar (which shows joined
   * rooms only) stays accurate.
   */
  function setRoomsFromServer (summaries: RoomSummary[]): void {
    const prevJoined = new Set(rooms.value.filter(r => r.joined).map(r => r.name));
    rooms.value = summaries.map(s => ({
      name: s.name,
      icon: s.icon,
      memberCount: s.memberCount,
      tiers: s.tiers,
      joined: prevJoined.has(s.name)
    }));
  }

  function markJoined (name: string): void {
    const r = rooms.value.find(r => r.name === name);
    if (r) { r.joined = true; }
  }

  function markLeft (name: string): void {
    const r = rooms.value.find(r => r.name === name);
    if (r) { r.joined = false; }
  }

  function setSearch (query: string): void {
    search.value = query;
  }

  return {
    rooms,
    search,
    filteredRooms,
    joinedRooms,
    roomsVisibleToTiers,
    joinedRoomsVisibleToTiers,
    addRoom,
    removeRoom,
    getRoom,
    setRoomsFromServer,
    markJoined,
    markLeft,
    setSearch
  };
});
