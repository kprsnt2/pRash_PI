"use client";

import { useState } from "react";
import {
  Check,
  Copy,
  FileText,
  File as FileIcon,
  RefreshCw,
  User as UserIcon,
  AlertTriangle,
  Volume2,
  Square,
  Zap,
} from "lucide-react";
import type { Agent, ChatMessage } from "@/lib/types";
import { Markdown } from "./Markdown";
import { humanSize } from "@/lib/files";

function UserAttachments({ msg }: { msg: ChatMessage }) {
  if (!msg.attachments?.length) return null;
  return (
    <div className="mb-2 flex flex-wrap justify-end gap-2">
      {msg.attachments.map((a) => (
        <div
          key={a.id}
          className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-raise)]"
        >
          {a.kind === "image" && a.dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={a.dataUrl}
              alt={a.name}
              className="max-h-48 max-w-[16rem] object-contain"
            />
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-2)]">
              {a.kind === "pdf" ? <FileText size={14} /> : <FileIcon size={14} />}
              <span className="max-w-[12rem] truncate">{a.name}</span>
              <span className="text-[var(--faint)]">{humanSize(a.size)}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function MessageBubble({
  msg,
  agent,
  modelLabel,
  streaming,
  onRegenerate,
  speaking,
  onToggleSpeak,
  speechSupported,
}: {
  msg: ChatMessage;
  agent: Agent;
  modelLabel?: string;
  streaming?: boolean;
  onRegenerate?: () => void;
  speaking?: boolean;
  onToggleSpeak?: () => void;
  speechSupported?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === "user";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  if (isUser) {
    return (
      <div className="fade-up flex justify-end gap-3">
        <div className="max-w-[85%]">
          <UserAttachments msg={msg} />
          <div className="whitespace-pre-wrap rounded-2xl rounded-br-md bg-indigo-500/90 px-4 py-2.5 text-[0.95rem] leading-relaxed text-white shadow-lg shadow-indigo-950/30">
            {msg.content}
          </div>
        </div>
        <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--border)] text-[var(--muted)]">
          <UserIcon size={14} />
        </div>
      </div>
    );
  }

  return (
    <div className="fade-up flex gap-3">
      <div
        className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm"
        style={{ background: `${agent.color}22` }}
      >
        {agent.emoji}
      </div>
      <div className="min-w-0 max-w-[90%] flex-1">
        <div
          className={`rounded-2xl rounded-bl-md border px-4 py-3 ${
            msg.error
              ? "border-rose-500/40 bg-rose-500/10"
              : "border-[var(--border)] bg-[var(--panel)]"
          }`}
        >
          {msg.error && (
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-rose-300">
              <AlertTriangle size={13} /> Error
            </div>
          )}
          {msg.content ? (
            <div className={streaming && !msg.content ? "" : ""}>
              <Markdown content={msg.content} />
              {streaming && <span className="cursor-blink" />}
            </div>
          ) : streaming ? (
            <span className="cursor-blink text-[var(--muted)]" />
          ) : null}
        </div>
        {msg.stats?.fallbackFrom && !streaming && (
          <div className="mt-1.5 flex items-start gap-1.5 px-1 text-[11px] text-amber-500/90 no-print">
            <Zap size={11} className="mt-0.5 shrink-0" />
            <span>
              Auto-routed to{" "}
              <span className="font-medium">
                {msg.stats.modelLabel ?? msg.stats.modelId}
              </span>
              {msg.stats.fallbackReason
                ? ` — ${msg.stats.fallbackReason}`
                : ` after ${msg.stats.fallbackFrom} was unavailable`}
              .
            </span>
          </div>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-[var(--faint)] no-print">
          <span className="font-medium text-[var(--muted)]">{agent.name}</span>
          {modelLabel && <span>{modelLabel}</span>}
          {!streaming && msg.stats?.elapsedMs != null && (
            <span>{(msg.stats.elapsedMs / 1000).toFixed(1)}s</span>
          )}
          {!streaming &&
            (msg.stats?.completionTokens != null || msg.content) && (
              <span title="Tokens: prompt → reply (estimated when the provider does not report usage)">
                {msg.stats?.promptTokens != null
                  ? `${msg.stats.promptTokens} → `
                  : ""}
                {msg.stats?.completionTokens != null
                  ? `${msg.stats.completionTokens} tok`
                  : `~${Math.max(1, Math.round(msg.content.length / 4))} tok`}
              </span>
            )}
          {msg.content && !streaming && (
            <>
              {speechSupported && onToggleSpeak && (
                <button
                  type="button"
                  onClick={onToggleSpeak}
                  className={`flex items-center gap-1 hover:text-[var(--text)] ${
                    speaking ? "text-indigo-300" : ""
                  }`}
                >
                  {speaking ? <Square size={11} /> : <Volume2 size={11} />}
                  {speaking ? "Stop" : "Listen"}
                </button>
              )}
              <button
                type="button"
                onClick={copy}
                className="flex items-center gap-1 hover:text-[var(--text)]"
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {copied ? "Copied" : "Copy"}
              </button>
              {onRegenerate && (
                <button
                  type="button"
                  onClick={onRegenerate}
                  className="flex items-center gap-1 hover:text-[var(--text)]"
                >
                  <RefreshCw size={11} /> Retry
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
