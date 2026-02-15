/**
 * @module android-dark-mode
 * @description Android dark mode adaptation for OpenClaw mobile clients.
 * Provides theme configuration, dynamic color generation, and system theme detection.
 */

export type ThemeMode = "light" | "dark" | "system";

export interface ThemeColors {
  primary: string;
  primaryVariant: string;
  secondary: string;
  background: string;
  surface: string;
  error: string;
  onPrimary: string;
  onSecondary: string;
  onBackground: string;
  onSurface: string;
  onError: string;
  divider: string;
  shadow: string;
  overlay: string;
}

export interface AndroidThemeConfig {
  mode: ThemeMode;
  lightColors: ThemeColors;
  darkColors: ThemeColors;
  followSystemTheme: boolean;
  transitionDuration: number;
  statusBarStyle: "light" | "dark" | "auto";
  navigationBarColor?: string;
}

const DEFAULT_LIGHT_COLORS: ThemeColors = {
  primary: "#6366F1",
  primaryVariant: "#4F46E5",
  secondary: "#10B981",
  background: "#FFFFFF",
  surface: "#F9FAFB",
  error: "#EF4444",
  onPrimary: "#FFFFFF",
  onSecondary: "#FFFFFF",
  onBackground: "#111827",
  onSurface: "#374151",
  onError: "#FFFFFF",
  divider: "#E5E7EB",
  shadow: "rgba(0, 0, 0, 0.1)",
  overlay: "rgba(0, 0, 0, 0.5)",
};

const DEFAULT_DARK_COLORS: ThemeColors = {
  primary: "#818CF8",
  primaryVariant: "#6366F1",
  secondary: "#34D399",
  background: "#111827",
  surface: "#1F2937",
  error: "#F87171",
  onPrimary: "#FFFFFF",
  onSecondary: "#111827",
  onBackground: "#F9FAFB",
  onSurface: "#D1D5DB",
  onError: "#111827",
  divider: "#374151",
  shadow: "rgba(0, 0, 0, 0.3)",
  overlay: "rgba(0, 0, 0, 0.7)",
};

export class AndroidDarkMode {
  private config: AndroidThemeConfig;
  private currentMode: ThemeMode;

  constructor(config?: Partial<AndroidThemeConfig>) {
    this.config = {
      mode: config?.mode || "system",
      lightColors: { ...DEFAULT_LIGHT_COLORS, ...config?.lightColors },
      darkColors: { ...DEFAULT_DARK_COLORS, ...config?.darkColors },
      followSystemTheme: config?.followSystemTheme ?? true,
      transitionDuration: config?.transitionDuration ?? 300,
      statusBarStyle: config?.statusBarStyle || "auto",
      navigationBarColor: config?.navigationBarColor,
    };
    this.currentMode = this.config.mode;
  }

  getActiveColors(): ThemeColors {
    const isDark = this.isDarkMode();
    return isDark ? this.config.darkColors : this.config.lightColors;
  }

  isDarkMode(): boolean {
    if (this.currentMode === "dark") return true;
    if (this.currentMode === "light") return false;
    // System mode — check system preference
    return this.detectSystemDarkMode();
  }

  setMode(mode: ThemeMode): void {
    this.currentMode = mode;
  }

  getMode(): ThemeMode {
    return this.currentMode;
  }

  generateCSSVariables(): string {
    const colors = this.getActiveColors();
    return Object.entries(colors)
      .map(([key, value]) => `  --oc-${this.camelToKebab(key)}: ${value};`)
      .join("\n");
  }

  generateAndroidXML(): string {
    const colors = this.getActiveColors();
    const entries = Object.entries(colors)
      .map(([key, value]) => `    <color name="oc_${this.camelToSnake(key)}">${value}</color>`)
      .join("\n");

    return `<?xml version="1.0" encoding="utf-8"?>
<resources>
${entries}
</resources>`;
  }

  getStatusBarConfig(): { style: string; backgroundColor: string } {
    const colors = this.getActiveColors();
    return {
      style: this.config.statusBarStyle === "auto"
        ? this.isDarkMode() ? "light" : "dark"
        : this.config.statusBarStyle,
      backgroundColor: colors.background,
    };
  }

  private detectSystemDarkMode(): boolean {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  }

  private camelToKebab(str: string): string {
    return str.replace(/([A-Z])/g, "-$1").toLowerCase();
  }

  private camelToSnake(str: string): string {
    return str.replace(/([A-Z])/g, "_$1").toLowerCase();
  }
}
