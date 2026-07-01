import { defineStore } from 'pinia';
import { ref } from 'vue';

export type NotificationSeverity = 'info' | 'error';

export interface NotificationEntry {
  id: number
  message: string
  severity: NotificationSeverity
  timestamp: number
}

const DEFAULT_TTL_MS = 5_000;

export const useNotificationsStore = defineStore('notifications', () => {
  const queue = ref<NotificationEntry[]>([]);
  const history = ref<NotificationEntry[]>([]);
  let nextId = 0;
  const timers = new Map<number, ReturnType<typeof setTimeout>>();

  function push (message: string, severity: NotificationSeverity = 'info', ttl = DEFAULT_TTL_MS): void {
    const entry: NotificationEntry = {
      id: nextId++,
      message,
      severity,
      timestamp: Date.now()
    };
    queue.value = [...queue.value, entry];
    history.value = [...history.value, entry];
    if (ttl > 0) {
      const timer = setTimeout(() => { dismiss(entry.id); }, ttl);
      timers.set(entry.id, timer);
    }
  }

  function dismiss (id: number): void {
    queue.value = queue.value.filter(entry => entry.id !== id);
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
  }

  function clearHistory (): void {
    history.value = [];
  }

  return { queue, history, push, dismiss, clearHistory };
});
