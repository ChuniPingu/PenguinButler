import { pathExists, readTextFile, writeTextFile } from "@/lib/app-fs";
import { joinPath } from "@/lib/paths";

export const UI_SETTINGS_FILE = "ui-settings.json";

export const THEME_SETTINGS = ["light", "dark", "system"] as const;
export type ThemeSetting = (typeof THEME_SETTINGS)[number];

export const LANGUAGE_SETTINGS = ["en", "zh-Hans"] as const;
export type LanguageSetting = (typeof LANGUAGE_SETTINGS)[number];

export interface UiSettings {
  gameDirectory: string;
  theme: ThemeSetting;
  language: LanguageSetting;
}

const DEFAULT_SETTINGS: UiSettings = {
  gameDirectory: "",
  theme: "system",
  language: "en",
};

function parseThemeSetting(value: unknown): ThemeSetting {
  return THEME_SETTINGS.includes(value as ThemeSetting)
    ? (value as ThemeSetting)
    : DEFAULT_SETTINGS.theme;
}

export function parseLanguageSetting(value: unknown): LanguageSetting {
  return LANGUAGE_SETTINGS.includes(value as LanguageSetting)
    ? (value as LanguageSetting)
    : DEFAULT_SETTINGS.language;
}

export function tryParseLanguageSetting(value: unknown): LanguageSetting | null {
  return LANGUAGE_SETTINGS.includes(value as LanguageSetting) ? (value as LanguageSetting) : null;
}

/** Map BCP 47 tags to a supported UI language. Any Chinese tag maps to zh-Hans. */
export function detectSystemLanguage(
  preferredLanguages: readonly string[] = typeof navigator !== "undefined"
    ? navigator.languages?.length
      ? [...navigator.languages]
      : navigator.language
        ? [navigator.language]
        : []
    : [],
): LanguageSetting {
  for (const tag of preferredLanguages) {
    const normalized = tag.toLowerCase().replace(/_/g, "-");
    if (normalized === "zh" || normalized.startsWith("zh-")) {
      return "zh-Hans";
    }
  }
  return "en";
}

export function uiSettingsPath(userDataDir: string) {
  return joinPath(userDataDir, UI_SETTINGS_FILE);
}

/** Returns the language written in ui-settings.json, or null if unset / missing. */
export async function readPersistedLanguage(userDataDir: string): Promise<LanguageSetting | null> {
  const path = uiSettingsPath(userDataDir);
  if (!(await pathExists(path))) return null;
  try {
    const raw = JSON.parse(await readTextFile(path)) as Partial<UiSettings>;
    return tryParseLanguageSetting(raw.language);
  } catch {
    return null;
  }
}

export async function loadUiSettings(userDataDir: string): Promise<UiSettings> {
  const path = uiSettingsPath(userDataDir);
  if (!(await pathExists(path))) return { ...DEFAULT_SETTINGS };
  try {
    const raw = JSON.parse(await readTextFile(path)) as Partial<UiSettings>;
    return {
      gameDirectory: typeof raw.gameDirectory === "string" ? raw.gameDirectory : "",
      theme: parseThemeSetting(raw.theme),
      language: parseLanguageSetting(raw.language),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveUiSettings(
  userDataDir: string,
  patch: Partial<UiSettings>,
): Promise<void> {
  const current = await loadUiSettings(userDataDir);
  await writeTextFile(
    uiSettingsPath(userDataDir),
    `${JSON.stringify({ ...current, ...patch }, null, 2)}\n`,
  );
}
