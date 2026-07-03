<template>
  <div class="flex flex-col h-full">
    <div v-if="!room" class="flex flex-col items-center justify-center h-full text-center px-6">
      <Icon name="lucide:door-closed" size="32" class="mb-3 text-text-content/20" />
      <h2 class="text-lg font-medium text-text-content mb-1">
        Room not found
      </h2>
      <p class="text-sm text-text-content/50 mb-4">
        "{{ roomName }}" doesn't exist or isn't visible to your session.
      </p>
      <NuxtLink
        to="/rooms"
        class="px-4 py-2 rounded bg-background-interactive text-text-content-inverted font-medium shadow-courier-drop"
      >
        Back to Rooms
      </NuxtLink>
    </div>

    <RoomChat v-else :room-name="roomName" :transport="transport" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute } from '#imports';
import { useRoomsStore } from '~/stores/Rooms';
import { useSessionStore } from '~/stores/Session';
import { useConnectionStore } from '~/stores/Connection';
import { useSignaling } from '~/features/transport/composables/useSignaling';
import { useRoomTransport } from '~/features/transport/composables/useRoomTransport';
import { useRoomChat } from '~/features/room/composables/useRoomChat';
import RoomChat from '~/components/rooms/RoomChat.vue';
import type { ChatMessage } from '#shared/types/ChatMessage';
import type { PeerIdentity } from '#shared/types/Signaling';

definePageMeta({ layout: 'default' });

const route = useRoute();
const roomsStore = useRoomsStore();
const session = useSessionStore();
const connection = useConnectionStore();
const signaling = useSignaling();

const roomName = computed(() => {
  const name = route.params?.name;
  return typeof name === 'string' ? decodeURIComponent(name) : '';
});

const room = computed(() => {
  const r = roomsStore.getRoom(roomName.value);
  if (!r) { return undefined; }
  const visible = r.tiers.some(t => session.tiers.includes(t));
  return visible ? r : undefined;
});

const transport = useRoomTransport(roomName.value);

function onIncomingMessage (message: ChatMessage): void {
  // Avoid echoing our own messages back — the sender already added locally.
  if (message.author === session.username) { return; }
  // Bind to the current room so messages route to the right state.
  useRoomChat(roomName.value).pushRemote(message);
}

function onPeerJoined (_peer: PeerIdentity): void {
  connection.setActiveRoomPeerCount(transport.peers.value.length + 1);
}

function onPeerLeft (_peerId: string): void {
  connection.setActiveRoomPeerCount(Math.max(0, transport.peers.value.length));
}

function onTyping (username: string, isTyping: boolean): void {
  useRoomChat(roomName.value).setTyping(username, isTyping);
}

transport.setHandlers({
  onMessage: onIncomingMessage,
  onPeerJoined,
  onPeerLeft,
  onTyping
});

watch(() => transport.mode.value, (mode) => {
  connection.setActiveRoomMode(mode);
});

watch(() => transport.peers.value.length, (count) => {
  connection.setActiveRoomPeerCount(count + 1);
});

async function tryJoin (): Promise<void> {
  if (!room.value) { return; }
  if (!signaling.isConnected.value) {
    // Connection not up yet; wait briefly and retry. The layout's onMounted
    // kicks off the signaling connection; race with it.
    await new Promise<void>((resolve) => { setTimeout(resolve, 250); });
    if (!signaling.isConnected.value) { return; }
  }
  transport.join();
}

onMounted(() => {
  connection.setActiveRoom(roomName.value);
  tryJoin().catch(() => {});
});

onBeforeUnmount(() => {
  // Detach (not leave) so navigation to /about, /settings, etc. doesn't drop
  // the room from the sidebar — the user is still a member. Re-mounting the
  // room page re-joins to repopulate peers/transport.
  transport.detach();
  connection.setActiveRoom(null);
});

// Re-join if the room name changes while mounted (param navigation).
watch(roomName, (name) => {
  transport.detach();
  if (name) {
    connection.setActiveRoom(name);
    tryJoin().catch(() => {});
  }
});
</script>
