import type { Tier } from './Tier';

export interface UsernameStatus {
  available: boolean;
  reason?: 'in-use' | 'invalid' | 'unknown';
  tiers?: Tier[];
}

export interface UsernameService {
  checkAvailability: (username: string) => Promise<UsernameStatus>;
}
