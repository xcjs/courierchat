export default defineNuxtRouteMiddleware((to) => {
  const session = useSessionStore();

  // Public routes that don't require authentication.
  const publicPaths = ['/login', '/about'];
  if (publicPaths.includes(to.path)) { return; }

  if (!session.isAuthenticated) {
    return navigateTo('/login');
  }
});
