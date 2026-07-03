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
            Status
          </dt>
          <dd class="flex items-center gap-2 text-text-content/70 capitalize">
            <Icon :name="statusIcon" size="14" :class="statusClass" />
            {{ statusLabel }}
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
            {{ stunEnabledLabel }}
          </dd>
        </div>
      </dl>
    </section>

    <section class="mb-8">
      <h2 class="text-lg font-medium text-text-content mb-3 flex items-center gap-2">
        <Icon name="lucide:users" size="18" class="text-background-primary" />
        Online Users
      </h2>
      <p v-if="!onlineUsernames.length" class="text-sm text-text-content/50">
        No one is online right now.
      </p>
      <ul v-else class="text-sm space-y-1">
        <li
          v-for="name in onlineUsernames"
          :key="name"
          class="flex items-center gap-2"
        >
          <span class="w-2 h-2 rounded-full bg-green-500" />
          <span class="text-text-content">{{ name }}</span>
          <span v-if="name === username" class="text-text-content/40 text-xs">(you)</span>
        </li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-lg font-medium text-text-content mb-3 flex items-center gap-2">
        <Icon name="lucide:sun-moon" size="18" class="text-background-primary" />
        Appearance
      </h2>
      <div class="flex items-center gap-3">
        <label for="theme-select" class="text-sm font-medium text-text-content">
          Theme
        </label>
        <select
          id="theme-select"
          :value="colorMode.preference"
          class="px-3 py-1.5 rounded border border-text-content/15 bg-surface text-text-content text-sm focus:outline-none focus:border-background-interactive"
          @change="onThemeChange"
        >
          <option value="system">
            System
          </option>
          <option value="light">
            Light
          </option>
          <option value="dark">
            Dark
          </option>
        </select>
        <span class="text-xs text-text-content/50">
          Active: {{ colorMode.value }}
        </span>
      </div>
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
import { useConnectionStore } from '~/stores/Connection';
import { usePresenceStore } from '~/stores/Presence';
import { Tier } from '#shared/types/Tier';
import { useConnectionStatus } from '~/features/connection/composables/useConnectionStatus';

definePageMeta({ layout: 'default' });

const session = useSessionStore();
const connection = useConnectionStore();
const presence = usePresenceStore();

const username = computed(() => session.username);
const onlineUsernames = computed(() => presence.onlineUsernames);
const tierLabel = computed(() => {
  const t: Tier[] = session.tiers;
  if (t.includes(Tier.Adult)) { return 'adult'; }
  if (t.includes(Tier.Minor)) { return 'minor'; }
  return 'none';
});

const connected = computed(() => connection.signalingConnected);
const transportMode = computed(() => connection.transportMode);
const { statusLabel, statusIcon, statusClass } = useConnectionStatus(() => connected.value, () => transportMode.value);
const stunEnabledLabel = computed(() => 'enabled');

const colorMode = useColorMode();

function onThemeChange (e: Event): void {
  colorMode.preference = (e.target as HTMLSelectElement).value;
}
</script>
