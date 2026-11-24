/**
 * 全应用统一的图表/标识调色板。
 * 任何图表、占比条、图例都从这里取色，避免同一实体在不同页面出现不同颜色。
 * 色系刻意避开紫色，保持纯黑极客风的冷峻感。
 */
export const CHART_PALETTE = [
  "#22d3ee", // cyan
  "#34d399", // emerald
  "#fbbf24", // amber
  "#fb7185", // rose
  "#60a5fa", // sky
  "#a3e635", // lime
  "#fb923c", // orange
  "#2dd4bf", // teal
] as const;

/** 用户/主机两个基础序列的固定色，保证跨页面语义一致。 */
export const SERIES_COLORS = {
  user: CHART_PALETTE[0],
  host: CHART_PALETTE[1],
} as const;

/** 按索引取色，超出调色板长度时循环。 */
export function colorForIndex(index: number): string {
  return CHART_PALETTE[((index % CHART_PALETTE.length) + CHART_PALETTE.length) % CHART_PALETTE.length];
}
