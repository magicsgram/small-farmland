import { notFound, redirect } from "next/navigation";

import { GameRoom } from "@/app/game/[gameId]/game-room";
import { isValidGameId, normalizeGameId } from "@/lib/game/id";
import {
  DEFAULT_LANGUAGE,
  getLocaleMessages,
  normalizeLangParam,
  resolveLanguage,
} from "@/lib/i18n";
import { toGameSnapshot } from "@/lib/game/snapshot";
import { findGameById } from "@/lib/games";

export const dynamic = "force-dynamic";

type GamePageProps = {
  params: Promise<{
    gameId: string;
  }>;
  searchParams: Promise<{
    lang?: string | string[];
  }>;
};

export default async function GamePage({ params, searchParams }: GamePageProps) {
  const { gameId: rawGameId } = await params;
  const resolvedSearchParams = await searchParams;
  const gameId = normalizeGameId(rawGameId);
  const rawLang = normalizeLangParam(resolvedSearchParams.lang);
  const language = resolveLanguage(resolvedSearchParams.lang);
  const messages = getLocaleMessages(language);

  if (rawLang && language === DEFAULT_LANGUAGE) {
    redirect(`/game/${gameId}`);
  }

  if (!isValidGameId(gameId)) {
    notFound();
  }

  const game = await findGameById(gameId);

  if (!game) {
    notFound();
  }

  return (
    <GameRoom
      initialSnapshot={toGameSnapshot(game)}
      gameUrl={`/game/${gameId}`}
      language={language}
      messages={messages}
    />
  );
}