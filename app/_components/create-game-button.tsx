"use client";

import { useState, useTransition } from "react";

import { shouldIncludeLangInUrl, type SupportedLanguage } from "@/lib/i18n";

type CreateGameButtonProps = {
  language: SupportedLanguage;
  createLabel: string;
  creatingLabel: string;
  createErrorLabel: string;
};

export function CreateGameButton({
  language,
  createLabel,
  creatingLabel,
  createErrorLabel,
}: CreateGameButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCreateGame() {
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/games", {
          method: "POST",
        });

        if (!response.ok) {
          throw new Error(createErrorLabel);
        }

        const data = (await response.json()) as { gameId: string };
        const gameUrl = shouldIncludeLangInUrl(language)
          ? `/game/${data.gameId}?lang=${language}`
          : `/game/${data.gameId}`;
        window.location.assign(gameUrl);
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : createErrorLabel;
        setError(message);
      }
    });
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <button
        type="button"
        onClick={handleCreateGame}
        disabled={isPending}
        className="inline-flex h-14 items-center justify-center rounded-full bg-[var(--accent)] px-6 text-base font-semibold text-[var(--accent-foreground)] transition hover:translate-y-[-1px] hover:shadow-[0_18px_40px_rgba(27,88,62,0.2)] disabled:cursor-wait disabled:opacity-70"
      >
        {isPending ? creatingLabel : createLabel}
      </button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}