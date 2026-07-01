import { NextRequest, NextResponse } from "next/server";
import { createAuthClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ProfileRow = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url?: string | null;
  credits: number;
  created_at: string;
  updated_at?: string | null;
};

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? process.env.TEMPLATE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function accountFromEmail(email: string | null | undefined) {
  if (!email) return "";
  return email.endsWith("@kegi-ai.local") ? email.replace("@kegi-ai.local", "") : email;
}

async function isAdminRequest(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.replace("Bearer ", "");

  if (!accessToken) return false;

  const authClient = createAuthClient(accessToken);
  const {
    data: { user },
    error
  } = await authClient.auth.getUser();

  if (error || !user?.email) return false;

  return getAdminEmails().includes(user.email.toLowerCase());
}

function toAdminUser(row: ProfileRow) {
  return {
    id: row.id,
    email: row.email,
    account: accountFromEmail(row.email),
    display_name: row.display_name,
    avatar_url: row.avatar_url ?? null,
    credits: row.credits,
    created_at: row.created_at,
    updated_at: row.updated_at ?? null
  };
}

export async function GET(request: NextRequest) {
  try {
    if (!(await isAdminRequest(request))) {
      return NextResponse.json({ error: "无权访问用户管理。" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim().toLowerCase() ?? "";
    const supabase = createServiceClient();

    const requestBuilder = supabase
      .from("profiles")
      .select("id, email, display_name, avatar_url, credits, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(80);

    const { data, error } = query
      ? await requestBuilder.or(`email.ilike.%${query}%,display_name.ilike.%${query}%`)
      : await requestBuilder;
    if (error) {
      console.error("Admin users read failed", error);
      throw new Error("用户列表读取失败。");
    }

    return NextResponse.json({ items: ((data ?? []) as ProfileRow[]).map(toAdminUser) });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "用户管理服务暂时不可用。" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!(await isAdminRequest(request))) {
      return NextResponse.json({ error: "无权修改用户。" }, { status: 401 });
    }

    const payload = (await request.json()) as {
      userId?: string;
      action?: "set_credits" | "adjust_credits" | "reset_password";
      credits?: number;
      amount?: number;
      password?: string;
      note?: string;
    };

    const userId = String(payload.userId ?? "").trim();
    const action = payload.action;

    if (!userId) {
      return NextResponse.json({ error: "缺少用户 ID。" }, { status: 400 });
    }

    const supabase = createServiceClient();

    if (action === "reset_password") {
      const password = String(payload.password ?? "");
      if (password.length < 6 || password.length > 72) {
        return NextResponse.json({ error: "新密码需要 6-72 位。" }, { status: 400 });
      }

      const { error } = await supabase.auth.admin.updateUserById(userId, { password });
      if (error) {
        console.error("Admin reset password failed", error);
        throw new Error("密码重置失败。");
      }

      return NextResponse.json({ ok: true });
    }

    if (action !== "set_credits" && action !== "adjust_credits") {
      return NextResponse.json({ error: "未知操作。" }, { status: 400 });
    }

    const { data: profile, error: readError } = await supabase
      .from("profiles")
      .select("id, email, display_name, avatar_url, credits, created_at, updated_at")
      .eq("id", userId)
      .single();

    if (readError || !profile) {
      return NextResponse.json({ error: "用户不存在。" }, { status: 404 });
    }

    const currentCredits = Number((profile as ProfileRow).credits ?? 0);
    const nextCredits =
      action === "set_credits" ? Number(payload.credits) : currentCredits + Number(payload.amount);

    if (!Number.isInteger(nextCredits) || nextCredits < 0) {
      return NextResponse.json({ error: "积分必须是大于等于 0 的整数。" }, { status: 400 });
    }

    const delta = nextCredits - currentCredits;
    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update({ credits: nextCredits, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select("id, email, display_name, avatar_url, credits, created_at, updated_at")
      .single();

    if (updateError || !updated) {
      console.error("Admin credits update failed", updateError);
      throw new Error("积分修改失败。");
    }

    if (delta !== 0) {
      const { error: txError } = await supabase.from("credit_transactions").insert({
        user_id: userId,
        type: "adjust",
        amount: delta,
        balance_after: nextCredits,
        note: String(payload.note ?? "管理员调整积分").trim() || "管理员调整积分"
      });

      if (txError) {
        console.error("Admin credit transaction insert failed", txError);
      }
    }

    return NextResponse.json({ item: toAdminUser(updated as ProfileRow) });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "用户修改服务暂时不可用。" },
      { status: 500 }
    );
  }
}
