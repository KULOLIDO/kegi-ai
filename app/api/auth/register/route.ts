import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function normalizeAccount(value: string) {
  return value.trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as { account?: string; password?: string };
    const account = normalizeAccount(String(payload.account ?? ""));
    const password = String(payload.password ?? "");

    if (!/^[a-z0-9_]{3,24}$/.test(account)) {
      return NextResponse.json(
        { error: "账号只能使用 3-24 位英文、数字或下划线。" },
        { status: 400 }
      );
    }

    if (password.length < 6 || password.length > 72) {
      return NextResponse.json({ error: "密码需要 6-72 位。" }, { status: 400 });
    }

    const email = `${account}@kegi-ai.local`;
    const supabase = createServiceClient();
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: account.toUpperCase(),
        account
      }
    });

    if (error) {
      const message = error.message.toLowerCase().includes("already")
        ? "账号已存在，请换一个账号。"
        : error.message;
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ id: data.user?.id, account });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "注册服务暂时不可用。" },
      { status: 500 }
    );
  }
}
