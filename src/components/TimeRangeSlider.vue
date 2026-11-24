<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from "vue";

const props = withDefaults(
  defineProps<{
    startHour: number;
    endHour: number;
    label?: string;
    /** Localized "All day" text, e.g. 全天 */
    allDayLabel?: string;
  }>(),
  { label: "", allDayLabel: "全天" },
);

const emit = defineEmits<{
  "update:startHour": [value: number];
  "update:endHour": [value: number];
}>();

const trackRef = ref<HTMLElement>();
const dragging = ref<"start" | "end" | null>(null);

const STEP = 0.5;
const MAX = 24;
const TICKS = [0, 6, 12, 18, 24];

function snapToStep(value: number): number {
  return Math.round(value / STEP) * STEP;
}

function clampValue(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toPercent(hour: number): number {
  return (hour / MAX) * 100;
}

function hourFromX(e: MouseEvent): number {
  if (!trackRef.value) return 0;
  const rect = trackRef.value.getBoundingClientRect();
  return snapToStep(
    clampValue(((e.clientX - rect.left) / rect.width) * MAX, 0, MAX),
  );
}

function formatTime(hour: number): string {
  const hrs = Math.floor(hour);
  const min = Math.round((hour - hrs) * 60);
  return `${String(hrs).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

const isAllDay = computed(() => props.startHour === 0 && props.endHour === 0);
const startPct = computed(() =>
  isAllDay.value ? 0 : toPercent(props.startHour),
);
const endPct = computed(() =>
  isAllDay.value ? 100 : toPercent(props.endHour),
);
const rangeLabel = computed(() => {
  if (isAllDay.value) return props.allDayLabel;
  return `${formatTime(props.startHour)} – ${formatTime(props.endHour)}`;
});

/** BOINC's sentinel for "run around the clock" is start=0, end=0. */
function setAllDay() {
  emit("update:startHour", 0);
  emit("update:endHour", 0);
}

function onHandleDown(which: "start" | "end", e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  dragging.value = which;
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
}

function onMouseMove(e: MouseEvent) {
  if (!dragging.value) return;
  const hour = hourFromX(e);
  const effEnd = isAllDay.value ? MAX : props.endHour;
  if (dragging.value === "start") {
    emit("update:startHour", clampValue(hour, 0, effEnd));
    if (isAllDay.value) emit("update:endHour", MAX);
  } else {
    emit("update:endHour", clampValue(hour, props.startHour, MAX));
  }
}

function onMouseUp() {
  dragging.value = null;
  document.removeEventListener("mousemove", onMouseMove);
  document.removeEventListener("mouseup", onMouseUp);
}

onBeforeUnmount(() => {
  document.removeEventListener("mousemove", onMouseMove);
  document.removeEventListener("mouseup", onMouseUp);
});

function onTrackClick(e: MouseEvent) {
  if (dragging.value) return;
  const hour = hourFromX(e);
  const effEnd = isAllDay.value ? MAX : props.endHour;
  const distToStart = Math.abs(hour - props.startHour);
  const distToEnd = Math.abs(hour - effEnd);
  if (distToStart < distToEnd) {
    emit("update:startHour", clampValue(hour, 0, effEnd));
    if (isAllDay.value) emit("update:endHour", MAX);
  } else {
    emit("update:endHour", clampValue(hour, props.startHour, MAX));
  }
}
</script>

<template>
  <div class="range-slider">
    <div class="range-header">
      <span v-if="label" class="range-label">{{ label }}</span>
      <span class="range-value">{{ rangeLabel }}</span>
      <button
        v-if="!isAllDay"
        type="button"
        class="all-day-btn"
        @click="setAllDay"
      >
        {{ allDayLabel }}
      </button>
    </div>
    <div ref="trackRef" class="range-track" @mousedown="onTrackClick">
      <div
        class="range-fill"
        :style="{ left: startPct + '%', width: endPct - startPct + '%' }"
      />
      <div
        class="range-handle"
        :class="{ active: dragging === 'start', edge: startPct <= 1 }"
        :style="{ left: startPct + '%' }"
        role="slider"
        aria-valuemin="0"
        :aria-valuemax="endHour || 24"
        :aria-valuenow="startHour"
        tabindex="0"
        @mousedown="onHandleDown('start', $event)"
      >
        <span class="handle-grip" />
      </div>
      <div
        class="range-handle"
        :class="{ active: dragging === 'end', edge: endPct >= 99 }"
        :style="{ left: endPct + '%' }"
        role="slider"
        aria-valuemin="0"
        aria-valuemax="24"
        :aria-valuenow="isAllDay ? 24 : endHour"
        tabindex="0"
        @mousedown="onHandleDown('end', $event)"
      >
        <span class="handle-grip" />
      </div>
    </div>
    <div class="range-ticks">
      <span
        v-for="t in TICKS"
        :key="t"
        class="range-tick"
        :style="{ left: toPercent(t) + '%' }"
        >{{ t }}</span
      >
    </div>
  </div>
</template>

<style scoped>
.range-slider {
  flex: 1;
  min-width: 0;
  user-select: none;
}

.range-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.range-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  flex-shrink: 0;
  min-width: 32px;
}

.range-value {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
}

.all-day-btn {
  margin-left: auto;
  padding: 1px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition:
    color var(--transition-fast),
    border-color var(--transition-fast);
}

.all-day-btn:hover {
  color: var(--color-text-primary);
  border-color: var(--color-text-tertiary);
}

.range-track {
  position: relative;
  height: 4px;
  margin: 8px 0;
  background: var(--color-bg-tertiary);
  border-radius: 2px;
  cursor: pointer;
}

.range-fill {
  position: absolute;
  top: 0;
  height: 100%;
  background: var(--color-accent);
  border-radius: 2px;
  opacity: 0.55;
  pointer-events: none;
}

.range-handle {
  position: absolute;
  top: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-bg);
  border: 2px solid var(--color-accent);
  transform: translate(-50%, -50%);
  cursor: grab;
  z-index: 1;
  transition: box-shadow 0.15s ease;
}

.range-handle.edge:first-of-type {
  transform: translate(-50%, -50%);
}

.range-handle:hover,
.range-handle.active {
  box-shadow: 0 0 0 4px var(--color-accent-light);
  cursor: grabbing;
}

.handle-grip {
  width: 2px;
  height: 6px;
  border-radius: 1px;
  background: var(--color-accent);
}

.range-ticks {
  position: relative;
  height: 14px;
}

.range-tick {
  position: absolute;
  transform: translateX(-50%);
  font-size: 10px;
  color: var(--color-text-tertiary);
  font-variant-numeric: tabular-nums;
}
</style>
