<template>
  <nav
    class="icon-rail bg-background-primary h-full w-16 flex flex-col items-center py-3 gap-3 shadow-courier-drop relative z-30 overflow-visible"
    aria-label="Room navigation"
  >
    <div class="flex-1 w-full flex flex-col items-center gap-3">
      <button
        type="button"
        class="relative block focus:outline-none"
        aria-label="Create a Room"
        @click="$emit('create-room')"
      >
        <span
          class="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-text-content-inverted relative z-30"
        >
          <Icon name="lucide:plus" size="28" />
        </span>
        <span
          class="animated faster anim-nav-hover shadow-courier-drop absolute left-0 top-0 h-full flex items-center rounded-full bg-background-primary px-4 pl-16 text-text-content-inverted font-medium whitespace-nowrap z-20"
        >
          New Room
        </span>
      </button>

      <NuxtLink
        v-for="room in rooms"
        :key="room.name"
        :to="`/rooms/${encodeURIComponent(room.name)}`"
        class="relative block focus:outline-none"
        :aria-label="`Room: ${room.name}`"
        :aria-current="room.name === activeRoomName ? 'true' : undefined"
      >
        <span
          class="w-14 h-14 rounded-full flex items-center justify-center text-lg relative z-30"
          :class="room.name === activeRoomName
            ? 'bg-white/30 ring-2 ring-white/60'
            : 'bg-white/10'"
        >
          <template v-if="room.icon">
            <Icon v-if="!room.icon.startsWith('emoji:')" :name="room.icon" size="28" />
            <span v-else aria-hidden="true">{{ room.icon.slice(6) }}</span>
          </template>
          <img v-else src="/courierchat.svg" alt="" class="w-10 h-10 rounded-full p-1" />
        </span>
        <span
          class="animated faster anim-nav-hover shadow-courier-drop absolute left-0 top-0 h-full flex items-center rounded-full bg-background-primary px-4 pl-16 text-text-content-inverted font-medium whitespace-nowrap z-20"
        >
          {{ room.name }}
        </span>
      </NuxtLink>
    </div>
  </nav>
</template>

<script setup lang="ts">
interface RoomEntry {
  name: string
  icon?: string
}

defineProps<{
  rooms: RoomEntry[]
  activeRoomName?: string
}>()

defineEmits<{
  'create-room': []
}>()
</script>