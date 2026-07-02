import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { useConnectionStatus } from './useConnectionStatus';

describe('useConnectionStatus', () => {
  it('returns online label and green dot when connected', () => {
    const { statusLabel, statusDotClass } = useConnectionStatus(() => true);
    expect(statusLabel.value).toBe('online');
    expect(statusDotClass.value).toContain('bg-green-500');
  });

  it('returns offline label and red dot when disconnected', () => {
    const { statusLabel, statusDotClass } = useConnectionStatus(() => false);
    expect(statusLabel.value).toBe('offline');
    expect(statusDotClass.value).toContain('bg-text-error');
  });

  it('reacts to ref changes', () => {
    const connected = ref(false);
    const { statusLabel, statusDotClass } = useConnectionStatus(() => connected.value);
    expect(statusLabel.value).toBe('offline');
    expect(statusDotClass.value).toContain('bg-text-error');
    connected.value = true;
    expect(statusLabel.value).toBe('online');
    expect(statusDotClass.value).toContain('bg-green-500');
  });
});
