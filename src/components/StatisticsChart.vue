<script setup lang="ts">
/**
 * Credit chart.
 *
 * Two things were wrong with the previous implementation and both are fixed
 * here rather than cosmetically patched:
 *
 *  1. It plotted *cumulative* credit as a line. Cumulative credit only ever
 *     goes up, so every project produced the same smooth ramp and the chart
 *     carried no information. The default mode now plots the daily **delta** as
 *     bars, which is the number a volunteer actually cares about.
 *  2. The hover tooltip was a light pill on a pure-black app, and it covered the
 *     plot in a 460px window. Readings now render in a fixed strip above the
 *     chart, so nothing is ever obscured.
 *
 * Numbers and dates go through the Chinese formatters (万 / 亿, 月日).
 */
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { DailyStats } from "../types/boinc";
import { formatCredit, formatCreditParts } from "../utils/format";
import { SERIES_COLORS } from "../constants/chartColors";

const props = withDefaults(
  defineProps<{
    data: DailyStats[];
    title?: string;
    enabledSeries: Set<string>;
    height?: number;
    /** `delta` = bars of daily gain, `level` = line of the running average. */
    mode?: "delta" | "line";
    /** 时间区间，由父级持有，保证多张图同步切换。 */
    range?: "7" | "30" | "all";
  }>(),
  { mode: "delta", height: 190, range: "30" },
);

const { t } = useI18n();

const containerRef = ref<HTMLElement | null>(null);
const measuredWidth = ref(420);
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (!containerRef.value) return;
  measuredWidth.value = containerRef.value.clientWidth;
  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      measuredWidth.value = entry.contentRect.width;
    }
  });
  resizeObserver.observe(containerRef.value);
});

onUnmounted(() => resizeObserver?.disconnect());

const SERIES = {
  user: { total: "user_total_credit", avg: "user_expavg_credit", color: SERIES_COLORS.user, labelKey: "statistics.user" },
  host: { total: "host_total_credit", avg: "host_expavg_credit", color: SERIES_COLORS.host, labelKey: "statistics.host" },
} as const;

type Actor = keyof typeof SERIES;

const activeActors = computed<Actor[]>(() => {
  const actors: Actor[] = [];
  for (const actor of Object.keys(SERIES) as Actor[]) {
    const conf = SERIES[actor];
    if (props.enabledSeries.has(conf.total) || props.enabledSeries.has(conf.avg)) {
      actors.push(actor);
    }
  }
  return actors.length > 0 ? actors : ["user"];
});

const isDelta = computed(() => props.mode === "delta");

/* ---------- geometry ---------- */

const PAD = { top: 12, right: 10, bottom: 22, left: 40 };
const svgWidth = computed(() => Math.max(200, measuredWidth.value));
const svgHeight = computed(() => props.height);
const plotW = computed(() => svgWidth.value - PAD.left - PAD.right);
const plotH = computed(() => svgHeight.value - PAD.top - PAD.bottom);

const sorted = computed(() =>
  [...props.data].sort((a, b) => a.day - b.day),
);

/** Daily gain, divided by the gap so a three-day jump is not one day's output. */
const deltas = computed(() => {
  const rows = sorted.value;
  const out: {
    day: number;
    values: Partial<Record<Actor, number>>;
    cumulative: Partial<Record<Actor, number>>;
  }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const prev = i > 0 ? rows[i - 1] : null;
    const gap = prev
      ? Math.max(1, Math.round((row.day - prev.day) / 86400))
      : 1;
    const values: Partial<Record<Actor, number>> = {};
    const cumulative: Partial<Record<Actor, number>> = {};
    for (const actor of Object.keys(SERIES) as Actor[]) {
      const conf = SERIES[actor];
      const now = row[conf.total];
      cumulative[actor] = now;
      if (!prev) {
        values[actor] = 0;
      } else {
        values[actor] = Math.max(0, now - prev[conf.total]) / gap;
      }
    }
    out.push({ day: row.day, values, cumulative });
  }
  return out;
});

const visible = computed(() => {
  const rows = deltas.value;
  if (!isDelta.value) return rows;
  if (props.range === "all") return rows;
  const limit = props.range === "7" ? 7 : 30;
  return rows.slice(-limit);
});

const yMax = computed(() => {
  if (!isDelta.value) {
    let max = 0;
    for (const row of visible.value) {
      for (const actor of activeActors.value) {
        const conf = SERIES[actor];
        const stat = sorted.value.find((s) => s.day === row.day);
        if (stat) max = Math.max(max, stat[conf.avg]);
      }
    }
    return max > 0 ? max * 1.1 : 1;
  }
  let max = 0;
  for (const row of visible.value) {
    for (const actor of activeActors.value) {
      max = Math.max(max, row.values[actor] ?? 0);
    }
  }
  // A flat series (nothing gained yet) still needs a sane axis.
  return max > 0 ? max * 1.15 : 1;
});

const bandWidth = computed(() =>
  visible.value.length > 0 ? plotW.value / visible.value.length : plotW.value,
);

function bandX(index: number): number {
  return PAD.left + index * bandWidth.value;
}

function barWidth(): number {
  const count = activeActors.value.length;
  const usable = bandWidth.value * 0.72;
  return Math.max(2, usable / count);
}

function barX(index: number, actorIndex: number): number {
  const total = barWidth() * activeActors.value.length;
  const start = bandX(index) + (bandWidth.value - total) / 2;
  return start + actorIndex * barWidth();
}

function barHeight(value: number): number {
  const h = (value / yMax.value) * plotH.value;
  return Math.max(value > 0 ? 1.5 : 0, h);
}

function barY(value: number): number {
  return PAD.top + plotH.value - barHeight(value);
}

/** Line mode: the smoothed running average, one point per day. */
function linePath(actor: Actor): string {
  const conf = SERIES[actor];
  const rows = visible.value;
  if (rows.length === 0) return "";
  const step = rows.length > 1 ? plotW.value / (rows.length - 1) : 0;
  return rows
    .map((row, index) => {
      const stat = sorted.value.find((s) => s.day === row.day);
      const value = stat ? stat[conf.avg] : 0;
      const x = PAD.left + (rows.length > 1 ? index * step : plotW.value / 2);
      const y = PAD.top + plotH.value - (value / yMax.value) * plotH.value;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/* ---------- axes ---------- */

const yTicks = computed(() => [0, 0.5, 1].map((f) => f * yMax.value));

function tickLabel(value: number): string {
  const parts = formatCreditParts(value);
  return parts.unit ? `${parts.value}${parts.unit}` : parts.value;
}

const xLabels = computed(() => {
  const rows = visible.value;
  if (rows.length === 0) return [];
  const count = Math.min(rows.length, 4);
  const step = Math.max(1, Math.floor((rows.length - 1) / Math.max(1, count - 1)));
  const picked: { index: number; label: string }[] = [];
  for (let i = 0; i < rows.length; i += step) {
    picked.push({ index: i, label: shortDate(rows[i].day) });
    if (picked.length >= count) break;
  }
  const last = rows.length - 1;
  if (picked[picked.length - 1]?.index !== last && picked.length < count + 1) {
    picked.push({ index: last, label: shortDate(rows[last].day) });
  }
  return picked;
});

function shortDate(day: number): string {
  const date = new Date(day * 1000);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function longDate(day: number): string {
  const date = new Date(day * 1000);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

/* ---------- hover ---------- */

const hoverIndex = ref<number | null>(null);

function handleMove(event: MouseEvent) {
  if (visible.value.length === 0) return;
  const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
  const x = event.clientX - rect.left;
  const index = Math.floor((x - PAD.left) / bandWidth.value);
  hoverIndex.value =
    index >= 0 && index < visible.value.length ? index : null;
}

const hoverRow = computed(() =>
  hoverIndex.value != null ? visible.value[hoverIndex.value] ?? null : null,
);

const reading = computed(() => {
  const row = hoverRow.value ?? visible.value[visible.value.length - 1] ?? null;
  if (!row) return null;
  const actor = activeActors.value[0];
  const conf = SERIES[actor];
  const stat = sorted.value.find((s) => s.day === row.day);
  return {
    date: longDate(row.day),
    delta: row.values[actor] ?? 0,
    level: isDelta.value
      ? row.cumulative[actor] ?? 0
      : stat
        ? stat[conf.avg]
        : 0,
  };
});

const latestTotal = computed(() => {
  const total = activeActors.value.reduce((sum, actor) => {
    const last = visible.value[visible.value.length - 1];
    return sum + (last?.cumulative[actor] ?? 0);
  }, 0);
  return total;
});
</script>

<template>
  <section class="chart-card">
    <header class="chart-head">
      <h3 class="chart-title">{{ title }}</h3>
    </header>

    <!-- Reading strip replaces the floating tooltip: nothing covers the plot. -->
    <div class="reading-strip">
      <template v-if="reading">
        <span class="reading-date">{{ reading.date }}</span>
        <span class="reading-main">
          {{ isDelta ? "+" : "" }}{{ formatCredit(reading.delta) }}
        </span>
        <span class="reading-total">
          {{ t("statistics.chart.level") }} {{ formatCredit(reading.level) }}
        </span>
      </template>
      <span v-else class="reading-empty">{{ t("statistics.chart.noData") }}</span>
    </div>

    <div ref="containerRef" class="plot">
      <svg
        role="img"
        :aria-label="(title && title.trim()) || t('statistics.chartLabel')"
        :width="svgWidth"
        :height="svgHeight"
        class="plot-svg"
        @mousemove="handleMove"
        @mouseleave="hoverIndex = null"
      >
        <line
          v-for="(tick, index) in yTicks"
          :key="`grid-${index}`"
          :x1="PAD.left"
          :y1="PAD.top + plotH - (tick / yMax) * plotH"
          :x2="svgWidth - PAD.right"
          :y2="PAD.top + plotH - (tick / yMax) * plotH"
          class="grid-line"
          :class="{ 'grid-base': index === 0 }"
        />
        <text
          v-for="(tick, index) in yTicks"
          :key="`yt-${index}`"
          :x="PAD.left - 6"
          :y="PAD.top + plotH - (tick / yMax) * plotH + 3"
          class="axis-text axis-text-y"
        >
          {{ tickLabel(tick) }}
        </text>

        <text
          v-for="label in xLabels"
          :key="`xt-${label.index}`"
          :x="bandX(label.index) + bandWidth / 2"
          :y="svgHeight - 6"
          class="axis-text axis-text-x"
        >
          {{ label.label }}
        </text>

        <!-- Delta bars -->
        <template v-if="isDelta">
          <g v-for="(row, index) in visible" :key="row.day">
            <rect
              v-for="(actor, actorIndex) in activeActors"
              :key="actor"
              :x="barX(index, actorIndex)"
              :y="barY(row.values[actor] ?? 0)"
              :width="barWidth()"
              :height="barHeight(row.values[actor] ?? 0)"
              :fill="SERIES[actor].color"
              :opacity="
                hoverIndex === null || hoverIndex === index ? 0.92 : 0.32
              "
              rx="1.5"
            />
          </g>
        </template>

        <!-- Level lines -->
        <template v-else>
          <path
            v-for="actor in activeActors"
            :key="`line-${actor}`"
            :d="linePath(actor)"
            fill="none"
            :stroke="SERIES[actor].color"
            stroke-width="2"
            stroke-linejoin="round"
            stroke-linecap="round"
          />
        </template>

        <!-- Hover column highlight -->
        <rect
          v-if="hoverIndex !== null"
          :x="bandX(hoverIndex)"
          :y="PAD.top"
          :width="bandWidth"
          :height="plotH"
          class="hover-band"
        />
      </svg>
    </div>

    <footer class="chart-legend">
      <span v-for="actor in activeActors" :key="actor" class="legend-item">
        <span class="legend-dot" :style="{ background: SERIES[actor].color }"></span>
        {{ t(SERIES[actor].labelKey) }}
      </span>
      <span v-if="isDelta && latestTotal > 0" class="legend-total">
        {{ t("statistics.chart.latest") }} {{ formatCredit(latestTotal) }}
      </span>
    </footer>
  </section>
</template>

<style scoped>
.chart-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px 8px;
  margin-bottom: 10px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.chart-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.head-text {
  min-width: 0;
}

.chart-title {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.reading-strip {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-height: 20px;
  padding: 3px 8px;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-sm);
  font-variant-numeric: tabular-nums;
}

.reading-date {
  font-size: 10.5px;
  color: var(--color-text-tertiary);
}

.reading-main {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-success-text);
}

.reading-total {
  margin-left: auto;
  font-size: 10.5px;
  color: var(--color-text-secondary);
}

.reading-empty {
  font-size: 10.5px;
  color: var(--color-text-tertiary);
}

.plot {
  width: 100%;
  overflow: hidden;
}

.plot-svg {
  display: block;
  width: 100%;
}

.grid-line {
  stroke: var(--color-border-light);
  stroke-width: 1;
}

.grid-base {
  stroke: var(--color-border);
}

.axis-text {
  font-size: 9.5px;
  fill: var(--color-text-tertiary);
}

.axis-text-y {
  text-anchor: end;
}

.axis-text-x {
  text-anchor: middle;
}

.hover-band {
  fill: rgba(34, 211, 238, 0.08);
  pointer-events: none;
}

.chart-legend {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 10.5px;
  color: var(--color-text-tertiary);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.legend-dot {
  width: 6px;
  height: 6px;
  border-radius: 2px;
}

.legend-total {
  margin-left: auto;
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}
</style>
