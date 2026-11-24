<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { onClickOutside } from "@vueuse/core";
import { ChevronDown } from "lucide-vue-next";

interface Option {
  value: string;
  label: string;
}

const props = defineProps<{
  modelValue: string;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  open: [];
  close: [];
}>();

const root = ref<HTMLElement | null>(null);
const list = ref<HTMLElement | null>(null);
const isOpen = ref(false);
const activeIndex = ref(0);

const currentLabel = computed(
  () =>
    props.options.find((o) => o.value === props.modelValue)?.label ??
    props.placeholder ??
    "",
);

onClickOutside(root, () => {
  if (isOpen.value) close();
});

function open() {
  if (props.disabled || isOpen.value) return;
  isOpen.value = true;
  activeIndex.value = Math.max(
    0,
    props.options.findIndex((o) => o.value === props.modelValue),
  );
  emit("open");
  nextTick(() => list.value?.focus());
}

function close() {
  if (!isOpen.value) return;
  isOpen.value = false;
  emit("close");
}

function select(option: Option) {
  emit("update:modelValue", option.value);
  close();
}

function move(delta: number) {
  if (props.options.length === 0) return;
  activeIndex.value =
    (activeIndex.value + delta + props.options.length) % props.options.length;
}

function onKeydown(e: KeyboardEvent) {
  if (!isOpen.value) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    move(1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    move(-1);
  } else if (e.key === "Enter") {
    e.preventDefault();
    const opt = props.options[activeIndex.value];
    if (opt) select(opt);
  } else if (e.key === "Escape") {
    e.preventDefault();
    close();
  }
}
</script>

<template>
  <div ref="root" class="app-select">
    <button
      type="button"
      class="select-trigger"
      :disabled="disabled"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      @click="isOpen ? close() : open()"
    >
      <span class="select-value">{{ currentLabel }}</span>
      <ChevronDown :size="14" :stroke-width="1.8" class="select-chevron" :class="{ open: isOpen }" />
    </button>
    <Transition name="select-pop">
      <ul
        v-if="isOpen"
        ref="list"
        class="select-list"
        role="listbox"
        tabindex="-1"
        @keydown="onKeydown"
      >
        <li
          v-for="(option, index) in options"
          :key="option.value"
          role="option"
          :aria-selected="option.value === modelValue"
          :class="['select-option', { active: index === activeIndex }]"
          @click="select(option)"
          @mouseenter="activeIndex = index"
        >
          {{ option.label }}
        </li>
        <li v-if="options.length === 0" class="select-empty">—</li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
.app-select {
  position: relative;
  min-width: 0;
}

.select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.select-trigger:hover {
  border-color: var(--color-border);
}

.select-value {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.select-chevron {
  flex-shrink: 0;
  color: var(--color-text-tertiary);
  transition: transform var(--transition-fast);
}
.select-chevron.open {
  transform: rotate(180deg);
}

.select-list {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 20;
  list-style: none;
  margin: 0;
  padding: 4px;
  max-height: 220px;
  overflow-y: auto;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  outline: none;
}

.select-option {
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.select-option.active,
.select-option:hover {
  background: var(--color-accent-light);
  color: var(--color-text-primary);
}

.select-empty {
  padding: 6px 8px;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}

.select-pop-enter-active,
.select-pop-leave-active {
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}
.select-pop-enter-from,
.select-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
