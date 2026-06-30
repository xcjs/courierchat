import type { UsernameService, UsernameStatus } from '#shared/types/UsernameService'

export function useUsernameService (): UsernameService {
  async function checkAvailability (username: string): Promise<UsernameStatus> {
    return await $fetch<UsernameStatus>('/api/username-status', {
      query: { username }
    })
  }

  return { checkAvailability }
}