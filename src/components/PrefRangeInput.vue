<script setup lang="ts">
import { computed, ref } from "vue";
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
    /** When true, modelValue is 0–1 fraction but UI shows 0–100 percent */
    fraction?: boolean;
    /** Suffix shown inside the input (e.g. "%") */
    suffix?: string;
  }>(),
  {
    min: 0,
    max: 100,
    step: 10,
    fraction: false,
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

/** Value in display units (percent when fraction mode) */
const displayNumeric = computed(() => {
  const val = effectiveValue.value;
  if (val === 0) return 0;
  return props.fraction ? Math.round(val * 100) : val;
});

const displayValue = computed(() =>
  effectiveValue.value === 0 ? "" : String(displayNumeric.value),
);

const placeholder = computed(() => {
  if (effectiveValue.value === 0 && props.zeroLabel) return props.zeroLabel;
  return "";
});

const fillPercent = computed(() => {
  const min = props.fraction ? props.min * 100 : props.min;
  const max = props.fraction ? props.max * 100 : props.max;
  const range = max - min;
  if (range <= 0) return 0;
  return Math.max(0, Math.min(100, ((displayNumeric.value - min) / range) * 100));
});

// ── Text input ──────────────────────────────────────────────────
function onInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value.trim();
  if (raw === "") {
    emit("update:modelValue", 0);
    return;
  }
  const num = Number(raw);
  if (!isNaN(num)) emit("update:modelValue", props.fraction ? num / 100 : num);
}

// ── Slider interaction (click / drag on the input background) ───
const inputRef = ref<HTMLInputElement | null>(null);
const dragging = ref(false);

function snapToStep(value: number, step: number): number {
  const snapped = Math.round(value / step) * step;
  const decimals = String(step).includes(".")
    ? String(step).split(".")[1].length
    : 0;
  return Number(snapped.toFixed(decimals));
}

function valueFromMouseX(event: MouseEvent): number {
  const el = inputRef.value;
  if (!el) return effectiveValue.value;
  const rect = el.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  const min = props.fraction ? props.min * 100 : props.min;
  const max = props.fraction ? props.max * 100 : props.max;
  const step = props.fraction ? props.step * 100 : props.step;
  const raw = min + ratio * (max - min);
  const snapped = snapToStep(Math.max(min, Math.min(max, raw)), step);
  return props.fraction ? snapped / 100 : snapped;
}

function onMouseDown(event: MouseEvent) {
  if (event.button !== 0) return;
  const target = event.target as HTMLInputElement;
  if (document.activeElement === target) return;

  event.preventDefault();
  dragging.value = true;
  emit("update:modelValue", valueFromMouseX(event));

  function onMouseMove(e: MouseEvent) {
    emit("update:modelValue", valueFromMouseX(e));
  }

  function onMouseUp() {
    dragging.value = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
}
</script>

<template>
  <label class="pref-row">
    <span class="pref-label">{{ label }}</span>
    <span class="range-input-wrapper">
      <input
        ref="inputRef"
        type="text"
        inputmode="decimal"
        class="range-input"
        :class="{ dragging, 'has-suffix': suffix }"
        :value="displayValue"
        :placeholder="placeholder"
        :style="{
          backgroundImage: `linear-gradient(to right, var(--range-fill) ${fillPercent}%, transparent ${fillPercent}%)`,
        }"
        @input="onInput"
        @mousedown="onMouseDown"
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

.range-input-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
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

.range-input.has-suffix {
  padding-right: 24px;
}

.range-input {
  --range-fill: color-mix(in srgb, var(--color-accent) 26%, transparent);

  width: min(132px, 42vw);
  padding: 6px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
  font-variant-numeric: tabular-nums;
  text-align: right;
  background-color: var(--color-bg-secondary);
  color: var(--color-text-primary);
  background-repeat: no-repeat;
  background-origin: padding-box;
  transition: border-color var(--transition-fast);
  cursor: ew-resize;
}

.range-input:focus {
  outline: none;
  border-color: var(--color-accent);
  cursor: text;
}

.range-input::placeholder {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}
</style>
