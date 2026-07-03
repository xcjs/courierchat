import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Tier } from '#shared/types/Tier';

export const useSessionStore = defineStore('session', () => {
  const username = ref<string | null>(null);
  const tiers = ref<Tier[]>([]);

  const isAuthenticated = computed(() => username.value !== null && tiers.value.length > 0);

  function setSession (name: string, sessionTiers: Tier[]): void {
    username.value = name;
    tiers.value = sessionTiers;
  }

  function clear (): void {
    username.value = null;
    tiers.value = [];
  }

  return { username, tiers, isAuthenticated, setSession, clear };
});
