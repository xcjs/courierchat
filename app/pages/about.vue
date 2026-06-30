<template>
  <div class="flex flex-col h-full max-w-2xl mx-auto p-6">
    <div class="flex items-center gap-3 mb-6">
      <img src="/courierchat.svg" alt="" class="w-12 h-12">
      <h1 class="text-2xl font-semibold text-text-content">
        About CourierChat
      </h1>
    </div>

    <section class="mb-6">
      <h2 class="text-lg font-medium text-text-content mb-2">
        What is CourierChat?
      </h2>
      <p class="text-sm text-text-content/70 leading-relaxed mb-3">
        CourierChat is an ephemeral, peer-to-peer chat application. You claim a
        username for the duration of your session, join or create rooms, and
        chat in real time. When you disconnect, your username is released back
        to the pool.
      </p>
      <p class="text-sm text-text-content/70 leading-relaxed">
        Messages are delivered over WebRTC DataChannels where possible —
        directly between peers — and fall back to a server-side WebSocket relay
        only when direct connectivity is unavailable. No messages are persisted.
        No history is kept. When a room empties, it's gone.
      </p>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-medium text-text-content mb-2">
        Privacy &amp; Safety
      </h2>
      <ul class="text-sm text-text-content/70 leading-relaxed space-y-1.5 list-disc pl-5">
        <li>Messages are not stored on the server.</li>
        <li>Rooms are ephemeral — they exist only while someone is connected.</li>
        <li>Usernames are global and claimed for the duration of a session.</li>
        <li>Age tiers keep minors and adults in isolated room sets.</li>
        <li>Transport mode is shown in your profile menu and on the Settings page.</li>
      </ul>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-medium text-text-content mb-2">
        Architecture
      </h2>
      <p class="text-sm text-text-content/70 leading-relaxed mb-3">
        CourierChat is built on Nuxt and TypeScript, with WebRTC for
        peer-to-peer transport and an in-process STUN server for NAT traversal.
        Architecture decisions are documented as ADRs:
      </p>
      <ul class="text-sm space-y-1.5">
        <li class="flex items-baseline gap-2">
          <Icon name="lucide:file-text" size="14" class="text-background-primary shrink-0" />
          <span>
            <span class="font-medium text-text-content">ADR 0001</span> —
            <span class="text-text-content/70">Technology stack migration (Nuxt, TypeScript, Docker, DDD)</span>
          </span>
        </li>
        <li class="flex items-baseline gap-2">
          <Icon name="lucide:file-text" size="14" class="text-background-primary shrink-0" />
          <span>
            <span class="font-medium text-text-content">ADR 0002</span> —
            <span class="text-text-content/70">WebRTC transport and signaling (star topology, in-process STUN, no TURN)</span>
          </span>
        </li>
      </ul>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-medium text-text-content mb-2">
        License
      </h2>
      <p class="text-sm text-text-content/70 leading-relaxed">
        CourierChat is licensed under the
        <span class="font-medium">GNU Affero General Public License v3.0</span>.
        See <code>LICENSE</code> for the full text.
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' });
</script>
