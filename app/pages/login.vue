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
        ref="usernameInput"
        v-model="name"
        type="text"
        placeholder="username"
        class="block w-full text-2xl h-12 px-3 border border-text-content/20 rounded bg-surface text-text-content"
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
          class="mt-3 block w-full text-xl h-10 px-3 border border-text-content/20 rounded bg-surface text-text-content"
        >
        <div v-if="createRoom" class="mt-3">
          <button
            type="button"
            class="flex items-center gap-2 mb-2"
            @click="showIconPicker = !showIconPicker"
          >
            <span class="w-8 h-8 rounded-full bg-background-primary/10 flex items-center justify-center text-background-primary shrink-0">
              <template v-if="roomIcon">
                <Icon v-if="!roomIcon.startsWith('emoji:')" :name="roomIcon" size="16" />
                <span v-else aria-hidden="true">{{ roomIcon.slice(6) }}</span>
              </template>
              <Icon v-else name="lucide:hash" size="16" />
            </span>
            <span class="text-xs text-text-content/50 hover:text-text-content">
              {{ showIconPicker ? 'Hide' : 'Pick icon' }}
            </span>
          </button>
          <button
            v-if="roomIcon"
            type="button"
            class="text-xs text-text-content/50 hover:text-text-content ml-2"
            @click="roomIcon = ''"
          >
            Remove
          </button>
          <IconPicker v-if="showIconPicker" :selected-icon="roomIcon" @select="roomIcon = $event" />
        </div>
      </div>

      <div class="mt-6">
        <label class="flex items-center gap-2 text-text-content cursor-pointer">
          <input
            v-model="isAdult"
            type="checkbox"
            class="w-4 h-4 accent-background-interactive"
          >
          I am 18 or older
        </label>
        <p class="text-xs text-text-content/50 mt-1">
          Your age tier determines which rooms you can see. Minors and adults
          cannot interact. This resets when your session ends.
        </p>
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
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { Tier } from '#shared/types/Tier';
import { useCreateRoom } from '~/features/room/composables/useCreateRoom';
import IconPicker from '~/components/rooms/IconPicker.vue';

definePageMeta({ layout: 'auth' });

const name = ref('');
const roomName = ref('');
const createRoom = ref(false);
const roomIcon = ref('');
const showIconPicker = ref(false);
const isAdult = ref(false);
const error = ref('');
const usernameInput = ref<HTMLInputElement | null>(null);

function onAnimationEnd (): void {
  usernameInput.value?.focus();
}

function parseDuration (cssValue: string): number {
  if (cssValue.endsWith('ms')) {
    return parseFloat(cssValue.slice(0, -2));
  }
  if (cssValue.endsWith('s')) {
    return parseFloat(cssValue.slice(0, -1)) * 1000;
  }
  return 0;
}

onMounted(() => {
  const panel = document.querySelector('article.login');
  if (panel === null) {
    usernameInput.value?.focus();
    return;
  }

  const styles = getComputedStyle(panel);
  const duration = parseDuration(styles.animationDuration);
  const delay = parseDuration(styles.animationDelay);

  if (duration === 0) {
    // No animation (reduced-motion or disabled) — focus now.
    usernameInput.value?.focus();
    return;
  }

  panel.addEventListener('animationend', onAnimationEnd, { once: true });

  // Safety net: if the animation ended before the listener was attached
  // (SSR/hydration race), the event will never fire. Fall back to a timeout.
  const totalMs = duration + delay + 50;
  setTimeout(() => {
    usernameInput.value?.focus();
  }, totalMs);
});

onBeforeUnmount(() => {
  document.querySelector('article.login')?.removeEventListener('animationend', onAnimationEnd);
});

async function onSubmit (): Promise<void> {
  const trimmed = name.value.trim();
  if (!trimmed) { return; }
  if (createRoom.value && !roomName.value.trim()) { return; }

  const { checkAvailability } = useUsernameService();
  const status = await checkAvailability(trimmed);

  if (!status.available) {
    error.value = status.reason === 'in-use'
      ? 'That username is already in use. Try another.'
      : 'That username is not valid.';
    return;
  }

  const session = useSessionStore();
  session.setSession(trimmed, isAdult.value ? [Tier.Adult] : [Tier.Minor]);

  if (createRoom.value) {
    const trimmedRoom = roomName.value.trim();
    const tiers = isAdult.value ? [Tier.Adult] : [Tier.Minor];
    const icon = roomIcon.value.trim() || undefined;
    useCreateRoom().createRoom(trimmedRoom, tiers, icon);
  } else {
    await navigateTo('/rooms');
  }
}
</script>
