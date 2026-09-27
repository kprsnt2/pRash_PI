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
          className="overflow-hidden rounded-xl border border-[#26304a] bg-[#0f1526]"
        >
          {a.kind === "image" && a.dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={a.dataUrl}
              alt={a.name}
              className="max-h-48 max-w-[16rem] object-contain"
            />
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-[#c3cee6]">
              {a.kind === "pdf" ? <FileText size={14} /> : <FileIcon size={14} />}
              <span className="max-w-[12rem] truncate">{a.name}</span>
              <span className="text-[#6b7899]">{humanSize(a.size)}</span>
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
        <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#26304a] text-[#93a0bd]">
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
              : "border-[#26304a] bg-[#151c2e]"
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
            <span className="cursor-blink text-[#93a0bd]" />
          ) : null}
        </div>
        <div className="mt-1.5 flex items-center gap-3 px-1 text-[11px] text-[#6b7899] no-print">
          <span className="font-medium text-[#93a0bd]">{agent.name}</span>
          {modelLabel && <span>{modelLabel}</span>}
          {msg.content && !streaming && (
            <>
              {speechSupported && onToggleSpeak && (
                <button
                  type="button"
                  onClick={onToggleSpeak}
                  className={`flex items-center gap-1 hover:text-white ${
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
                className="flex items-center gap-1 hover:text-white"
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {copied ? "Copied" : "Copy"}
              </button>
              {onRegenerate && (
                <button
                  type="button"
                  onClick={onRegenerate}
                  className="flex items-center gap-1 hover:text-white"
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
