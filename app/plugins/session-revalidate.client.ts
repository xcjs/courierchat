export default defineNuxtPlugin(async () => {
  const session = useSessionStore();
  const { checkAvailability } = useUsernameService();

  // A session without tiers is invalid (age attestation missing). Tear it
  // down and force the user back to /login to re-attest.
  if (session.username !== null && session.tiers.length === 0) {
    session.clear();
    await navigateTo('/login');
    return;
  }

  if (!session.isAuthenticated || !session.username) {
    return;
  }

  // Revalidate the claimed username against the server. If the name is now
  // in use by another connection (e.g. the user's prior session died and
  // someone else claimed it), tear down the local session and force a return
  // to /login so the user can pick a fresh name.
  try {
    const status = await checkAvailability(session.username);
    if (!status.available) {
      session.clear();
      await navigateTo('/login');
    }
  } catch {
    // Network or server error: don't destroy the session on a transient
    // failure. The user keeps their session; revalidation retries on next
    // load. A real implementation would also retry on a heartbeat.
  }
});
