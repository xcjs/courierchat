<template>
  <div class="flex flex-col h-full">
    <div
      ref="scrollContainer"
      class="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-3"
    >
      <div
        v-if="!messages.length"
        class="flex flex-col items-center justify-center h-full text-text-content/40 text-sm text-center px-6"
      >
        <Icon name="lucide:message-circle" size="32" class="mb-3 text-text-content/20" />
        <p>
          No messages yet.
        </p>
        <p class="mt-1">
          Messages are peer-to-peer and not stored — they disappear when the
          room empties.
        </p>
      </div>

      <div
        v-for="message in messages"
        :key="message.id"
        class="flex flex-col"
        :class="message.author === username ? 'items-end' : 'items-start'"
      >
        <div class="flex items-baseline gap-2 mb-0.5 px-1">
          <span
            v-if="message.author !== username"
            class="text-xs font-medium text-background-primary"
          >
            {{ message.author }}
          </span>
          <span class="text-[10px] text-text-content/40">
            {{ formatTime(message.timestamp) }}
          </span>
        </div>
        <div
          class="max-w-[75%] rounded-lg px-3 py-2 text-sm break-words"
          :class="message.author === username
            ? 'bg-background-interactive text-text-content-inverted'
            : 'bg-background-primary/10 text-text-content'"
        >
          {{ message.content }}
        </div>
      </div>
    </div>

    <form
      class="flex items-end gap-2 px-4 py-3 border-t border-text-content/10 bg-white"
      @submit.prevent="onSubmit"
    >
      <textarea
        ref="inputEl"
        v-model="draftText"
        rows="1"
        placeholder="Type a message…"
        class="flex-1 resize-none rounded border border-text-content/15 px-3 py-2 text-sm text-text-content focus:outline-none focus:border-background-interactive max-h-32"
        :disabled="!username"
        @keydown.enter.exact.prevent="onSubmit"
        @input="autoGrow"
      ></textarea>
      <button
        type="submit"
        class="shrink-0 w-9 h-9 rounded-full bg-background-interactive text-text-content-inverted flex items-center justify-center shadow-courier-drop disabled:opacity-40"
        :disabled="!canSend"
        aria-label="Send message"
      >
        <Icon name="lucide:send" size="16" />
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoomChat } from '~/features/room/composables/useRoomChat';
import { useRoomTransport } from '~/features/transport/composables/useRoomTransport';
import { useSessionStore } from '~/stores/Session';

const props = defineProps<{
  roomName: string;
}>();

const session = useSessionStore();
const username = computed(() => session.username);

const { messages, draft, sendMessage, setDraft } = useRoomChat(props.roomName);
const transport = useRoomTransport(props.roomName);

const inputEl = ref<HTMLTextAreaElement | null>(null);
const scrollContainer = ref<HTMLElement | null>(null);
const draftText = ref(draft.value);

watch(draft, (v) => { draftText.value = v; });
watch(draftText, (v) => { setDraft(v); });

const canSend = computed(() => Boolean(username.value) && draftText.value.trim() !== '');

function onSubmit (): void {
  if (!canSend.value || !username.value) { return; }
  const message = sendMessage(username.value, draftText.value);
  transport.sendMessage(message);
  void nextTick(scrollToBottom);
}

function autoGrow (e: Event): void {
  const el = e.target as HTMLTextAreaElement;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
}

function scrollToBottom (): void {
  const el = scrollContainer.value;
  if (el) { el.scrollTop = el.scrollHeight; }
}

function formatTime (ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

watch(() => messages.value.length, () => {
  void nextTick(scrollToBottom);
}, { immediate: true });

onMounted(() => {
  inputEl.value?.focus();
});
</script>