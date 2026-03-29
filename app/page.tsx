import { CreateGameButton } from "@/app/_components/create-game-button";
import { RulesButton } from "@/app/_components/rules-button";
import { AutoFitText } from "@/app/_components/auto-fit-text";
import { LanguageSelect } from "@/app/_components/language-select";
import {
  DEFAULT_LANGUAGE,
  getLocaleMessages,
  normalizeLangParam,
  resolveLanguage,
} from "@/lib/i18n";
import { getRuleSections } from "@/lib/ui/rules";
import { redirect } from "next/navigation";

type HomePageProps = {
  searchParams: Promise<{
    lang?: string | string[];
  }>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const resolvedSearchParams = await searchParams;
  const rawLang = normalizeLangParam(resolvedSearchParams.lang);
  const language = resolveLanguage(resolvedSearchParams.lang);
  const messages = getLocaleMessages(language);
  const ruleSections = getRuleSections(messages);

  if (rawLang && language === DEFAULT_LANGUAGE) {
    redirect("/");
  }

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

        <CreateGameButton
          language={language}
          createLabel={messages["landing.createGame"]}
          creatingLabel={messages["landing.creatingGame"]}
        />

        <RulesButton label={messages["landing.rules.title"]} sections={ruleSections} />

        <a
          href="https://github.com/magicsgram/small-farmland"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-16 inline-flex items-center gap-2 rounded-full bg-black/80 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black dark:bg-white/15 dark:hover:bg-white/25"
        >
          <svg
            viewBox="0 0 16 16"
            fill="currentColor"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
          </svg>
          GitHub
        </a>
      </section>
    </main>
  );
}
