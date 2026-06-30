import type { UsernameStatus } from '#shared/types/UsernameService';

export function evaluateUsername (username: unknown): UsernameStatus {
  if (typeof username !== 'string' || !username.trim()) {
    return { available: false, reason: 'invalid' };
  }

  // Stub: the global username registry is built with the signaling service
  // (per ADR 0002). For now, treat every non-empty name as available.
  // When the registry exists, this route will check it and return 'in-use'
  // if the name is currently claimed by an active connection.
  return { available: true };
}
