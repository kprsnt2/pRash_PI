import { NextResponse } from "next/server";
import { AGENTS } from "@/lib/agents";
import { configuredProviders, getAllModels } from "@/lib/models";
import { authEnabled } from "@/lib/auth";

export async function GET() {
  const agents = AGENTS.map(({ systemPrompt: _omit, ...meta }) => meta);
  return NextResponse.json({
    agents,
    models: getAllModels(),
    configuredProviders: configuredProviders(),
    authEnabled: authEnabled(),
  });
}
