import { NextResponse } from "next/server";
import { AUTH_COOKIE, authEnabled, passcodeToken } from "@/lib/auth";

export async function POST(req: Request) {
  if (!authEnabled()) {
    return NextResponse.json({ ok: true, disabled: true });
  }
  let passcode = "";
  try {
    const body = await req.json();
    passcode = String(body?.passcode ?? "");
  } catch {
    /* ignore */
  }
  const expected = process.env.APP_PASSCODE?.trim();
  if (!expected || passcode !== expected) {
    return NextResponse.json({ error: "Incorrect passcode" }, { status: 401 });
  }
  const token = await passcodeToken(expected);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
