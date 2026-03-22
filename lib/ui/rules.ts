import type { LocaleMessages } from "@/lib/i18n";

/**
 * Builds rule sections for display in UI.
 * Used in home page and game room rule modals.
 */
export function getRuleSections(messages: LocaleMessages) {
  return [
    {
      title: messages["landing.rules.setup.title"],
      bullets: [messages["landing.rules.setup.1"], messages["landing.rules.setup.2"]],
    },
    {
      title: messages["landing.rules.turns.title"],
      bullets: [messages["landing.rules.turns.1"], messages["landing.rules.turns.2"], messages["landing.rules.turns.3"]],
    },
    {
      title: messages["landing.rules.capture.title"],
      bullets: [messages["landing.rules.capture.1"], messages["landing.rules.capture.2"]],
    },
    {
      title: messages["landing.rules.end.title"],
      bullets: [messages["landing.rules.end.1"], messages["landing.rules.end.2"]],
    },
  ] as const;
}
