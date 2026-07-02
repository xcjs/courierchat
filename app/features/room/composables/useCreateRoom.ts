import { useRoomsStore } from '~/stores/Rooms';
import type { Tier } from '#shared/types/Tier';

type NavigateFn = (to: string) => unknown;

/**
 * useCreateRoom encapsulates the "create a room and navigate to it" flow
 * shared by the login screen and the rooms list. The room is added to the
 * Rooms store before navigating so that the `[name].vue` route finds it
 * (otherwise it renders the "Room not found" state).
 */
export function useCreateRoom (): { createRoom: (name: string, tiers: Tier[], icon?: string, navigate?: NavigateFn) => void } {
  const roomsStore = useRoomsStore();

  function createRoom (name: string, tiers: Tier[], icon?: string, navigate: NavigateFn = navigateTo): void {
    roomsStore.addRoom(name, tiers, icon);
    navigate(`/rooms/${encodeURIComponent(name)}`);
  }

  return { createRoom };
}
