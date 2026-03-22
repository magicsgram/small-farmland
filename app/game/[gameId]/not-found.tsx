"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AutoFitText } from "@/app/_components/auto-fit-text";
import { LanguageSelect } from "@/app/_components/language-select";
import {
  DEFAULT_LANGUAGE,
  getLocaleMessages,
  normalizeLangParam,
  resolveLanguage,
  resolveLanguageFromLocaleTag,
  shouldIncludeLangInUrl,
  type SupportedLanguage,
} from "@/lib/i18n";

const LANGUAGE_STORAGE_KEY = "small-farmland-language";
const LANGUAGE_MANUAL_KEY = "small-farmland-language-manual";

export default function GameNotFound() {
  const searchParams = useSearchParams();
  const rawLang = normalizeLangParam(searchParams.get("lang"));
  const languageFromParam = resolveLanguageFromLocaleTag(rawLang);
  const [language, setLanguage] = useState<SupportedLanguage>(DEFAULT_LANGUAGE);

  useEffect(() => {
    if (languageFromParam) {
      setLanguage(languageFromParam);
      return;
    }

    const manual = window.localStorage.getItem(LANGUAGE_MANUAL_KEY) === "1";

    if (!manual) {
      setLanguage(DEFAULT_LANGUAGE);
      return;
    }

    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    const resolvedStoredLanguage = resolveLanguageFromLocaleTag(storedLanguage);

    setLanguage(resolvedStoredLanguage ?? resolveLanguage(rawLang));
  }, [languageFromParam, rawLang]);

  const messages = useMemo(() => getLocaleMessages(language), [language]);
  const homeHref = shouldIncludeLangInUrl(language) ? `/?lang=${language}` : "/";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#f3f1db_0%,#e7efe2_32%,#d4e0d8_60%,#f8f7f1_100%)] px-6 py-12 dark:bg-[radial-gradient(circle_at_top,#1b1f1b_0%,#101412_48%,#080909_100%)]">
      <section className="flex w-full max-w-3xl min-w-0 flex-col items-center gap-8 text-center">
        <LanguageSelect currentLanguage={language} />

        <AutoFitText
          maxPx={128}
          minPx={24}
          className="font-black tracking-tight drop-shadow-[0_3px_10px_rgba(0,0,0,0.35)]"
        >
          <span className="text-sky-300">{messages["app.title.small"]}</span>{" "}
          <span className="text-orange-300">{messages["app.title.farmland"]}</span>
        </AutoFitText>

        <p className="text-2xl font-semibold tracking-tight text-stone-950 dark:text-stone-50">
          {messages["errors.gameNotFound"]}
        </p>

        <Link
          href={homeHref}
          className="inline-flex h-14 items-center justify-center rounded-full bg-[var(--accent)] px-6 text-base font-semibold text-[var(--accent-foreground)] transition hover:translate-y-[-1px] hover:shadow-[0_18px_40px_rgba(27,88,62,0.2)]"
        >
          {messages["landing.backHome"]}
        </Link>
      </section>
    </main>
  );
}