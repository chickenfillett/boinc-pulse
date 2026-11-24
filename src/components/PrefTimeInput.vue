<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { usePreferencesStore } from "../stores/preferences";
import type { GlobalPreferences } from "../types/boinc";
import { BOINC_DEFAULTS } from "../constants/boincDefaults";
import {
  decimalHoursToTimeString,
  timeStringToDecimalHours,
} from "../utils/timeConversion";
import TimeClockPicker from "./TimeClockPicker.vue";

const props = defineProps<{
  modelValue: number;
  label: string;
  field: keyof GlobalPreferences;
  zeroLabel?: string;
}>();

const emit = defineEmits<{ "update:modelValue": [value: number] }>();

const { t } = useI18n();
const store = usePreferencesStore();

const fileVal = computed(() => store.getFileValue(props.field));

const effectiveValue = computed(() => {
  if (props.modelValue !== 0) return props.modelValue;
  const working = store.getEffectiveValue(props.field);
  if (working != null && working !== 0) return working;
  if (fileVal.value != null && fileVal.value !== 0) return fileVal.value;
  return BOINC_DEFAULTS[props.field] ?? 0;
});

const timeString = computed(() =>
  decimalHoursToTimeString(effectiveValue.value),
);

const placeholder = computed(() => {
  if (effectiveValue.value === 0 && props.zeroLabel) return props.zeroLabel;
  return t("prefs.selectTime");
});

function onTimeChange(value: string) {
  emit("update:modelValue", timeStringToDecimalHours(value));
}
</script>

<template>
  <div class="pref-row">
    <span class="pref-label">{{ label }}</span>
    <TimeClockPicker
      :model-value="timeString"
      :placeholder="placeholder"
      :aria-label="label"
      @update:model-value="onTimeChange"
    />
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
</style>
