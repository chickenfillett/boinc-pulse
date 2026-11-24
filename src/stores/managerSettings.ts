import { defineStore } from "pinia";
import { useLocalStorage } from "@vueuse/core";

export interface ManagerSettings {
  language: string;
  theme: "system" | "light" | "dark";
  reminderFrequency: string;
  showExitConfirmation: boolean;
  showShutdownConfirmation: boolean;
  minimizeToTrayOnClose: boolean;
  startMinimizedToTray: boolean;
  checkForUpdates: boolean;
  /** Whether the user has seen the first-run BOINC Manager takeover prompt. */
  onboardingCompleted: boolean;
  /** Whether the user has seen the first-run "BOINC not installed" prompt. */
  installOnboardingCompleted: boolean;
}

const STORAGE_KEY = "boinc-manager-settings";

const defaults: ManagerSettings = {
  language: "zh_CN",
  theme: "dark",
  reminderFrequency: "1d",
  showExitConfirmation: true,
  showShutdownConfirmation: true,
  minimizeToTrayOnClose: true,
  startMinimizedToTray: false,
  checkForUpdates: true,
  onboardingCompleted: false,
  installOnboardingCompleted: false,
};

async function applyTheme() {
  // Single-theme build: force dark everywhere, ignore any persisted value.
  document.documentElement.dataset.theme = "dark";
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().setTheme("dark");
  } catch {
    // Not in Tauri environment
  }
}

export const useManagerSettingsStore = defineStore("managerSettings", () => {
  const settings = useLocalStorage<ManagerSettings>(STORAGE_KEY, { ...defaults }, {
    mergeDefaults: true,
    flush: "sync",
  });

  void applyTheme();

  function resetSettings() {
    Object.assign(settings.value, defaults);
  }

  return { settings, resetSettings };
});
