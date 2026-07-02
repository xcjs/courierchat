<template>
  <header
    class="bg-background-interactive shadow-courier-drop flex items-center px-4 h-14 shrink-0 z-20"
  >
    <div class="flex items-center gap-2 min-w-0">
      <NuxtLink to="/rooms" aria-label="CourierChat home" class="shrink-0">
        <img src="/courierchat.svg" alt="CourierChat" class="w-10 h-10 -my-1" />
      </NuxtLink>
      <div class="flex items-baseline gap-2 min-w-0">
        <h1 class="text-lg font-semibold text-text-content-inverted truncate">
          {{ roomName ?? 'CourierChat' }}
        </h1>
        <span
          v-if="memberCount !== undefined"
          class="text-sm text-text-content-inverted/70 shrink-0"
        >
        {{ memberCount }} {{ memberCount === 1 ? 'member' : 'members' }}
      </span>
      </div>
    </div>

    <div class="ml-auto flex items-center gap-2">
      <template v-if="username">
        <span
          class="w-5 h-5 rounded-full bg-white/90 flex items-center justify-center shrink-0"
          :title="`Status: ${statusLabel}`"
        >
          <Icon
            :name="statusIcon"
            size="14"
            :class="statusClass"
          />
        </span>
        <span class="text-sm leading-none text-text-content-inverted/80 hidden sm:inline">{{ username }}</span>
        <div class="relative">
          <button
            type="button"
            class="w-8 h-8 rounded-full bg-background-interactive flex items-center justify-center text-text-content-inverted ring-1 ring-white/30"
            aria-label="User menu"
            @click="menuOpen = !menuOpen"
          >
            <Icon name="lucide:user" size="16" />
          </button>
          <div
            v-if="menuOpen"
            class="absolute right-0 top-10 bg-surface shadow-courier-drop rounded-md py-1 w-44"
          >
            <div class="flex items-center gap-2 px-4 py-2 text-sm text-text-content/70 border-b border-text-content/10 mb-1 capitalize">
              <Icon :name="statusIcon" size="14" :class="statusClass" />
              {{ statusLabel }}
            </div>
            <NuxtLink to="/settings" class="block px-4 py-2 text-sm text-text-content hover:bg-background-primary/10" @click="menuOpen = false">Settings</NuxtLink>
            <NuxtLink to="/about" class="block px-4 py-2 text-sm text-text-content hover:bg-background-primary/10" @click="menuOpen = false">About</NuxtLink>
            <button type="button" class="block w-full text-left px-4 py-2 text-sm text-text-error hover:bg-background-primary/10" @click="$emit('logout')">Log Out</button>
          </div>
        </div>
      </template>
      <NuxtLink
        v-else
        to="/login"
        class="text-sm text-text-content-inverted/80 hover:text-text-content-inverted"
      >
        Sign In
      </NuxtLink>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useConnectionStatus } from '~/features/connection/composables/useConnectionStatus'
import { UiTransportMode } from '~/features/transport/types/Transport'

const props = withDefaults(defineProps<{
  roomName?: string
  memberCount?: number
  connected?: boolean
  transportMode?: UiTransportMode | string
  username?: string | null
}>(), {
  connected: false,
  transportMode: UiTransportMode.Offline
})

defineEmits<{
  logout: []
}>()

const menuOpen = ref(false)

const { statusLabel, statusIcon, statusClass } = useConnectionStatus(() => props.connected, () => props.transportMode as UiTransportMode)
</script>