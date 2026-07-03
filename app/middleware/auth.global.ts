import { decideAuth } from './decideAuth';

export default defineNuxtRouteMiddleware((to) => {
  const session = useSessionStore();

  const decision = decideAuth({
    path: to.path,
    username: session.username,
    tiers: session.tiers
  });

  if (decision.action === 'redirect') {
    return navigateTo(decision.destination);
  }
});
