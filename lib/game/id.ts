const GAME_ID_PATTERN = /^\d{3}-\d{3}-\d{3}$/;

function hasRepeatedDigits(chunk: string) {
  return chunk[0] === chunk[1] && chunk[1] === chunk[2];
}

function randomChunk() {
  while (true) {
    const chunk = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");

    if (!hasRepeatedDigits(chunk)) {
      return chunk;
    }
  }
}

export function generateGameId() {
  return `${randomChunk()}-${randomChunk()}-${randomChunk()}`;
}

export function isValidGameId(value: string) {
  if (!GAME_ID_PATTERN.test(value)) {
    return false;
  }

  return value.split("-").every((chunk) => !hasRepeatedDigits(chunk));
}

export function normalizeGameId(value: string) {
  return value.trim();
}