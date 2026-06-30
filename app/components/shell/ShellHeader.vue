<template>
  <header
    class="sticky top-0 z-20 bg-white shadow-courier-drop flex items-center px-4 h-14"
  >
    <div class="flex items-baseline gap-2 min-w-0">
      <h1 class="text-lg font-semibold text-text-content truncate">
        {{ roomName ?? 'CourierChat' }}
      </h1>
      <span
        v-if="memberCount !== undefined"
        class="text-sm text-text-content/60 shrink-0"
      >
        {{ memberCount }} {{ memberCount === 1 ? 'member' : 'members' }}
      </span>
    </div>

    <span
      :title="`Transport mode: ${transportMode}`"
      class="ml-2 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
      :class="modeBadgeClass"
    >
      <span class="w-1.5 h-1.5 rounded-full" :class="modeDotClass"></span>
      {{ transportMode }}
    </span>

    <div class="ml-auto flex items-center gap-2">
      <template v-if="username">
        <span class="text-sm text-text-content/70 hidden sm:inline">{{ username }}</span>
        <div class="relative">
          <button
            type="button"
            class="w-8 h-8 rounded-full bg-background-interactive flex items-center justify-center text-text-content-inverted"
            aria-label="User menu"
            @click="menuOpen = !menuOpen"
          >
            <Icon name="lucide:user" size="16" />
          </button>
          <div
            v-if="menuOpen"
            class="absolute right-0 top-10 bg-white shadow-courier-drop rounded-md py-1 w-40"
          >
            <NuxtLink to="/settings" class="block px-4 py-2 text-sm text-text-content hover:bg-background-primary/10" @click="menuOpen = false">Settings</NuxtLink>
            <NuxtLink to="/about" class="block px-4 py-2 text-sm text-text-content hover:bg-background-primary/10" @click="menuOpen = false">About</NuxtLink>
            <button type="button" class="block w-full text-left px-4 py-2 text-sm text-text-error hover:bg-background-primary/10" @click="$emit('logout')">Log out</button>
          </div>
        </div>
      </template>
      <NuxtLink
        v-else
        to="/login"
        class="text-sm text-text-content/70 hover:text-text-content"
      >
        Sign in
      </NuxtLink>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

type TransportMode = 'mesh' | 'star' | 'relay' | 'offline'

const props = defineProps<{
  roomName?: string
  memberCount?: number
  transportMode: TransportMode
  username?: string | null
}>()

defineEmits<{
  logout: []
}>()

const menuOpen = ref(false)

const modeDotClass = computed(() => {
  switch (props.transportMode) {
    case 'mesh':
      return 'bg-background-primary'
    case 'star':
      return 'bg-background-interactive'
    case 'relay':
      return 'bg-text-error'
    case 'offline':
      return 'bg-text-content/30'
  }
})

const modeBadgeClass = computed(() => {
  switch (props.transportMode) {
    case 'mesh':
      return 'bg-background-primary/10 text-background-primary'
    case 'star':
      return 'bg-background-interactive/10 text-background-interactive'
    case 'relay':
      return 'bg-text-error/10 text-text-error'
    case 'offline':
      return 'bg-text-content/10 text-text-content/50'
  }
})
</script>