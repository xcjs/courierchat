import { evaluateUsername } from '#server/services/UsernameEvaluation';
import type { UsernameStatus } from '#shared/types/UsernameService';

export default defineEventHandler((event): UsernameStatus => {
  return evaluateUsername(getQuery(event).username);
});
