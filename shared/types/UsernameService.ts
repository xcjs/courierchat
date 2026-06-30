export interface UsernameStatus {
  available: boolean
  reason?: 'in-use' | 'invalid' | 'unknown'
}

export interface UsernameService {
  checkAvailability: (username: string) => Promise<UsernameStatus>
}