"use client";

import { useState } from "react";

const ITEMS = [
  {
    q: "What does Pro unlock?",
    a: "One Pro plan unlocks Hide / Unhide and ATS score results on both Indeed and Seek. Metrics, Copy JD, Save, Kanban, CSV export, and resume upload stay free.",
  },
  {
    q: "Do you store my jobs or resume?",
    a: "Your tracked jobs, board, notes, and uploaded resume stay in your browser. ATS scoring runs on-device when Chrome's built-in AI is available. When it isn't, the extension sends the resume text and job description to us and on to the Google Gemini API for that one score, and we don't keep that text afterwards. See the Privacy Policy for details.",
  },
  {
    q: "How do payments work?",
    a: "Paddle is the merchant of record. You check out in their overlay. We never store card numbers. Cancel or update your card anytime from Manage billing.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. If you cancel at period end you keep Pro until the paid period ends.",
  },
  {
    q: "What is your refund policy?",
    a: "Your first Pro payment has a 30-day money-back guarantee. Later renewals are reviewed case by case. Paddle is the merchant of record and processes refunds. Email support or use paddle.net.",
  },
];

export function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-[var(--line)] px-5 md:px-6">
      {ITEMS.map((item, index) => {
        const expanded = open === index;
        return (
          <button
            key={item.q}
            type="button"
            className="group flex w-full items-start justify-between gap-6 py-5 text-left"
            onClick={() => setOpen(expanded ? null : index)}
            aria-expanded={expanded}
          >
            <span className="min-w-0 flex-1">
              <span className="block font-medium transition-colors duration-200 group-hover:text-neutral-600">
                {item.q}
              </span>
              <span className={`faq-answer ${expanded ? "open" : ""}`}>
                <span className="block overflow-hidden">
                  <span className="mt-2 block text-sm text-[var(--muted)]">{item.a}</span>
                </span>
              </span>
            </span>
            <span
              className={`faq-icon text-xl text-neutral-400 transition-colors duration-200 group-hover:text-neutral-600 ${expanded ? "open" : ""}`}
            >
              +
            </span>
          </button>
        );
      })}
    </div>
  );
}
