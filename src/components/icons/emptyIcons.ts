import type { Component } from "vue";
import {
  ArrowLeftRight,
  Bell,
  ChartColumnIncreasing,
  ClipboardList,
  Cpu,
  FolderKanban,
  FolderOpen,
  HardDrive,
  Hourglass,
  LayoutGrid,
  MessagesSquare,
  Monitor,
  Newspaper,
  ScrollText,
  Settings,
} from "lucide-vue-next";

/**
 * 空状态图标中央映射表。
 * 调用方只传字符串键，避免在各 view 里散落 emoji 或裸组件。
 */
export const EMPTY_ICONS: Record<string, Component> = {
  hardDrive: HardDrive,
  messages: MessagesSquare,
  newspaper: Newspaper,
  hourglass: Hourglass,
  folder: FolderOpen,
  clipboard: ClipboardList,
  transfer: ArrowLeftRight,
  chart: ChartColumnIncreasing,
};

/** 侧栏导航图标映射。key 与 navGroups 里的 item.icon 对应。 */
export const NAV_ICONS: Record<string, Component> = {
  grid: LayoutGrid,
  cpu: Cpu,
  folder: FolderKanban,
  chart: ChartColumnIncreasing,
  transfer: ArrowLeftRight,
  message: ScrollText,
  bell: Bell,
  disk: HardDrive,
  monitor: Monitor,
  settings: Settings,
};
