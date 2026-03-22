import type { NextRequest } from "next/server";

import { isValidGameId, normalizeGameId } from "@/lib/game/id";
import { toGameSnapshot } from "@/lib/game/snapshot";
import { findGameById, watchGameById } from "@/lib/games";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const STREAM_LIFETIME_MS = 270_000;
const HEARTBEAT_INTERVAL_MS = 15_000;

function jsonNoStore(body: unknown, init?: ResponseInit) {
  return Response.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init?.headers ?? {}),
    },
  });
}

function encodeSseData(encoder: TextEncoder, data: string) {
  const lines = data.split("\n").map((line) => `data: ${line}`).join("\n");
  return encoder.encode(`${lines}\n\n`);
}

function encodeSseComment(encoder: TextEncoder, comment: string) {
  return encoder.encode(`: ${comment}\n\n`);
}

function validateGameId(rawGameId: string) {
  const gameId = normalizeGameId(rawGameId);

  if (!isValidGameId(gameId)) {
    return {
      gameId: null,
      response: jsonNoStore({ error: "Invalid game ID." }, { status: 400 }),
    };
  }

  return { gameId, response: null };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ gameId: string }> },
) {
  const { gameId: rawGameId } = await context.params;
  const { gameId, response } = validateGameId(rawGameId);

  if (response) {
    return response;
  }

  const game = await findGameById(gameId!);

  if (!game) {
    return jsonNoStore({ errorCode: "errors.gameNotFound" }, { status: 404 });
  }

  const initialSnapshot = toGameSnapshot(game);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      let lifetime: ReturnType<typeof setTimeout> | undefined;

      const send = (chunk: Uint8Array) => {
        if (closed) {
          return;
        }

        controller.enqueue(chunk);
      };

      const close = () => {
        if (closed) {
          return;
        }

        closed = true;

        if (heartbeat) {
          clearInterval(heartbeat);
        }

        if (lifetime) {
          clearTimeout(lifetime);
        }

        controller.close();
      };

      const abortHandler = () => {
        close();
      };

      request.signal.addEventListener("abort", abortHandler, { once: true });

      send(encoder.encode("retry: 2000\n\n"));
      send(encodeSseData(encoder, JSON.stringify({ snapshot: initialSnapshot })));

      heartbeat = setInterval(() => {
        send(encodeSseComment(encoder, "keep-alive"));
      }, HEARTBEAT_INTERVAL_MS);

      lifetime = setTimeout(() => {
        close();
      }, STREAM_LIFETIME_MS);

      void (async () => {
        let changeStream: Awaited<ReturnType<typeof watchGameById>> | null = null;

        try {
          changeStream = await watchGameById(gameId!);

          for await (const change of changeStream) {
            if (closed || request.signal.aborted) {
              break;
            }

            if (!("fullDocument" in change) || !change.fullDocument) {
              continue;
            }

            send(encodeSseData(encoder, JSON.stringify({ snapshot: toGameSnapshot(change.fullDocument) })));
          }
        } catch (error) {
          if (!request.signal.aborted) {
            console.error("Game stream failed", { gameId, error });
          }
        } finally {
          request.signal.removeEventListener("abort", abortHandler);
          await changeStream?.close().catch(() => undefined);
          close();
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}