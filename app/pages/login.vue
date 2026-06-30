<template>
  <div>
    <h1 class="text-4xl font-medium text-text-primary mb-4 flex items-center gap-2">
      <img src="/courierchat.svg" alt="CourierChat" class="h-10 inline-block">
      CourierChat
    </h1>
    <form @submit.prevent="onSubmit">
      <p class="text-text-content mb-4">
        Pick a username. If it's not in use, it's yours until you disconnect.
      </p>
      <input
        v-model="name"
        type="text"
        placeholder="username"
        class="block w-full text-2xl h-12 px-3 border border-text-content/20 rounded shadow-courier-drop text-text-primary"
        autofocus
      >
      <p v-if="error" class="text-error text-sm mt-2">
        {{ error }}
      </p>

      <div class="mt-6">
        <label class="flex items-center gap-2 text-text-content cursor-pointer">
          <input
            v-model="createRoom"
            type="checkbox"
            class="w-4 h-4 accent-background-interactive"
          >
          Create a new room
        </label>
        <input
          v-if="createRoom"
          v-model="roomName"
          type="text"
          placeholder="room name"
          class="mt-3 block w-full text-xl h-10 px-3 border border-text-content/20 rounded shadow-courier-drop text-text-primary"
        >
      </div>

      <button
        type="submit"
        class="mt-4 w-full h-12 rounded bg-background-interactive text-text-content-inverted font-medium shadow-courier-drop"
        :disabled="!name.trim() || (createRoom && !roomName.trim())"
      >
        Enter
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

definePageMeta({ layout: 'auth' })

const name = ref('')
const roomName = ref('')
const createRoom = ref(false)
const error = ref('')

async function onSubmit (): Promise<void> {
  const trimmed = name.value.trim()
  if (!trimmed) { return }
  if (createRoom.value && !roomName.value.trim()) { return }

  const { checkAvailability } = useUsernameService()
  const status = await checkAvailability(trimmed)

  if (!status.available) {
    error.value = status.reason === 'in-use'
      ? 'That username is already in use. Try another.'
      : 'That username is not valid.'
    return
  }

  const session = useSessionStore()
  session.setSession(trimmed)

  if (createRoom.value) {
    await navigateTo(`/rooms/${encodeURIComponent(roomName.value.trim())}`)
  } else {
    await navigateTo('/rooms')
  }
}
</script>
