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
      <button
        type="submit"
        class="mt-4 w-full h-12 rounded bg-background-primary text-text-content-inverted font-medium shadow-courier-drop"
        :disabled="!name.trim()"
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
const error = ref('')

async function onSubmit (): Promise<void> {
  const trimmed = name.value.trim()
  if (!trimmed) { return }
  // Placeholder: real claim flow wired in feature work.
  await navigateTo('/rooms')
}
</script>
