"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";

import {
  DEFAULT_LANGUAGE,
  LANGUAGE_DISPLAY_NAMES,
  SUPPORTED_LANGUAGES,
  normalizeLangParam,
  resolveLanguageFromLocaleTag,
  type SupportedLanguage,
} from "@/lib/i18n";

const LANGUAGE_STORAGE_KEY = "small-farmland-language";
const LANGUAGE_MANUAL_KEY = "small-farmland-language-manual";

type LanguageSelectProps = {
  currentLanguage: SupportedLanguage;
};

export function LanguageSelect({ currentLanguage }: LanguageSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sortedLanguages = useMemo(
    () =>
      [...SUPPORTED_LANGUAGES].sort((left, right) =>
        LANGUAGE_DISPLAY_NAMES[left].localeCompare(LANGUAGE_DISPLAY_NAMES[right]),
      ),
    [],
  );

  useEffect(() => {
    const rawLang = normalizeLangParam(searchParams.get("lang"));
    const manual = window.localStorage.getItem(LANGUAGE_MANUAL_KEY) === "1";
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);

    let nextLanguage: SupportedLanguage | undefined;

    if (manual) {
      nextLanguage = resolveLanguageFromLocaleTag(storedLanguage);
    } else {
      if (rawLang) {
        return;
      }

      const browserCandidates = [
        ...(window.navigator.languages ?? []),
        window.navigator.language,
      ];

      for (const candidate of browserCandidates) {
        const resolved = resolveLanguageFromLocaleTag(candidate);

        if (resolved) {
          nextLanguage = resolved;
          break;
        }
      }
    }

    if (!nextLanguage || nextLanguage === currentLanguage) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());

    if (nextLanguage === DEFAULT_LANGUAGE) {
      params.delete("lang");
    } else {
      params.set("lang", nextLanguage);
    }

    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname);
  }, [currentLanguage, pathname, router, searchParams]);

  function handleLanguageChange(nextLanguage: SupportedLanguage) {
    const params = new URLSearchParams(searchParams.toString());

    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    window.localStorage.setItem(LANGUAGE_MANUAL_KEY, "1");

    if (nextLanguage === DEFAULT_LANGUAGE) {
      params.delete("lang");
    } else {
      params.set("lang", nextLanguage);
    }

    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname);
  }

  return (
    <label className="inline-flex items-center gap-2 text-sm font-medium text-stone-800 dark:text-stone-200">
      <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded-full border border-stone-300 dark:border-stone-600">
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a14 14 0 0 1 0 18" />
          <path d="M12 3a14 14 0 0 0 0 18" />
        </svg>
      </span>
      <select
        aria-label="Language"
        value={currentLanguage}
        onChange={(event) => handleLanguageChange(event.target.value as SupportedLanguage)}
        className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
      >
        {sortedLanguages.map((language) => (
          <option key={language} value={language}>
            {LANGUAGE_DISPLAY_NAMES[language]}
          </option>
        ))}
      </select>
    </label>
  );
}
