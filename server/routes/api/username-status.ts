import { useSignalingServer } from '#server/utils/signalingServer';
import type { UsernameStatus } from '#shared/types/UsernameService';

export default defineEventHandler((event): UsernameStatus => {
  const server = useSignalingServer();
  return server.checkUsernameAvailability(getQuery(event).username);
});
