import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

const setTheme = vi.fn();
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ setTheme }),
}));

import { useManagerSettingsStore } from "./managerSettings";

const STORAGE_KEY = "boinc-manager-settings";

describe("useManagerSettingsStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    setTheme.mockClear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("loads defaults when localStorage is empty", () => {
    const store = useManagerSettingsStore();
    expect(store.settings.language).toBe("zh_CN");
    expect(store.settings.theme).toBe("dark");
    expect(store.settings.showExitConfirmation).toBe(true);
    expect(store.settings.checkForUpdates).toBe(true);
    expect(store.settings.onboardingCompleted).toBe(false);
    expect(store.settings.installOnboardingCompleted).toBe(false);
  });

  it("loads saved settings from localStorage", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ language: "ru" }));
    const store = useManagerSettingsStore();
    expect(store.settings.language).toBe("ru");
    expect(store.settings.showExitConfirmation).toBe(true);
  });

  it("handles corrupt localStorage gracefully", () => {
    localStorage.setItem(STORAGE_KEY, "not-json{{{");
    const store = useManagerSettingsStore();
    expect(store.settings.language).toBe("zh_CN");
  });

  it("resetSettings restores defaults", () => {
    const store = useManagerSettingsStore();
    store.settings.language = "de";
    store.resetSettings();
    expect(store.settings.language).toBe("zh_CN");
  });

  it("always enforces dark theme regardless of stored value", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: "light" }));
    useManagerSettingsStore();
    expect(document.documentElement.dataset.theme).toBe("dark");
    await vi.waitFor(() => {
      expect(setTheme).toHaveBeenCalledWith("dark");
    });
  });
});
