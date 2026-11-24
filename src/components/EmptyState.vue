<script setup lang="ts">
import { computed } from "vue";
import { EMPTY_ICONS } from "./icons/emptyIcons";

const props = defineProps<{
  icon?: string;
  message: string;
}>();

const iconComponent = computed(() =>
  props.icon ? EMPTY_ICONS[props.icon] : undefined,
);
</script>

<template>
  <div class="empty-state">
    <span v-if="iconComponent" class="empty-icon">
      <component :is="iconComponent" :size="30" :stroke-width="1.5" />
    </span>
    <p class="empty-message">{{ message }}</p>
    <slot />
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-2xl) var(--space-lg);
  color: var(--color-text-tertiary);
  min-height: 200px;
}

.empty-icon {
  display: inline-flex;
  margin-bottom: var(--space-md);
  opacity: 0.55;
  color: var(--color-text-tertiary);
}

.empty-message {
  font-size: var(--font-size-base);
  text-align: center;
}
</style>
