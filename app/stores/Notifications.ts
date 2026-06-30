import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface NotificationEntry {
  id: number
  message: string
  timestamp: number
}

export const useNotificationsStore = defineStore('notifications', () => {
  const queue = ref<NotificationEntry[]>([])
  const history = ref<NotificationEntry[]>([])
  let nextId = 0

  function push (message: string): void {
    const entry: NotificationEntry = {
      id: nextId++,
      message,
      timestamp: Date.now()
    }
    queue.value.push(entry)
    history.value.push(entry)
  }

  function dismiss (id: number): void {
    queue.value = queue.value.filter(entry => entry.id !== id)
  }

  function clearHistory (): void {
    history.value = []
  }

  return { queue, history, push, dismiss, clearHistory }
})
