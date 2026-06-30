import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useSessionStore = defineStore('session', () => {
  const username = ref<string | null>(null)

  const isAuthenticated = computed(() => username.value !== null)

  function setSession (name: string): void {
    username.value = name
  }

  function clear (): void {
    username.value = null
  }

  return { username, isAuthenticated, setSession, clear }
})
