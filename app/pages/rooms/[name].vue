<template>
  <div class="p-8">
    <h1 class="text-xl font-semibold text-text-content mb-4">
      {{ roomName }}
    </h1>
    <p class="text-text-content/70">
      Chat view placeholder. Messages will appear here once the WebRTC transport
      is wired in (per ADR 0002).
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from '#imports';

definePageMeta({ layout: 'default' });

const route = useRoute();
const roomName = computed(() => {
  const name = route.params?.name;
  return typeof name === 'string' ? decodeURIComponent(name) : '';
});
</script>
