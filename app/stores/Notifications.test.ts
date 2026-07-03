import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useNotificationsStore, NotificationSeverity } from './Notifications';

describe('NotificationsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with empty queue and history', () => {
    const store = useNotificationsStore();
    expect(store.queue).toEqual([]);
    expect(store.history).toEqual([]);
  });

  it('push adds an entry to queue and history with default info severity', () => {
    const store = useNotificationsStore();
    store.push('Hello world');
    expect(store.queue).toHaveLength(1);
    expect(store.queue[0]!.message).toBe('Hello world');
    expect(store.queue[0]!.severity).toBe(NotificationSeverity.Info);
    expect(store.history).toHaveLength(1);
  });

  it('push accepts error severity', () => {
    const store = useNotificationsStore();
    store.push('Something broke', NotificationSeverity.Error);
    expect(store.queue[0]!.severity).toBe(NotificationSeverity.Error);
  });

  it('push assigns incremental IDs', () => {
    const store = useNotificationsStore();
    store.push('first');
    store.push('second');
    store.push('third');
    expect(store.queue[0]!.id).toBe(0);
    expect(store.queue[1]!.id).toBe(1);
    expect(store.queue[2]!.id).toBe(2);
  });

  it('push auto-dismisses after ttl expires', () => {
    const store = useNotificationsStore();
    store.push('temporary', NotificationSeverity.Info, 1_000);
    expect(store.queue).toHaveLength(1);
    vi.advanceTimersByTime(1_000);
    expect(store.queue).toHaveLength(0);
  });

  it('push with ttl 0 keeps the entry indefinitely', () => {
    const store = useNotificationsStore();
    store.push('persistent', NotificationSeverity.Info, 0);
    vi.advanceTimersByTime(10_000);
    expect(store.queue).toHaveLength(1);
  });

  it('dismiss removes entry from queue but keeps history', () => {
    const store = useNotificationsStore();
    store.push('to remove', NotificationSeverity.Info, 0);
    const id = store.queue[0]!.id;
    store.dismiss(id);
    expect(store.queue).toHaveLength(0);
    expect(store.history).toHaveLength(1);
  });

  it('dismiss clears the auto-dismiss timer', () => {
    const store = useNotificationsStore();
    store.push('timed', NotificationSeverity.Info, 1_000);
    const id = store.queue[0]!.id;
    store.dismiss(id);
    // Timer should be cleared, re-advancing should not throw
    vi.advanceTimersByTime(5_000);
    expect(store.queue).toHaveLength(0);
  });

  it('dismiss is a no-op for unknown IDs', () => {
    const store = useNotificationsStore();
    store.push('exists', NotificationSeverity.Info, 0);
    store.dismiss(999);
    expect(store.queue).toHaveLength(1);
  });

  it('clearHistory empties history but not queue', () => {
    const store = useNotificationsStore();
    store.push('one', NotificationSeverity.Info, 0);
    store.push('two', NotificationSeverity.Info, 0);
    store.clearHistory();
    expect(store.history).toHaveLength(0);
    expect(store.queue).toHaveLength(2);
  });

  it('multiple pushes and selective dismiss', () => {
    const store = useNotificationsStore();
    store.push('a', NotificationSeverity.Info, 0);
    store.push('b', NotificationSeverity.Error, 0);
    store.push('c', NotificationSeverity.Info, 0);
    store.dismiss(1);
    expect(store.queue).toHaveLength(2);
    expect(store.queue.map(e => e.message)).toEqual(['a', 'c']);
  });
});
