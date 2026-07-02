// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useCreateRoom } from './useCreateRoom';
import { useRoomsStore } from '~/stores/Rooms';
import { Tier } from '#shared/types/Tier';

describe('useCreateRoom', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('adds the room to the store before navigating', () => {
    const roomsStore = useRoomsStore();
    const navigate = vi.fn();
    const { createRoom } = useCreateRoom();
    createRoom('my-room', [Tier.Adult], undefined, navigate);
    expect(roomsStore.getRoom('my-room')).toBeDefined();
    expect(roomsStore.getRoom('my-room')?.tiers).toEqual([Tier.Adult]);
  });

  it('navigates to the encoded room route', () => {
    const navigate = vi.fn();
    const { createRoom } = useCreateRoom();
    createRoom('test room', [Tier.Minor], undefined, navigate);
    expect(navigate).toHaveBeenCalledWith('/rooms/test%20room');
  });

  it('uses the provided tier for a minor', () => {
    const roomsStore = useRoomsStore();
    const navigate = vi.fn();
    const { createRoom } = useCreateRoom();
    createRoom('minor-room', [Tier.Minor], undefined, navigate);
    expect(roomsStore.getRoom('minor-room')?.tiers).toEqual([Tier.Minor]);
  });

  it('passes the optional icon through to the store', () => {
    const roomsStore = useRoomsStore();
    const navigate = vi.fn();
    const { createRoom } = useCreateRoom();
    createRoom('icon-room', [Tier.Adult], 'lucide:hash', navigate);
    expect(roomsStore.getRoom('icon-room')?.icon).toBe('lucide:hash');
  });

  it('makes the room immediately visible to the [name] route', () => {
    const roomsStore = useRoomsStore();
    const navigate = vi.fn();
    const { createRoom } = useCreateRoom();
    createRoom('instant', [Tier.Adult], undefined, navigate);
    const entry = roomsStore.getRoom('instant');
    expect(entry).toBeDefined();
    expect(entry?.tiers.some(t => [Tier.Adult].includes(t))).toBe(true);
  });
});
