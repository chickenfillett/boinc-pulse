<script setup lang="ts">
/**
 * Compact 24-hour time field.
 *
 * Replaces the previous analog-dial picker, which was unreadable at 460px and
 * required two drag gestures to enter a value. Here you just type `8:30` (or
 * `0830`, or nudge with the arrows / ↑↓ keys).
 */
import { computed, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: string; // "HH:mm" or ""
    placeholder?: string;
    compact?: boolean;
    ariaLabel?: string;
  }>(),
  {
    placeholder: "",
    compact: false,
    ariaLabel: "",
  },
);

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const draft = ref(props.modelValue);
const focused = ref(false);

watch(
  () => props.modelValue,
  (value) => {
    if (!focused.value) draft.value = value;
  },
);

const isBlank = computed(() => props.modelValue === "");

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Accepts "8", "08:5", "0830", "8.5", "8点30" → normalized "HH:mm". */
function normalize(raw: string): string | null {
  const input = raw.trim().replace(/：/g, ":").replace(/[点时]/g, ":").replace(/\s/g, "");
  if (input === "") return "";

  let hourPart: string;
  let minutePart: string;

  if (input.includes(":")) {
    const [h, m = "0"] = input.split(":");
    hourPart = h;
    minutePart = m;
  } else if (input.includes(".")) {
    const [h, frac = "0"] = input.split(".");
    hourPart = h;
    minutePart = String(Math.round(Number(`0.${frac}`) * 60));
  } else if (input.length <= 2) {
    hourPart = input;
    minutePart = "0";
  } else if (input.length <= 4) {
    const padded = input.padStart(4, "0");
    hourPart = padded.slice(0, 2);
    minutePart = padded.slice(2);
  } else {
    return null;
  }

  const hour = Number(hourPart);
  const minute = Number(minutePart);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  // 24:00 is a meaningful BOINC value (end of day), everything else is 00–23.
  if (hour === 24 && minute === 0) return "24:00";
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${pad(hour)}:${pad(minute)}`;
}

function commit() {
  const parsed = normalize(draft.value);
  if (parsed === null) {
    draft.value = props.modelValue; // invalid input: silently revert
    return;
  }
  draft.value = parsed;
  if (parsed !== props.modelValue) emit("update:modelValue", parsed);
}

function onInput(event: Event) {
  draft.value = (event.target as HTMLInputElement).value;
}

function onFocus() {
  focused.value = true;
}

function onBlur() {
  focused.value = false;
  commit();
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Enter") {
    event.preventDefault();
    commit();
    (event.target as HTMLInputElement).blur();
    return;
  }
  if (event.key === "Escape") {
    draft.value = props.modelValue;
    (event.target as HTMLInputElement).blur();
    return;
  }
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    event.preventDefault();
    step(event.key === "ArrowUp" ? 30 : -30);
  }
}

function currentMinutes(): number {
  const parsed = normalize(props.modelValue || draft.value);
  if (parsed === null || parsed === "") return 0;
  const [h, m] = parsed.split(":").map(Number);
  return h * 60 + m;
}

/** Wraps around midnight so the arrows never dead-end. */
function step(delta: number) {
  const total = (currentMinutes() + delta + 24 * 60) % (24 * 60);
  const next = `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
  draft.value = next;
  emit("update:modelValue", next);
}

function clear() {
  draft.value = "";
  emit("update:modelValue", "");
}

defineExpose({ step });
</script>

<template>
  <div class="time-field" :class="{ compact, blank: isBlank }">
    <input
      type="text"
      inputmode="numeric"
      autocomplete="off"
      spellcheck="false"
      :value="draft"
      :placeholder="placeholder"
      :aria-label="ariaLabel || placeholder"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
      @keydown="onKeydown"
    />
    <div class="stepper">
      <button
        type="button"
        class="step-btn"
        tabindex="-1"
        aria-label="+30 分钟"
        @mousedown.prevent
        @click="step(30)"
      >
        <svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true">
          <path d="M1 5l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        class="step-btn"
        tabindex="-1"
        aria-label="-30 分钟"
        @mousedown.prevent
        @click="step(-30)"
      >
        <svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true">
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>
    <button
      v-if="!isBlank"
      type="button"
      class="clear-btn"
      tabindex="-1"
      aria-label="清除"
      @mousedown.prevent
      @click="clear"
    >
      ×
    </button>
  </div>
</template>

<style scoped>
.time-field {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  width: min(132px, 42vw);
  padding: 0 4px 0 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-secondary);
  transition: border-color var(--transition-fast);
}

.time-field:focus-within {
  border-color: var(--color-accent);
}

.time-field.compact {
  width: auto;
  min-width: 92px;
}

.time-field input {
  flex: 1;
  min-width: 0;
  padding: 6px 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--color-text-primary);
  font-size: var(--font-size-md);
  font-variant-numeric: tabular-nums;
  text-align: right;
  letter-spacing: 0.02em;
}

.time-field.blank input {
  text-align: left;
}

.time-field input::placeholder {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  letter-spacing: normal;
}

.stepper {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 2px 0;
}

.step-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 11px;
  padding: 0;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.step-btn:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.clear-btn {
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-tertiary);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--transition-fast), color var(--transition-fast);
}

.time-field:hover .clear-btn,
.time-field:focus-within .clear-btn {
  opacity: 1;
}

.clear-btn:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-tertiary);
}
</style>
