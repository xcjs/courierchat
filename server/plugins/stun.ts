import { StunServer } from '#server/services/StunServer';

/**
 * Nitro server plugin: starts the in-process STUN server on boot if
 * enabled in runtime config (default: enabled per ADR 0002).
 *
 * The STUN server runs a UDP socket on port 3478 (configurable) and
 * handles Binding Requests for ICE server-reflexive candidate discovery.
 */
export default defineNitroPlugin((nitro) => {
  const config = useRuntimeConfig().stun;

  if (!config.enabled) {
    return;
  }

  const stun = new StunServer({ port: config.port, host: config.host });

  stun.start().then(() => {
    const port = stun.boundPort ?? config.port;
    // eslint-disable-next-line no-console
    console.log(`[stun] In-process STUN server listening on ${config.host}:${port} (UDP)`);
  }).catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('[stun] Failed to start STUN server:', err);
  });

  // Shut down STUN server when Nitro shuts down.
  nitro.hooks.hook('close', () => {
    stun.stop().catch(() => { /* ignore */ });
  });
});
