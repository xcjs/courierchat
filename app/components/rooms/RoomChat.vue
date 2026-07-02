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
        <div
          v-if="message.author === username && messageStatus[message.id]"
          class="flex items-center gap-0.5 mt-0.5 px-1 text-[10px] text-text-content/40"
        >
          <template v-if="messageStatus[message.id] === 'pending'">
            <Icon name="lucide:clock" size="10" />
            <span>Sending…</span>
          </template>
          <template v-else-if="messageStatus[message.id] === 'delivered'">
            <Icon name="lucide:check" size="10" />
            <span>Delivered</span>
          </template>
          <template v-else-if="messageStatus[message.id] === 'solo'">
            <Icon name="lucide:user" size="10" />
            <span>Sent (no one else here)</span>
          </template>
          <template v-else>
            <Icon name="lucide:alert-triangle" size="10" />
            <span>Failed</span>
          </template>
        </div>
      </div>
    </div>

    <div
      v-if="typingLabel"
      class="px-6 py-1 text-xs text-text-content/50 italic min-h-[1.25rem]"
    >
      {{ typingLabel }}
    </div>

    <div
      v-if="fileTransfer.transfers.value.length"
      class="px-6 py-1 space-y-1"
    >
      <div
        v-for="transfer in fileTransfer.transfers.value"
        :key="transfer.id"
        class="flex items-center gap-2 text-xs text-text-content/70"
      >
        <Icon
          :name="transfer.direction === 'outgoing' ? 'lucide:arrow-up' : 'lucide:arrow-down'"
          size="12"
        />
        <span class="truncate flex-1">{{ transfer.meta.name }}</span>
        <span class="shrink-0">{{ formatFileSize(transfer.meta.size) }}</span>
        <span
          v-if="transfer.status === 'active'"
          class="shrink-0"
        >{{ Math.round(transfer.progress * 100) }}%</span>
        <span
          v-else-if="transfer.status === 'complete'"
          class="shrink-0 text-green-500"
        >
          <button
            v-if="transfer.direction === 'incoming' && transfer.file"
            class="underline"
            @click="downloadFile(transfer.id)"
          >Save</button>
          <template v-else>Done</template>
        </span>
        <span
          v-else
          class="shrink-0 text-red-500"
        >Failed</span>
      </div>
    </div>

    <form
      class="flex items-end gap-2 px-4 py-3 border-t border-text-content/10 bg-surface"
      @submit.prevent="onSubmit"
    >
      <input
        ref="fileInputEl"
        type="file"
        class="hidden"
        @change="onFileSelect"
      />
      <button
        type="button"
        class="shrink-0 w-9 h-9 rounded-full bg-background-primary/10 text-text-content flex items-center justify-center disabled:opacity-40"
        :disabled="!username || transport.peers.value.length === 0"
        aria-label="Send file"
        @click="fileInputEl?.click()"
      >
        <Icon name="lucide:paperclip" size="16" />
      </button>
      <textarea
        ref="inputEl"
        v-model="draftText"
        rows="1"
        placeholder="Type a message…"
        class="flex-1 resize-none rounded border border-text-content/15 px-3 py-2 text-sm text-text-content bg-surface focus:outline-none focus:border-background-interactive max-h-32"
        :disabled="!username"
        @keydown.enter.exact.prevent="onSubmit"
        @input="onInput"
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoomChat } from '~/features/room/composables/useRoomChat';
import { SendStatus } from '~/features/room/types/RoomChat';
import type { UseRoomTransportReturn } from '~/features/transport/composables/useRoomTransport';
import { useFileTransfer } from '~/features/transport/composables/useFileTransfer';
import { useSessionStore } from '~/stores/Session';
import { useNotificationsStore, NotificationSeverity } from '~/stores/Notifications';

const props = defineProps<{
  roomName: string;
  transport: UseRoomTransportReturn;
}>();

const session = useSessionStore();
const notifications = useNotificationsStore();
const username = computed(() => session.username);

const { messages, draft, typingUsers, messageStatus, sendMessage, setDraft, setMessageStatus } = useRoomChat(props.roomName);
const fileTransfer = useFileTransfer();

props.transport.setFileTransferHandlers({
  onTransferStart: fileTransfer.onTransferStart,
  onTransferProgress: fileTransfer.onTransferProgress,
  onTransferComplete: fileTransfer.onTransferComplete,
  onTransferError: (id, reason) => {
    fileTransfer.onTransferError(id, reason);
    notifications.push(`File transfer failed: ${reason}`, NotificationSeverity.Error);
  },
  onOutgoingProgress: fileTransfer.onOutgoingProgress,
  onOutgoingComplete: fileTransfer.onOutgoingComplete,
  onOutgoingError: (id, reason) => {
    fileTransfer.onOutgoingError(id, reason);
    notifications.push(`File send failed: ${reason}`, NotificationSeverity.Error);
  }
});

const inputEl = ref<HTMLTextAreaElement | null>(null);
const fileInputEl = ref<HTMLInputElement | null>(null);
const scrollContainer = ref<HTMLElement | null>(null);
const draftText = ref(draft.value);
let typingStopTimer: ReturnType<typeof setTimeout> | null = null;
let lastTypingSent = false;

watch(draft, (v) => { draftText.value = v; });
watch(draftText, (v) => { setDraft(v); });

const canSend = computed(() => Boolean(username.value) && draftText.value.trim() !== '');

const typingLabel = computed(() => {
  const others = typingUsers.value.filter(u => u !== username.value);
  if (others.length === 0) { return ''; }
  if (others.length === 1) { return `${others[0]} is typing…`; }
  if (others.length === 2) { return `${others[0]} and ${others[1]} are typing…`; }
  return `${others[0]} and ${others.length - 1} others are typing…`;
});

async function onSubmit (): Promise<void> {
  if (!canSend.value || !username.value) { return; }
  const message = sendMessage(username.value, draftText.value);
  const delivered = await props.transport.sendMessage(message);
  const peerCount = props.transport.state.peers.length;
  if (delivered.length > 0 || props.transport.mode.value === 'relay') {
    setMessageStatus(message.id, SendStatus.Delivered);
  } else if (peerCount === 0) {
    setMessageStatus(message.id, SendStatus.Solo);
  }
  void nextTick(scrollToBottom);
  notifyTyping(false);
}

function onInput (e: Event): void {
  autoGrow(e);
  if (!username.value) { return; }
  notifyTyping(true);
}

function notifyTyping (isTyping: boolean): void {
  if (!username.value) { return; }
  if (typingStopTimer !== null) {
    clearTimeout(typingStopTimer);
    typingStopTimer = null;
  }
  if (isTyping) {
    if (!lastTypingSent) {
      lastTypingSent = true;
      props.transport.sendTyping(true);
    }
    typingStopTimer = setTimeout(() => {
      lastTypingSent = false;
      props.transport.sendTyping(false);
    }, 3000);
  } else {
    if (lastTypingSent) {
      lastTypingSent = false;
      props.transport.sendTyping(false);
    }
  }
}

function autoGrow (e: Event): void {
  const el = e.target as HTMLTextAreaElement;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
}

async function onFileSelect (e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  const files = input.files;
  if (!files || files.length === 0) { return; }
  const file = files[0];
  if (!file) { return; }
  input.value = '';

  const peer = props.transport.peers.value[0];
  if (!peer) {
    notifications.push('No peers connected.', NotificationSeverity.Error);
    return;
  }
  if (props.transport.mode.value === 'relay') {
    notifications.push('Direct connection unavailable — file transfer not possible.', NotificationSeverity.Error);
    return;
  }

  const id = await props.transport.sendFile(peer.peerId, file);
  if (id === null) {
    notifications.push('Direct connection unavailable — file transfer not possible.', NotificationSeverity.Error);
    return;
  }
  const safeFile = file as File;
  fileTransfer.addOutgoing(id, peer.peerId, { id, name: safeFile.name, size: safeFile.size, mimeType: safeFile.type });
}

function formatFileSize (bytes: number): string {
  if (bytes < 1024) { return `${bytes} B`; }
  if (bytes < 1024 * 1024) { return `${(bytes / 1024).toFixed(1)} KB`; }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function downloadFile (id: string): void {
  const transfer = fileTransfer.transfers.value.find(t => t.id === id);
  const file = transfer?.file;
  if (!file) { return; }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = transfer?.meta.name ?? 'download';
  a.click();
  URL.revokeObjectURL(url);
}

function scrollToBottom (): void {
  const el = scrollContainer.value;
  if (el) { el.scrollTop = el.scrollHeight; }
}

function formatTime (ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

watch(() => messages.value.length, () => {
  void nextTick(scrollToBottom);
}, { immediate: true });

onMounted(() => {
  inputEl.value?.focus();
});

onBeforeUnmount(() => {
  if (typingStopTimer !== null) {
    clearTimeout(typingStopTimer);
    typingStopTimer = null;
  }
  if (lastTypingSent) {
    props.transport.sendTyping(false);
  }
  fileTransfer.clear();
});
</script>