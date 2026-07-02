<template>
  <div
    v-if="notifications.queue.length"
    class="fixed top-[4.5rem] right-4 z-50 flex flex-col gap-2 pointer-events-none"
    role="region"
    aria-label="Notifications"
  >
    <TransitionGroup name="toast">
      <div
        v-for="entry in notifications.queue"
        :key="entry.id"
        class="pointer-events-auto flex items-start gap-2 rounded-lg shadow-courier-drop px-4 py-3 max-w-sm text-sm"
        :class="entry.severity === 'error'
          ? 'bg-text-error text-text-content-inverted'
          : 'bg-background-interactive text-text-content-inverted'"
      >
        <Icon
          :name="entry.severity === 'error' ? 'lucide:alert-circle' : 'lucide:info'"
          size="16"
          class="shrink-0 mt-0.5"
        />
        <span class="flex-1 break-words">{{ entry.message }}</span>
        <button
          type="button"
          class="shrink-0 opacity-70 hover:opacity-100"
          aria-label="Dismiss notification"
          @click="notifications.dismiss(entry.id)"
        >
          <Icon name="lucide:x" size="14" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { useNotificationsStore } from '~/stores/Notifications';

const notifications = useNotificationsStore();
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 200ms ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
.toast-move {
  transition: transform 200ms ease;
}
</style>