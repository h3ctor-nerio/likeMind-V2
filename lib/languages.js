// Languages LikeMinds can show its interface in. `name` matches what profiles store.
// ASL is a profile language (for events) but not a written interface language.
export const UI_LANGUAGES = [
  { name: "english", code: "en", label: "English" },
  { name: "spanish", code: "es", label: "Español" },
  { name: "chinese", code: "zh", label: "中文" },
  { name: "vietnamese", code: "vi", label: "Tiếng Việt" },
  { name: "tagalog", code: "tl", label: "Tagalog" },
  { name: "arabic", code: "ar", label: "العربية", rtl: true },
  { name: "french", code: "fr", label: "Français" },
  { name: "haitian creole", code: "ht", label: "Kreyòl ayisyen" },
  { name: "korean", code: "ko", label: "한국어" },
  { name: "russian", code: "ru", label: "Русский" },
  { name: "portuguese", code: "pt", label: "Português" },
  { name: "hindi", code: "hi", label: "हिन्दी" },
];

export const ENGLISH_NAMES = {
  en: "English", es: "Spanish", zh: "Simplified Chinese", vi: "Vietnamese", tl: "Tagalog", ar: "Arabic",
  fr: "French", ht: "Haitian Creole", ko: "Korean", ru: "Russian", pt: "Brazilian Portuguese", hi: "Hindi",
};

export const byCode = (code) => UI_LANGUAGES.find((l) => l.code === code) || null;
export const byName = (name) => UI_LANGUAGES.find((l) => l.name === String(name || "").toLowerCase()) || null;

/** The interface languages a person can choose from, in the order they listed them. */
export function uiOptions(profileLanguages = []) {
  const out = [];
  for (const n of profileLanguages) {
    const l = byName(n);
    if (l && !out.includes(l)) out.push(l);
  }
  return out;
}
