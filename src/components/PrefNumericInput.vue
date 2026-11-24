<script setup lang="ts">
import { computed } from "vue";
import { usePreferencesStore } from "../stores/preferences";
import type { GlobalPreferences } from "../types/boinc";
import { BOINC_DEFAULTS } from "../constants/boincDefaults";

const props = withDefaults(
  defineProps<{
    modelValue: number;
    label: string;
    field: keyof GlobalPreferences;
    min?: number;
    max?: number;
    step?: number;
    zeroLabel?: string;
    suffix?: string;
  }>(),
  {
    min: 0,
    step: 1,
    suffix: "",
  },
);

const emit = defineEmits<{ "update:modelValue": [value: number] }>();

const store = usePreferencesStore();

const fileVal = computed(() => store.getFileValue(props.field));

const effectiveValue = computed(() => {
  if (props.modelValue !== 0) return props.modelValue;
  const working = store.getEffectiveValue(props.field);
  if (working != null && working !== 0) return working;
  if (fileVal.value != null && fileVal.value !== 0) return fileVal.value;
  return BOINC_DEFAULTS[props.field] ?? 0;
});

const displayValue = computed(() =>
  effectiveValue.value === 0 ? "" : String(effectiveValue.value),
);

const placeholder = computed(() => {
  if (effectiveValue.value === 0 && props.zeroLabel) return props.zeroLabel;
  return "";
});

function onInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value.trim();
  if (raw === "") {
    emit("update:modelValue", 0);
    return;
  }
  const num = Number(raw);
  if (!isNaN(num)) emit("update:modelValue", num);
}
</script>

<template>
  <label class="pref-row">
    <span class="pref-label">{{ label }}</span>
    <span class="pref-control">
      <input
        type="text"
        inputmode="decimal"
        :class="{ 'has-suffix': suffix }"
        :value="displayValue"
        :placeholder="placeholder"
        @input="onInput"
      />
      <span v-if="suffix" class="input-suffix">{{ suffix }}</span>
    </span>
  </label>
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
  position: relative;
  display: inline-flex;
  align-items: center;
}

.pref-control input {
  width: min(132px, 42vw);
  padding: 6px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
  font-variant-numeric: tabular-nums;
  text-align: right;
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  transition: border-color var(--transition-fast);
}

.pref-control input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.pref-control input::placeholder {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}

.pref-control input.has-suffix {
  padding-right: 24px;
}

.input-suffix {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
  pointer-events: none;
  user-select: none;
}
</style>
