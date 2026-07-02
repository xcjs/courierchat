import { computed } from 'vue';

/**
 * useConnectionStatus computes a shared online/offline status indicator
 * from the signaling connection state. Used by the header and settings
 * page so they display the same status label and dot color.
 */
export function useConnectionStatus (connected: () => boolean): { statusLabel: import('vue').ComputedRef<string>; statusDotClass: import('vue').ComputedRef<string> } {
  const statusLabel = computed(() => connected() ? 'online' : 'offline');

  const statusDotClass = computed(() =>
    connected()
      ? 'bg-green-500'
      : 'bg-text-error shadow-[0_0_4px_1px_rgba(165,61,61,0.7)]'
  );

  return { statusLabel, statusDotClass };
}
