<template>
  <div class="flex flex-col h-full max-w-2xl mx-auto p-6">
    <h1 class="text-2xl font-semibold text-text-content mb-6">
      Settings
    </h1>

    <section class="mb-8">
      <h2 class="text-lg font-medium text-text-content mb-3 flex items-center gap-2">
        <Icon name="lucide:user" size="18" class="text-background-primary" />
        Session
      </h2>
      <dl class="text-sm space-y-2">
        <div class="flex justify-between border-b border-text-content/10 pb-2">
          <dt class="font-medium text-text-content">
            Username
          </dt>
          <dd class="text-text-content/70">
            {{ username ?? 'Not signed in' }}
          </dd>
        </div>
        <div class="flex justify-between border-b border-text-content/10 pb-2">
          <dt class="font-medium text-text-content">
            Age tier
          </dt>
          <dd class="text-text-content/70 capitalize">
            {{ tierLabel }}
          </dd>
        </div>
      </dl>
    </section>

    <section class="mb-8">
      <h2 class="text-lg font-medium text-text-content mb-3 flex items-center gap-2">
        <Icon name="lucide:wifi" size="18" class="text-background-primary" />
        Connection
      </h2>
      <dl class="text-sm space-y-2">
        <div class="flex justify-between border-b border-text-content/10 pb-2">
          <dt class="font-medium text-text-content">
            Transport mode
          </dt>
          <dd class="flex items-center gap-2 text-text-content/70 capitalize">
            <span
              class="w-2 h-2 rounded-full"
              :class="modeDotClass"
            />
            {{ transportMode }}
          </dd>
        </div>
        <div class="flex justify-between border-b border-text-content/10 pb-2">
          <dt class="font-medium text-text-content">
            Heartbeat
          </dt>
          <dd class="text-text-content/70">
            {{ connected ? 'active (15s)' : 'inactive' }}
          </dd>
        </div>
        <div class="flex justify-between border-b border-text-content/10 pb-2">
          <dt class="font-medium text-text-content">
            In-process STUN
          </dt>
          <dd class="text-text-content/70">
            enabled
            <span class="text-text-content/40">(per ADR 0002)</span>
          </dd>
        </div>
        <div class="flex justify-between border-b border-text-content/10 pb-2">
          <dt class="font-medium text-text-content">
            TURN relay
          </dt>
          <dd class="text-text-content/70">
            disabled
            <span class="text-text-content/40">(per ADR 0002)</span>
          </dd>
        </div>
      </dl>
    </section>

    <section class="mb-8">
      <h2 class="text-lg font-medium text-text-content mb-3 flex items-center gap-2">
        <Icon name="lucide:info" size="18" class="text-background-primary" />
        About This Build
      </h2>
      <p class="text-sm text-text-content/70 leading-relaxed">
        CourierChat is an ephemeral, peer-to-peer chat application. Messages are
        delivered over WebRTC DataChannels where possible and fall back to a
        WebSocket relay when direct connectivity is unavailable. No messages are
        stored on the server. See
        <NuxtLink to="/about" class="text-background-primary underline">
          the About page
        </NuxtLink>
        for details.
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSessionStore } from '~/stores/Session';
import type { Tier } from '#shared/types/Tier';

definePageMeta({ layout: 'default' });

type TransportMode = 'mesh' | 'star' | 'relay' | 'offline';

const session = useSessionStore();

const username = computed(() => session.username);
const tierLabel = computed(() => {
  const t: Tier[] = session.tiers;
  if (t.includes('adult')) { return 'adult'; }
  if (t.includes('minor')) { return 'minor'; }
  return 'none';
});

const transportMode = computed<TransportMode>(() => 'offline');
const connected = computed(() => false);

const modeDotClass = computed(() => {
  const mode: TransportMode = transportMode.value;
  switch (mode) {
    case 'mesh':
      return 'bg-background-primary';
    case 'star':
      return 'bg-background-interactive';
    case 'relay':
      return 'bg-text-error';
    case 'offline':
      return 'bg-text-error shadow-[0_0_4px_1px_rgba(165,61,61,0.7)]';
    default:
      return 'bg-text-error';
  }
});
</script>
