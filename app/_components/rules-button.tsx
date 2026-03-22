"use client";

import { useEffect, useState } from "react";

type RulesSection = {
  title: string;
  bullets: readonly string[];
};

type RulesButtonProps = {
  label: string;
  sections: readonly RulesSection[];
};

export function RulesButton({ label, sections }: RulesButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex h-9 items-center justify-center rounded-full border border-black/20 px-4 text-sm font-semibold text-stone-700 transition hover:border-black/40 dark:border-white/20 dark:text-stone-300 dark:hover:border-white/40"
      >
        {label}
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4"
          role="presentation"
          onClick={() => setIsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="rules-modal-title"
            className="w-full max-w-2xl rounded-3xl border border-white/15 bg-stone-950 p-4 text-left text-stone-100 shadow-[0_24px_80px_rgba(0,0,0,0.5)] sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="rules-modal-title" className="text-lg font-bold tracking-tight sm:text-xl">
                {label}
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-lg leading-none text-white transition hover:border-white/60"
              >
                ×
              </button>
            </div>

            <dl className="space-y-4 text-sm text-stone-200 sm:text-base">
              {sections.map((section) => (
                <div key={section.title}>
                  <dt className="font-semibold text-stone-100">{section.title}</dt>
                  <dd>
                    <ul className="mt-1 space-y-1 ps-4">
                      {section.bullets.map((bullet, i) => (
                        <li key={i} className="flex gap-2">
                          <span aria-hidden="true" className="shrink-0 select-none text-stone-500">—</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ) : null}
    </>
  );
}
