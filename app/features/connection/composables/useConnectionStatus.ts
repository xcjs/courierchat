import { computed } from 'vue';
import type { ComputedRef } from 'vue';
import { UiTransportMode } from '~/features/transport/types/Transport';

export interface ConnectionStatus {
  statusLabel: ComputedRef<string>;
  statusIcon: ComputedRef<string>;
  statusClass: ComputedRef<string>;
}

/**
 * useConnectionStatus computes a shared connection indicator from the
 * signaling connection state and active-room transport mode. Used by the
 * header and settings page so they display the same status.
 *
 * States:
 * - offline:        wifi-off icon, red
 * - online no room: wifi icon, green
 * - mesh:           share-2 icon, green
 * - star:           star icon, green
 * - relay:          server icon, amber (relayed through server)
 */
export function useConnectionStatus (
  connected: () => boolean,
  transportMode: () => UiTransportMode
): ConnectionStatus {
  const statusLabel = computed(() => {
    if (!connected()) { return 'offline'; }
    const mode = transportMode();
    if (mode === UiTransportMode.Offline) { return 'online'; }
    return mode;
  });

  const statusIcon = computed(() => {
    if (!connected()) { return 'lucide:wifi-off'; }
    switch (transportMode()) {
      case UiTransportMode.Mesh: return 'lucide:share-2';
      case UiTransportMode.Star: return 'lucide:star';
      case UiTransportMode.Relay: return 'lucide:server';
      default: return 'lucide:wifi';
    }
  });

  const statusClass = computed(() => {
    if (!connected()) { return 'text-text-error'; }
    return transportMode() === UiTransportMode.Relay
      ? 'text-amber-500'
      : 'text-green-500';
  });

  return { statusLabel, statusIcon, statusClass };
}
