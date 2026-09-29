"use client";

import type { Attachment, ChatMessage, Conversation } from "./types";

const FORMAT = "prash-ai-chat";
const VERSION = 1;

interface ExportFile {
  format: typeof FORMAT;
  version: number;
  exportedAt: number;
  conversation: Conversation;
}

function safeFileName(title: string): string {
  const base = (title || "chat")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `prash-chat-${base || "export"}.json`;
}

/** Download a conversation as a JSON file that can be re-imported later. */
export function exportConversation(conv: Conversation): void {
  const payload: ExportFile = {
    format: FORMAT,
    version: VERSION,
    exportedAt: Date.now(),
    conversation: conv,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeFileName(conv.title);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function sanitizeAttachment(a: unknown): Attachment | null {
  if (!a || typeof a !== "object") return null;
  const r = a as Record<string, unknown>;
  if (typeof r.name !== "string") return null;
  return {
    id: typeof r.id === "string" ? r.id : crypto.randomUUID(),
    name: r.name.slice(0, 200),
    mime: typeof r.mime === "string" ? r.mime : "application/octet-stream",
    size: typeof r.size === "number" ? r.size : 0,
    kind: r.kind === "image" || r.kind === "pdf" ? r.kind : "text",
    dataUrl: typeof r.dataUrl === "string" ? r.dataUrl : undefined,
    text: typeof r.text === "string" ? r.text : undefined,
  };
}

function sanitizeMessage(m: unknown): ChatMessage | null {
  if (!m || typeof m !== "object") return null;
  const r = m as Record<string, unknown>;
  if (r.role !== "user" && r.role !== "assistant") return null;
  return {
    id: typeof r.id === "string" ? r.id : crypto.randomUUID(),
    role: r.role,
    content: typeof r.content === "string" ? r.content : "",
    attachments: Array.isArray(r.attachments)
      ? (r.attachments.map(sanitizeAttachment).filter(Boolean) as Attachment[])
      : undefined,
    createdAt: typeof r.createdAt === "number" ? r.createdAt : Date.now(),
    agentId: typeof r.agentId === "string" ? r.agentId : undefined,
    modelId: typeof r.modelId === "string" ? r.modelId : undefined,
    error: r.error === true ? true : undefined,
    stats:
      r.stats && typeof r.stats === "object"
        ? (r.stats as ChatMessage["stats"])
        : undefined,
  };
}

/**
 * Parse an exported chat file and return a ready-to-use conversation.
 * A fresh id is assigned so imports never collide with existing chats.
 */
export async function importConversation(file: File): Promise<Conversation> {
  const text = await file.text();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }

  // Accept both the wrapper format and a bare conversation object.
  let convRaw: unknown = raw;
  if (raw && typeof raw === "object" && "format" in raw) {
    const wrapper = raw as Partial<ExportFile>;
    if (wrapper.format !== FORMAT) {
      throw new Error("This file was not exported from pRash AI.");
    }
    convRaw = wrapper.conversation;
  }
  if (!convRaw || typeof convRaw !== "object") {
    throw new Error("No conversation found in that file.");
  }
  const c = convRaw as Record<string, unknown>;
  const messages = Array.isArray(c.messages)
    ? (c.messages.map(sanitizeMessage).filter(Boolean) as ChatMessage[])
    : [];

  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: typeof c.title === "string" && c.title ? c.title : "Imported chat",
    agentId: typeof c.agentId === "string" ? c.agentId : "general",
    modelId: typeof c.modelId === "string" ? c.modelId : "auto",
    isPrivate: false, // imported chats become normal, saveable chats
    messages,
    createdAt: typeof c.createdAt === "number" ? c.createdAt : now,
    updatedAt: now,
  };
}
