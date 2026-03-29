"use client";

import { useTransition } from "react";

import { shouldIncludeLangInUrl, type SupportedLanguage } from "@/lib/i18n";

type CreateGameButtonProps = {
  language: SupportedLanguage;
  createLabel: string;
  creatingLabel: string;
};

export function CreateGameButton({
  language,
  createLabel,
  creatingLabel,
}: CreateGameButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleCreateGame() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/games", {
          method: "POST",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { gameId: string };
        const gameUrl = shouldIncludeLangInUrl(language)
          ? `/game/${data.gameId}?lang=${language}`
          : `/game/${data.gameId}`;
        window.location.assign(gameUrl);
      } catch {
        // silently ignore
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleCreateGame}
      disabled={isPending}
      className="inline-flex h-14 w-full max-w-sm items-center justify-center rounded-full bg-[var(--accent)] px-6 text-base font-semibold text-[var(--accent-foreground)] transition hover:translate-y-[-1px] hover:shadow-[0_18px_40px_rgba(27,88,62,0.2)] disabled:cursor-wait disabled:opacity-70"
    >
      {isPending ? creatingLabel : createLabel}
    </button>
  );
}