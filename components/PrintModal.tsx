"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Printer, Eye, EyeOff } from "lucide-react";
import type { Agent, Conversation } from "@/lib/types";
import { Markdown } from "./Markdown";

const ANSWER_DIVIDERS = [
  "--- [ANSWER KEY] ---",
  "--- ANSWER KEY ---",
  "---ANSWER KEY---",
];

const ANSWER_HEADING =
  /^#{1,4}\s*\**\s*(answer key|answers|solutions?|marking scheme)\b.*$/im;

/** Split a message into the main part and the answer/solution part. */
function splitAnswers(content: string): { main: string; answers: string } {
  for (const divider of ANSWER_DIVIDERS) {
    const idx = content.indexOf(divider);
    if (idx >= 0) {
      return {
        main: content.slice(0, idx).trim(),
        answers: content.slice(idx + divider.length).trim(),
      };
    }
  }
  const m = ANSWER_HEADING.exec(content);
  if (m && m.index > 0) {
    return {
      main: content.slice(0, m.index).trim(),
      answers: content.slice(m.index).trim(),
    };
  }
  return { main: content, answers: "" };
}

function PrintSheet({
  convo,
  agent,
  showAnswers,
}: {
  convo: Conversation;
  agent?: Agent;
  showAnswers: boolean;
}) {
  const messages = convo.messages.filter((m) => m.content.trim());
  const dateStr = new Date(convo.updatedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="print-sheet">
      <div
        style={{
          borderBottom: "2px solid #000",
          paddingBottom: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 700 }}>
          {convo.title || "Chat export"}
        </div>
        <div style={{ fontSize: 12, color: "#333", marginTop: 4 }}>
          {agent ? `${agent.name} · ` : ""}
          {dateStr} · pRash AI
        </div>
        <div
          style={{
            display: "flex",
            gap: 32,
            fontSize: 12,
            marginTop: 12,
            fontWeight: 600,
          }}
        >
          <span>
            Name:{" "}
            <span
              style={{
                display: "inline-block",
                borderBottom: "1px dotted #000",
                width: 220,
              }}
            />
          </span>
          <span>
            Date:{" "}
            <span
              style={{
                display: "inline-block",
                borderBottom: "1px dotted #000",
                width: 120,
              }}
            />
          </span>
          <span>
            Score:{" "}
            <span
              style={{
                display: "inline-block",
                borderBottom: "1px dotted #000",
                width: 70,
              }}
            />
          </span>
        </div>
      </div>

      {messages.map((m) => {
        const { main, answers } =
          m.role === "assistant"
            ? splitAnswers(m.content)
            : { main: m.content, answers: "" };
        return (
          <div key={m.id} style={{ marginBottom: 18 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                color: "#555",
                marginBottom: 4,
              }}
            >
              {m.role === "user" ? "You" : (agent?.name ?? "Assistant")}
            </div>
            <Markdown content={main} />
            {answers && showAnswers && (
              <div className="print-page-break">
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    borderBottom: "1px solid #000",
                    paddingBottom: 6,
                    marginBottom: 10,
                  }}
                >
                  Answer Key
                </div>
                <Markdown content={answers} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PrintModal({
  convo,
  agent,
  onClose,
}: {
  convo: Conversation;
  agent?: Agent;
  onClose: () => void;
}) {
  const hasAnswers = useMemo(
    () =>
      convo.messages.some(
        (m) => m.role === "assistant" && splitAnswers(m.content).answers,
      ),
    [convo],
  );
  const [showAnswers, setShowAnswers] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const handlePrint = () => {
    document.body.classList.add("printing");
    const cleanup = () => document.body.classList.remove("printing");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    // Fallback cleanup for browsers that don't fire afterprint reliably.
    setTimeout(cleanup, 2000);
  };

  return (
    <>
      {/* Modal preview (screen only) */}
      <div className="no-print fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
        <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-soft)] shadow-2xl">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-5 py-3.5">
            <div>
              <div className="text-sm font-semibold">Print / save as PDF</div>
              <div className="text-xs text-[var(--faint)]">
                Clean A4 layout — answers {showAnswers ? "included" : "hidden"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasAnswers && (
                <button
                  type="button"
                  onClick={() => setShowAnswers((v) => !v)}
                  className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-xs text-[var(--text-2)] hover:bg-[var(--panel-2)]"
                >
                  {showAnswers ? <EyeOff size={13} /> : <Eye size={13} />}
                  {showAnswers ? "Hide answers" : "Show answers"}
                </button>
              )}
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-400"
              >
                <Printer size={14} /> Print
              </button>
              <button
                type="button"
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Paper-like preview */}
          <div className="flex-1 overflow-y-auto bg-[var(--bg)] p-4 sm:p-6">
            <div className="mx-auto max-w-[210mm] rounded-sm bg-white p-8 text-black shadow-xl sm:p-10">
              <PreviewBody convo={convo} agent={agent} showAnswers={showAnswers} />
            </div>
          </div>
        </div>
      </div>

      {/* Actual print sheet, only visible to the printer */}
      {mounted &&
        createPortal(
          <PrintSheet convo={convo} agent={agent} showAnswers={showAnswers} />,
          document.body,
        )}
    </>
  );
}

/** Screen preview mirrors the print sheet but with inline styles only. */
function PreviewBody({
  convo,
  agent,
  showAnswers,
}: {
  convo: Conversation;
  agent?: Agent;
  showAnswers: boolean;
}) {
  const messages = convo.messages.filter((m) => m.content.trim());
  return (
    <div className="text-black [&_.md]:text-black">
      <div className="border-b-2 border-black pb-3 mb-4">
        <div className="text-xl font-bold">{convo.title || "Chat export"}</div>
        <div className="mt-1 text-xs text-neutral-600">
          {agent ? `${agent.name} · ` : ""}
          {new Date(convo.updatedAt).toLocaleDateString()} · pRash AI
        </div>
        <div className="mt-3 flex gap-8 text-xs font-semibold">
          <span>
            Name:{" "}
            <span className="inline-block w-48 border-b border-dotted border-black" />
          </span>
          <span>
            Date:{" "}
            <span className="inline-block w-28 border-b border-dotted border-black" />
          </span>
          <span>
            Score:{" "}
            <span className="inline-block w-16 border-b border-dotted border-black" />
          </span>
        </div>
      </div>
      {messages.map((m) => {
        const { main, answers } =
          m.role === "assistant"
            ? splitAnswers(m.content)
            : { main: m.content, answers: "" };
        return (
          <div key={m.id} className="mb-5">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-neutral-500">
              {m.role === "user" ? "You" : (agent?.name ?? "Assistant")}
            </div>
            <Markdown content={main} />
            {answers && showAnswers && (
              <div className="mt-4 border-t border-black pt-3">
                <div className="mb-2 text-sm font-bold">Answer Key</div>
                <Markdown content={answers} />
              </div>
            )}
          </div>
        );
      })}
      {!messages.length && (
        <p className="text-sm text-neutral-500">This chat has no messages yet.</p>
      )}
    </div>
  );
}
