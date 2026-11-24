<script setup lang="ts">
import { ref, watch } from "vue";
import { X } from "lucide-vue-next";
import type { OldResult, DailyXfer } from "../types/boinc";
import { getOldResults, getDailyXferHistory } from "../composables/useRpc";
import { formatBytes, formatDateTimeShort } from "../utils/format";

const props = defineProps<{
  open: boolean;
  kind: "tasks" | "transfers";
}>();
const emit = defineEmits<{ close: [] }>();

const loading = ref(false);
const error = ref("");
const oldResults = ref<OldResult[]>([]);
const dailyXfers = ref<DailyXfer[]>([]);

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return;
    error.value = "";
    loading.value = true;
    try {
      if (props.kind === "tasks") {
        oldResults.value = await getOldResults();
      } else {
        const h = await getDailyXferHistory();
        dailyXfers.value = h.daily_xfers ?? [];
      }
    } catch (e) {
      error.value = String(e);
    } finally {
      loading.value = false;
    }
  },
);

function projectName(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="history-overlay" @click.self="emit('close')">
      <div class="history-dialog" role="dialog" aria-modal="true">
        <header class="history-header">
          <h3>
            {{ kind === "tasks" ? $t("history.oldTasks") : $t("history.dailyTransfers") }}
          </h3>
          <button class="close-btn" :aria-label="$t('common.close')" @click="emit('close')">
            <X :size="16" :stroke-width="1.8" />
          </button>
        </header>
        <div class="history-body">
          <p v-if="loading" class="history-status">{{ $t("common.loading") }}</p>
          <p v-else-if="error" class="history-error">{{ error }}</p>
          <template v-else-if="kind === 'tasks'">
            <p v-if="oldResults.length === 0" class="history-status">{{ $t("history.empty") }}</p>
            <div v-else class="history-table">
              <div v-for="(r, i) in oldResults" :key="`${r.result_name}-${i}`" class="history-row">
                <span class="history-main">{{ r.result_name }}</span>
                <span class="history-sub">{{ projectName(r.project_url) }} · {{ r.app_name }}</span>
                <span class="history-sub">
                  {{ formatDateTimeShort(r.completed_time) }} ·
                  {{ $t("history.exitStatus") }} {{ r.exit_status }}
                </span>
              </div>
            </div>
          </template>
          <template v-else>
            <p v-if="dailyXfers.length === 0" class="history-status">{{ $t("history.empty") }}</p>
            <div v-else class="history-table">
              <div v-for="(d, i) in dailyXfers" :key="`${d.when}-${i}`" class="history-row">
                <span class="history-main">{{ formatDateTimeShort(d.when) }}</span>
                <span class="history-sub">
                  ↑ {{ formatBytes(d.up) }} · ↓ {{ formatBytes(d.down) }}
                </span>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.history-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  padding: var(--space-lg);
}
.history-dialog {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 420px;
  max-height: 80vh;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}
.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
}
.history-header h3 {
  margin: 0;
  font-size: var(--font-size-lg);
  color: var(--color-text-primary);
}
.close-btn {
  display: inline-flex;
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
}
.history-body {
  padding: 12px 16px;
  overflow-y: auto;
}
.history-status {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-md);
  text-align: center;
  padding: 24px 0;
}
.history-error {
  color: var(--color-danger-text);
  font-size: var(--font-size-md);
}
.history-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.history-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-sm);
}
.history-main {
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
  word-break: break-all;
}
.history-sub {
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
}
</style>
