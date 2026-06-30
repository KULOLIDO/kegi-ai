import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? process.env.TEMPLATE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.replace("Bearer ", "");

  if (!accessToken) {
    return NextResponse.json({ isAdmin: false });
  }

  const authClient = createAuthClient(accessToken);
  const {
    data: { user },
    error
  } = await authClient.auth.getUser();

  if (error || !user?.email) {
    return NextResponse.json({ isAdmin: false });
  }

  const isAdmin = getAdminEmails().includes(user.email.toLowerCase());

  return NextResponse.json({ isAdmin });
}
