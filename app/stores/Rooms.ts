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
    const existing = rooms.value.find(r => r.name === name);
    if (existing) {
      // Name collision: mark joined and refresh tiers/icon so a stale entry
      // doesn't gate visibility on outdated metadata.
      existing.joined = true;
      existing.tiers = tiers;
      if (icon !== undefined) { existing.icon = icon; }
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
   * rooms only) stays accurate. Rooms that exist locally but are absent from
   * the server snapshot are kept (optimistic entries not yet registered
   * server-side, e.g. immediately after createRoom) so the UI doesn't flash
   * "Room not found" before the server broadcasts back.
   */
  function setRoomsFromServer (summaries: RoomSummary[]): void {
    const prevByName = new Map(rooms.value.map(r => [r.name, r]));
    rooms.value = [
      ...summaries.map((s) => {
        const prev = prevByName.get(s.name);
        return {
          name: s.name,
          icon: s.icon,
          memberCount: s.memberCount,
          tiers: s.tiers,
          joined: prev?.joined ?? false
        };
      }),
      // Preserve locally-known rooms missing from the server snapshot (e.g.
      // optimistic entries created via addRoom before the server registered
      // them). Their server-derived metadata is unknown, so we keep prior
      // local metadata intact.
      ...rooms.value.filter(r => !summaries.some(s => s.name === r.name))
    ];
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

  /**
   * Clear all room state. Called on disconnect/logout so a subsequent login
   * (potentially as a different user with different tiers) does not inherit
   * stale rooms or joined status from the previous session.
   */
  function reset (): void {
    rooms.value = [];
    search.value = '';
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
    setSearch,
    reset
  };
});
