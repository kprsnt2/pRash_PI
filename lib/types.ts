export type Role = "system" | "user" | "assistant";

export type AttachmentKind = "image" | "pdf" | "text";

export interface Attachment {
  id: string;
  name: string;
  mime: string;
  size: number;
  kind: AttachmentKind;
  /** base64 data URL (images, pdf) — kept in memory only for private chats */
  dataUrl?: string;
  /** extracted/loaded plain text for text-kind attachments */
  text?: string;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  attachments?: Attachment[];
  createdAt: number;
  agentId?: string;
  modelId?: string;
  error?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  agentId: string;
  modelId: string; // "auto" or a concrete model id
  isPrivate: boolean;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export type ProviderId = "openai" | "gemini" | "nvidia" | "groq";

export interface ModelInfo {
  /** canonical id used across the app: `${provider}:${model}` */
  id: string;
  provider: ProviderId;
  model: string;
  label: string;
  /** can accept image inputs */
  vision: boolean;
  /** can accept native PDF inputs (Gemini only) */
  pdf: boolean;
  /** short note shown in the picker */
  note?: string;
}

export interface Agent {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  description: string;
  /** accent color as tailwind-ish hex used inline */
  color: string;
  /** provider:model preferred when this agent is used with "auto" routing */
  prefer?: string;
  needsVision?: boolean;
  systemPrompt: string;
  /** quick starter prompts shown in the empty state */
  starters: string[];
  category: "Kids" | "Learning" | "Work" | "Health" | "Life" | "Create";
}
