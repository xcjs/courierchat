<template>
  <div class="p-8 max-w-2xl mx-auto">
    <h1 class="text-2xl font-semibold text-text-content mb-4">
      Settings
    </h1>
    <section class="mb-6">
      <h2 class="text-lg font-medium text-text-content mb-2">
        Connection
      </h2>
      <dl class="text-sm text-text-content/70 space-y-1">
        <div>
          <dt class="inline font-medium">
            Transport mode:
          </dt> <dd class="inline">
            offline
          </dd>
        </div>
        <div>
          <dt class="inline font-medium">
            Heartbeat:
          </dt> <dd class="inline">
            inactive
          </dd>
        </div>
        <div>
          <dt class="inline font-medium">
            In-process STUN:
          </dt> <dd class="inline">
            enabled (per ADR 0002)
          </dd>
        </div>
      </dl>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' });
</script>
