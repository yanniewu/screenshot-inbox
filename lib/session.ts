import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function getUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user ?? null;
}

export const unauthorized = () =>
  NextResponse.json({ error: "Sign in required." }, { status: 401 });