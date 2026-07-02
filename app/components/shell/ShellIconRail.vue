<template>
  <nav
    class="icon-rail bg-background-primary h-full w-16 flex flex-col items-center shadow-courier-drop relative z-30 overflow-visible"
    aria-label="Room navigation"
  >
    <div class="w-full flex flex-col items-center pt-3 pb-3 shrink-0">
      <button
        type="button"
        class="relative block focus:outline-none"
        aria-label="Create a Room"
        @click="$emit('create-room')"
      >
        <span
          class="w-14 h-14 rounded-full bg-background-primary flex items-center justify-center text-text-content-inverted relative z-30"
        >
          <Icon name="lucide:plus" size="28" />
        </span>
        <span
          class="animated faster anim-nav-hover shadow-courier-drop absolute left-0 top-0 h-full flex items-center rounded-full bg-background-primary px-4 pl-16 text-text-content-inverted font-medium whitespace-nowrap z-20 pointer-events-none"
        >
          New Room
        </span>
      </button>
    </div>

    <div
      ref="scrollEl"
      class="flex-1 w-full relative"
      style="overflow-y: clip; overflow-x: visible;"
      @wheel="onWheel"
    >
      <div
        ref="listEl"
        class="w-full flex flex-col items-center gap-3 py-1 will-change-transform"
        :style="{ transform: `translateY(${-offset}px)` }"
      >
        <NuxtLink
          v-for="room in rooms"
          :key="room.name"
          :to="`/rooms/${encodeURIComponent(room.name)}`"
          class="relative block focus:outline-none"
          :aria-label="`Room: ${room.name}`"
          :aria-current="room.name === activeRoomName ? 'true' : undefined"
        >
          <span
            class="w-14 h-14 rounded-full flex items-center justify-center text-lg relative z-30 bg-white text-background-interactive"
            :class="room.icon ? 'ring-[6px] ring-inset ring-background-interactive' : ''"
          >
            <template v-if="room.icon">
              <Icon v-if="!room.icon.startsWith('emoji:')" :name="room.icon" size="34" class="text-background-interactive" />
              <span v-else aria-hidden="true" class="text-2xl">{{ room.icon.slice(6) }}</span>
            </template>
            <img v-else src="/courierchat.svg" alt="" class="w-full h-full" />
          </span>
          <span
            class="animated faster anim-nav-hover shadow-courier-drop absolute left-0 top-0 h-full flex items-center rounded-full bg-background-interactive px-4 pl-16 text-text-content-inverted font-medium whitespace-nowrap z-20 pointer-events-none"
          >
            {{ room.name }}
          </span>
        </NuxtLink>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
interface RoomEntry {
  name: string
  icon?: string
}

const props = defineProps<{
  rooms: RoomEntry[]
  activeRoomName?: string
}>()

defineEmits<{
  'create-room': []
}>()

const scrollEl = ref<HTMLElement | null>(null)
const listEl = ref<HTMLElement | null>(null)
const offset = ref(0)

function onWheel(e: WheelEvent) {
  const container = scrollEl.value
  const list = listEl.value
  if (!container || !list) return
  const maxScroll = list.scrollHeight - container.clientHeight
  if (maxScroll <= 0) return
  e.preventDefault()
  offset.value = Math.max(0, Math.min(maxScroll, offset.value + e.deltaY))
}

watch(() => props.rooms.length, () => {
  offset.value = 0
})
</script>