import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRoomsStore } from './Rooms';
import type { Tier } from '#shared/types/Tier';

describe('RoomsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('starts empty', () => {
    const store = useRoomsStore();
    expect(store.rooms).toEqual([]);
    expect(store.filteredRooms).toEqual([]);
  });

  it('addRoom adds a room with tiers and memberCount 1', () => {
    const store = useRoomsStore();
    store.addRoom('general', ['adult']);
    expect(store.rooms).toHaveLength(1);
    expect(store.rooms[0]).toEqual({ name: 'general', icon: undefined, memberCount: 1, tiers: ['adult'] });
  });

  it('addRoom is idempotent by name', () => {
    const store = useRoomsStore();
    store.addRoom('general', ['adult']);
    store.addRoom('general', ['minor']);
    expect(store.rooms).toHaveLength(1);
    expect(store.rooms[0]?.tiers).toEqual(['adult']);
  });

  it('addRoom accepts an optional icon', () => {
    const store = useRoomsStore();
    store.addRoom('random', ['adult'], 'lucide:hash');
    expect(store.rooms[0]?.icon).toBe('lucide:hash');
  });

  it('removeRoom removes by name', () => {
    const store = useRoomsStore();
    store.addRoom('general', ['adult']);
    store.addRoom('random', ['adult']);
    store.removeRoom('general');
    expect(store.rooms.map(r => r.name)).toEqual(['random']);
  });

  it('getRoom returns the room or undefined', () => {
    const store = useRoomsStore();
    store.addRoom('general', ['adult']);
    expect(store.getRoom('general')?.name).toBe('general');
    expect(store.getRoom('missing')).toBeUndefined();
  });

  it('filteredRooms matches by case-insensitive substring', () => {
    const store = useRoomsStore();
    store.addRoom('General', ['adult']);
    store.addRoom('Random', ['adult']);
    store.addRoom('gen-z', ['adult']);
    store.setSearch('gen');
    expect(store.filteredRooms.map(r => r.name)).toEqual(['General', 'gen-z']);
  });

  it('filteredRooms returns all when search is empty', () => {
    const store = useRoomsStore();
    store.addRoom('General', ['adult']);
    store.addRoom('Random', ['adult']);
    store.setSearch('');
    expect(store.filteredRooms).toHaveLength(2);
  });

  it('filteredRooms returns all when search is whitespace-only', () => {
    const store = useRoomsStore();
    store.addRoom('General', ['adult']);
    store.setSearch('   ');
    expect(store.filteredRooms).toHaveLength(1);
  });

  describe('roomsVisibleToTiers', () => {
    it('returns only rooms whose tiers intersect the session tiers', () => {
      const store = useRoomsStore();
      store.addRoom('adult-room', ['adult']);
      store.addRoom('minor-room', ['minor']);
      store.addRoom('mixed-room', ['adult', 'minor']);
      const visible = store.roomsVisibleToTiers(['adult'] as Tier[]);
      expect(visible.map(r => r.name).sort()).toEqual(['adult-room', 'mixed-room']);
    });

    it('returns empty for a session with no tiers', () => {
      const store = useRoomsStore();
      store.addRoom('general', ['adult']);
      expect(store.roomsVisibleToTiers([])).toEqual([]);
    });

    it('returns all rooms whose tiers overlap when session has multiple tiers', () => {
      const store = useRoomsStore();
      store.addRoom('adult-room', ['adult']);
      store.addRoom('minor-room', ['minor']);
      store.addRoom('mixed-room', ['adult', 'minor']);
      const visible = store.roomsVisibleToTiers(['adult', 'minor'] as Tier[]);
      expect(visible).toHaveLength(3);
    });
  });
});
