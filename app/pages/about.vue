<template>
  <div class="p-8 max-w-2xl mx-auto">
    <h1 class="text-2xl font-semibold text-text-content mb-4">
      About CourierChat
    </h1>
    <p class="text-text-content/70 mb-3">
      Ephemeral chat rooms. No persistence. No history. Connections are
      peer-to-peer via WebRTC where possible.
    </p>
    <p class="text-text-content/70">
      See <NuxtLink to="/rooms" class="text-background-primary underline">
        the ADRs
      </NuxtLink>
      in <code>docs/adrs/</code> for architecture decisions.
    </p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
</script>
