<script setup lang="ts">
import { computed } from "vue";
import { usePreferencesStore } from "../stores/preferences";
import type { GlobalPreferences } from "../types/boinc";

const props = defineProps<{
  modelValue: boolean;
  label: string;
  field: keyof GlobalPreferences;
}>();

const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();

const store = usePreferencesStore();

const fileVal = computed(() => store.getBoolFileValue(props.field));

/** Whether the current value differs from what global_prefs.xml already holds. */
const isDefault = computed(
  () => fileVal.value == null || props.modelValue === fileVal.value,
);

function toggle() {
  emit("update:modelValue", !props.modelValue);
}
</script>

<template>
  <div class="pref-row">
    <span class="pref-label">{{ label }}</span>
    <span class="pref-control">
      <span v-if="!isDefault" class="modified-hint">{{
        $t("prefs.modified")
      }}</span>
      <span
        class="toggle-switch"
        :class="{ on: modelValue }"
        role="switch"
        :aria-checked="modelValue"
        :aria-label="label"
        tabindex="0"
        @click="toggle"
        @keydown.enter.prevent="toggle"
        @keydown.space.prevent="toggle"
      >
        <span class="toggle-knob" />
      </span>
    </span>
  </div>
</template>

<style scoped>
.pref-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0;
  border-bottom: 1px solid var(--color-border-light);
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
  cursor: default;
}

.pref-row:last-child {
  border-bottom: none;
}

.pref-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.modified-hint {
  font-size: var(--font-size-xs);
  color: var(--color-accent-text);
}

.toggle-switch {
  position: relative;
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background: #2a2a36;
  box-shadow: inset 0 0 0 1px var(--color-border);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background 0.2s,
    box-shadow 0.2s;
}

.toggle-switch:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.toggle-switch.on {
  background: var(--color-accent);
  box-shadow: inset 0 0 0 1px transparent;
}

.toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ffffff;
  transition: left 0.2s;
}

.toggle-switch.on .toggle-knob {
  left: 18px;
}
</style>
