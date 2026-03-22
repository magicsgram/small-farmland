import arSa from "@/locales/ar-sa.json";
import enUs from "@/locales/en-us.json";
import esEs from "@/locales/es-es.json";
import frFr from "@/locales/fr-fr.json";
import deDe from "@/locales/de-de.json";
import hiIn from "@/locales/hi-in.json";
import itIt from "@/locales/it-it.json";
import jaJp from "@/locales/ja-jp.json";
import koKr from "@/locales/ko-kr.json";
import nlNl from "@/locales/nl-nl.json";
import plPl from "@/locales/pl-pl.json";
import ptBr from "@/locales/pt-br.json";
import ruRu from "@/locales/ru-ru.json";
import taIn from "@/locales/ta-in.json";
import thTh from "@/locales/th-th.json";
import trTr from "@/locales/tr-tr.json";
import viVn from "@/locales/vi-vn.json";
import zhCn from "@/locales/zh-cn.json";
import zhTw from "@/locales/zh-tw.json";

export const DEFAULT_LANGUAGE = "en-us" as const;

export const SUPPORTED_LANGUAGES = [
  DEFAULT_LANGUAGE,
  "ar-sa",
  "ko-kr",
  "ja-jp",
  "zh-cn",
  "zh-tw",
  "es-es",
  "de-de",
  "fr-fr",
  "hi-in",
  "it-it",
  "nl-nl",
  "pt-br",
  "ru-ru",
  "ta-in",
  "th-th",
  "tr-tr",
  "pl-pl",
  "vi-vn",
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export type LocaleMessages = typeof enUs;

const LOCALE_MESSAGES: Record<SupportedLanguage, LocaleMessages> = {
  "ar-sa": arSa,
  "en-us": enUs,
  "es-es": esEs,
  "fr-fr": frFr,
  "de-de": deDe,
  "hi-in": hiIn,
  "it-it": itIt,
  "ja-jp": jaJp,
  "ko-kr": koKr,
  "nl-nl": nlNl,
  "pl-pl": plPl,
  "pt-br": ptBr,
  "ru-ru": ruRu,
  "ta-in": taIn,
  "th-th": thTh,
  "tr-tr": trTr,
  "vi-vn": viVn,
  "zh-cn": zhCn,
  "zh-tw": zhTw,
};

export const LANGUAGE_DISPLAY_NAMES: Record<SupportedLanguage, string> = {
  "ar-sa": LOCALE_MESSAGES["ar-sa"]["meta.displayName"],
  "en-us": LOCALE_MESSAGES["en-us"]["meta.displayName"],
  "es-es": LOCALE_MESSAGES["es-es"]["meta.displayName"],
  "fr-fr": LOCALE_MESSAGES["fr-fr"]["meta.displayName"],
  "de-de": LOCALE_MESSAGES["de-de"]["meta.displayName"],
  "hi-in": LOCALE_MESSAGES["hi-in"]["meta.displayName"],
  "it-it": LOCALE_MESSAGES["it-it"]["meta.displayName"],
  "ja-jp": LOCALE_MESSAGES["ja-jp"]["meta.displayName"],
  "ko-kr": LOCALE_MESSAGES["ko-kr"]["meta.displayName"],
  "nl-nl": LOCALE_MESSAGES["nl-nl"]["meta.displayName"],
  "pl-pl": LOCALE_MESSAGES["pl-pl"]["meta.displayName"],
  "pt-br": LOCALE_MESSAGES["pt-br"]["meta.displayName"],
  "ru-ru": LOCALE_MESSAGES["ru-ru"]["meta.displayName"],
  "ta-in": LOCALE_MESSAGES["ta-in"]["meta.displayName"],
  "th-th": LOCALE_MESSAGES["th-th"]["meta.displayName"],
  "tr-tr": LOCALE_MESSAGES["tr-tr"]["meta.displayName"],
  "vi-vn": LOCALE_MESSAGES["vi-vn"]["meta.displayName"],
  "zh-cn": LOCALE_MESSAGES["zh-cn"]["meta.displayName"],
  "zh-tw": LOCALE_MESSAGES["zh-tw"]["meta.displayName"],
};

export function normalizeLangParam(
  value: string | string[] | null | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0]?.toLowerCase();
  }

  if (typeof value === "string") {
    return value.toLowerCase();
  }

  return undefined;
}

export function resolveLanguage(
  value: string | string[] | null | undefined,
): SupportedLanguage {
  const normalized = normalizeLangParam(value);
  const resolved = resolveLanguageFromLocaleTag(normalized);

  if (resolved) {
    return resolved;
  }

  return DEFAULT_LANGUAGE;
}

const LANGUAGE_PREFIX_FALLBACK: Record<string, SupportedLanguage> = {
  ar: "ar-sa",
  de: "de-de",
  en: "en-us",
  es: "es-es",
  fr: "fr-fr",
  it: "it-it",
  ja: "ja-jp",
  ko: "ko-kr",
  pl: "pl-pl",
  pt: "pt-br",
  ru: "ru-ru",
  tr: "tr-tr",
  zh: "zh-cn",
};

export function resolveLanguageFromLocaleTag(
  value: string | null | undefined,
): SupportedLanguage | undefined {
  const normalized = value?.toLowerCase();

  if (!normalized) {
    return undefined;
  }

  if (SUPPORTED_LANGUAGES.includes(normalized as SupportedLanguage)) {
    return normalized as SupportedLanguage;
  }

  // Prefer Traditional Chinese for script/region hints typically associated with Hant.
  if (
    normalized.includes("hant") ||
    normalized.startsWith("zh-tw") ||
    normalized.startsWith("zh-hk") ||
    normalized.startsWith("zh-mo")
  ) {
    return "zh-tw";
  }

  const [prefix] = normalized.split("-");
  return LANGUAGE_PREFIX_FALLBACK[prefix];
}

export function shouldIncludeLangInUrl(language: SupportedLanguage) {
  return language !== DEFAULT_LANGUAGE;
}

export function getLocaleMessages(language: SupportedLanguage): LocaleMessages {
  return LOCALE_MESSAGES[language] ?? LOCALE_MESSAGES[DEFAULT_LANGUAGE];
}
