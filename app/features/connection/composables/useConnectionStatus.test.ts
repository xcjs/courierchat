import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { useConnectionStatus } from './useConnectionStatus';
import { UiTransportMode } from '~/features/transport/types/Transport';

describe('useConnectionStatus', () => {
  it('reports offline when disconnected', () => {
    const { statusLabel, statusIcon, statusClass } = useConnectionStatus(() => false, () => UiTransportMode.Offline);
    expect(statusLabel.value).toBe('offline');
    expect(statusIcon.value).toBe('lucide:wifi-off');
    expect(statusClass.value).toContain('text-text-error');
  });

  it('reports online (no room) when connected with offline transport mode', () => {
    const { statusLabel, statusIcon, statusClass } = useConnectionStatus(() => true, () => UiTransportMode.Offline);
    expect(statusLabel.value).toBe('online');
    expect(statusIcon.value).toBe('lucide:wifi');
    expect(statusClass.value).toContain('text-green-500');
  });

  it('reports mesh mode with share icon', () => {
    const { statusLabel, statusIcon, statusClass } = useConnectionStatus(() => true, () => UiTransportMode.Mesh);
    expect(statusLabel.value).toBe(UiTransportMode.Mesh);
    expect(statusIcon.value).toBe('lucide:share-2');
    expect(statusClass.value).toContain('text-green-500');
  });

  it('reports star mode with star icon', () => {
    const { statusLabel, statusIcon, statusClass } = useConnectionStatus(() => true, () => UiTransportMode.Star);
    expect(statusLabel.value).toBe(UiTransportMode.Star);
    expect(statusIcon.value).toBe('lucide:star');
    expect(statusClass.value).toContain('text-green-500');
  });

  it('reports relay mode with server icon and amber color', () => {
    const { statusLabel, statusIcon, statusClass } = useConnectionStatus(() => true, () => UiTransportMode.Relay);
    expect(statusLabel.value).toBe(UiTransportMode.Relay);
    expect(statusIcon.value).toBe('lucide:server');
    expect(statusClass.value).toContain('text-amber-500');
  });

  it('reacts to connection changes', () => {
    const connected = ref(false);
    const { statusLabel, statusIcon } = useConnectionStatus(() => connected.value, () => UiTransportMode.Mesh);
    expect(statusLabel.value).toBe('offline');
    expect(statusIcon.value).toBe('lucide:wifi-off');
    connected.value = true;
    expect(statusLabel.value).toBe(UiTransportMode.Mesh);
    expect(statusIcon.value).toBe('lucide:share-2');
  });
});
