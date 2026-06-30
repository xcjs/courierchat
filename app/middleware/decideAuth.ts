import type { Tier } from '#shared/types/Tier';

export interface AuthDecisionInput {
  path: string;
  username: string | null;
  tiers: Tier[];
}

export type AuthDecision =
  | { action: 'allow' }
  | { action: 'redirect'; destination: string };

const PUBLIC_PATHS = ['/login', '/about'];

export function decideAuth (input: AuthDecisionInput): AuthDecision {
  if (PUBLIC_PATHS.includes(input.path)) {
    return { action: 'allow' };
  }

  const isAuthenticated = input.username !== null && input.tiers.length > 0;
  if (!isAuthenticated) {
    return { action: 'redirect', destination: '/login' };
  }

  return { action: 'allow' };
}
