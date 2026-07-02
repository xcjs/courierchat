<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    role="dialog"
    aria-modal="true"
    aria-label="Create a room"
    @click.self="$emit('close')"
  >
    <div class="bg-white rounded-lg shadow-courier-drop p-6 w-full max-w-sm mx-4">
      <h2 class="text-lg font-semibold text-text-content mb-4">
        Create a Room
      </h2>
      <form @submit.prevent="onSubmit">
        <label class="block text-sm font-medium text-text-content mb-1" for="room-name">
          Room name
        </label>
        <input
          id="room-name"
          ref="nameInput"
          v-model="name"
          type="text"
          placeholder="e.g. general"
          class="w-full px-3 py-2 rounded border border-text-content/15 bg-white text-text-content text-sm focus:outline-none focus:border-background-interactive mb-4"
          required
          maxlength="32"
          autocomplete="off"
        >
        <label class="block text-sm font-medium text-text-content mb-1" for="room-icon">
          Icon (optional)
        </label>
        <div class="flex items-center gap-2 mb-2">
          <span class="w-9 h-9 rounded-full bg-background-primary/10 flex items-center justify-center text-background-primary shrink-0">
            <template v-if="icon">
              <Icon v-if="!icon.startsWith('emoji:')" :name="icon" size="18" />
              <span v-else aria-hidden="true">{{ icon.slice(6) }}</span>
            </template>
            <Icon v-else name="lucide:hash" size="18" />
          </span>
          <button
            type="button"
            class="text-xs text-text-content/50 hover:text-text-content"
            @click="icon = ''"
          >
            {{ icon ? 'Remove' : '' }}
          </button>
        </div>
        <IconPicker :selected-icon="icon" @select="onIconSelect" />
        <div class="flex justify-end gap-2 mt-4">
          <button
            type="button"
            class="px-4 py-2 rounded text-sm text-text-content/70 hover:text-text-content"
            @click="$emit('close')"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-4 py-2 rounded bg-background-interactive text-text-content-inverted text-sm font-medium shadow-courier-drop"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import IconPicker from './IconPicker.vue';
import type { Tier } from '#shared/types/Tier';

const emit = defineEmits<{
  create: [name: string, tiers: Tier[], icon?: string];
  close: [];
}>();

const props = withDefaults(defineProps<{
  tiers: Tier[];
  initialName?: string;
}>(), {
  initialName: ''
});

const name = ref(props.initialName);
const icon = ref('');
const nameInput = ref<HTMLInputElement | null>(null);

function onIconSelect (value: string): void {
  icon.value = value;
}

function onSubmit (): void {
  const trimmed = name.value.trim();
  if (trimmed === '') return;
  const iconValue = icon.value.trim();
  emit('create', trimmed, props.tiers, iconValue === '' ? undefined : iconValue);
}

function onKeydown (e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close');
}

onMounted(() => {
  nameInput.value?.focus();
  window.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>