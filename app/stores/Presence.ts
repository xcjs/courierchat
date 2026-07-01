import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { PresenceStatus } from '#shared/types/Signaling';

/**
 * Presence store holds the site-wide set of online usernames. Populated
 * initially from the Welcome message's onlineUsernames snapshot, then
 * updated by Presence broadcasts (online/offline).
 */
export const usePresenceStore = defineStore('presence', () => {
  const onlineUsernames = ref<string[]>([]);

  const onlineCount = computed(() => onlineUsernames.value.length);

  function setOnlineUsernames (usernames: string[]): void {
    onlineUsernames.value = [...usernames];
  }

  function updatePresence (username: string, status: PresenceStatus): void {
    if (status === PresenceStatus.Online) {
      if (!onlineUsernames.value.includes(username)) {
        onlineUsernames.value = [...onlineUsernames.value, username];
      }
    } else {
      onlineUsernames.value = onlineUsernames.value.filter(u => u !== username);
    }
  }

  function isOnline (username: string): boolean {
    return onlineUsernames.value.includes(username);
  }

  function reset (): void {
    onlineUsernames.value = [];
  }

  return {
    onlineUsernames,
    onlineCount,
    setOnlineUsernames,
    updatePresence,
    isOnline,
    reset
  };
});
