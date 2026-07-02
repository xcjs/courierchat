<template>
  <div class="icon-picker">
    <div class="flex gap-1 mb-2 border-b border-text-content/10">
      <button
        type="button"
        class="px-3 py-1.5 text-sm font-medium border-b-2 transition-colors"
        :class="tab === 'icons' ? 'border-background-interactive text-text-content' : 'border-transparent text-text-content/50 hover:text-text-content'"
        @click="tab = 'icons'"
      >
        Icons
      </button>
      <button
        type="button"
        class="px-3 py-1.5 text-sm font-medium border-b-2 transition-colors"
        :class="tab === 'emojis' ? 'border-background-interactive text-text-content' : 'border-transparent text-text-content/50 hover:text-text-content'"
        @click="tab = 'emojis'"
      >
        Emojis
      </button>
    </div>

    <input
      v-model="search"
      type="search"
      :placeholder="tab === 'icons' ? 'Search icons…' : 'Search emojis…'"
      class="w-full px-3 py-1.5 mb-2 rounded border border-text-content/15 bg-white text-text-content text-sm focus:outline-none focus:border-background-interactive"
    >

    <div class="max-h-48 overflow-y-auto rounded border border-text-content/10 p-2">
      <div v-if="tab === 'icons'" class="grid grid-cols-8 gap-1">
        <button
          v-for="name in filteredIcons"
          :key="name"
          type="button"
          class="aspect-square rounded flex items-center justify-center text-text-content/70 hover:bg-background-primary/10 transition-colors"
          :class="selectedIcon === `lucide:${name}` ? 'bg-background-interactive/20 ring-1 ring-background-interactive' : ''"
          :title="`lucide:${name}`"
          @click="$emit('select', `lucide:${name}`)"
        >
          <Icon :name="`lucide:${name}`" size="18" />
        </button>
        <p v-if="filteredIcons.length === 0" class="col-span-8 text-center text-xs text-text-content/40 py-4">
          No icons match.
        </p>
      </div>

      <div v-else class="grid grid-cols-8 gap-1">
        <button
          v-for="emoji in filteredEmojis"
          :key="emoji"
          type="button"
          class="aspect-square rounded flex items-center justify-center text-lg hover:bg-background-primary/10 transition-colors"
          :class="selectedIcon === `emoji:${emoji}` ? 'bg-background-interactive/20 ring-1 ring-background-interactive' : ''"
          :title="`emoji:${emoji}`"
          @click="$emit('select', `emoji:${emoji}`)"
        >
          {{ emoji }}
        </button>
        <p v-if="filteredEmojis.length === 0" class="col-span-8 text-center text-xs text-text-content/40 py-4">
          No emojis match.
        </p>
      </div>
    </div>

    <div class="flex items-center justify-between mt-2">
      <button
        type="button"
        class="text-xs text-text-content/50 hover:text-text-content"
        @click="$emit('select', '')"
      >
        Clear
      </button>
      <span v-if="selectedIcon" class="text-xs text-text-content/50 truncate ml-2">
        {{ selectedIcon }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import lucideIcons from '~/assets/lucide-icons.json';
import emojis from '~/assets/emojis.json';

defineProps<{
  selectedIcon?: string;
}>();

defineEmits<{
  select: [value: string];
}>();

const tab = ref<'icons' | 'emojis'>('icons');
const search = ref('');

const filteredIcons = computed<string[]>(() => {
  const q = search.value.trim().toLowerCase();
  if (q === '') { return lucideIcons; }
  return lucideIcons.filter(name => name.includes(q));
});

const filteredEmojis = computed<string[]>(() => {
  const all = Object.values(emojis).flat() as string[];
  const q = search.value.trim().toLowerCase();
  if (q === '') { return all; }
  return all.filter(e => e.includes(q));
});
</script>