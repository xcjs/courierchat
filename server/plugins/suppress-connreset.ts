/**
 * Nitro server plugin: suppress noisy unhandled ECONNRESET rejections.
 *
 * Mobile browsers that switch apps or background the page drop TLS
 * connections mid-handshake, producing `read ECONNRESET` rejections from
 * Node's TLS layer. These are benign (the client is gone) but spam the
 * dev console. This handler swallows only ECONNRESET rejections and
 * leaves all other unhandled rejections intact.
 */
function isConnReset (reason: unknown): boolean {
  const message = reason instanceof Error ? reason.message : String(reason);
  return message.includes('ECONNRESET');
}

export default defineNitroPlugin(() => {
  // Swallow benign ECONNRESET rejections (mobile clients backgrounding the
  // page drop TLS connections mid-handshake). Node 15+ otherwise exits with
  // code 1 on unhandled rejections, killing the dev server.
  process.on('unhandledRejection', (reason: unknown) => {
    if (isConnReset(reason)) {
      return;
    }
    // eslint-disable-next-line no-console
    console.error('[unhandledRejection]', reason);
  });

  // Also guard uncaughtException for the same benign socket error.
  process.on('uncaughtException', (err: Error) => {
    if (isConnReset(err)) {
      return;
    }
    // eslint-disable-next-line no-console
    console.error('[uncaughtException]', err);
  });
});
