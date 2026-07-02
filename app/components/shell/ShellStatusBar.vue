<template>
  <footer
    class="sticky bottom-0 z-20 bg-white border-t border-text-content/10 flex items-center px-4 h-8 text-xs text-text-content/60"
    role="status"
    aria-live="polite"
  >
    <span class="inline-flex items-center gap-1.5">
      <span
        class="w-2 h-2 rounded-full"
        :class="connected ? 'bg-background-primary' : 'bg-text-error'"
        :title="connected ? 'Connected' : 'Disconnected'"
      ></span>
      {{ connected ? 'Connected' : 'Disconnected' }}
    </span>
    <span v-if="heartbeat" class="ml-3 inline-flex items-center gap-1">
      <span class="w-1.5 h-1.5 rounded-full bg-background-primary animate-pulse" title="Heartbeat active"></span>
      heartbeat
    </span>
    <span class="ml-auto hidden sm:inline">{{ transportMode }} mode</span>
  </footer>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  connected?: boolean
  heartbeat?: boolean
  transportMode?: string
}>(), {
  connected: false,
  transportMode: 'offline'
})
</script>