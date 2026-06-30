<template>
  <div />
</template>

<script setup lang="ts">
definePageMeta({ layout: false });

// Redirect to /rooms; auth middleware will bounce to /login if needed.
await navigateTo('/rooms');
</script>
