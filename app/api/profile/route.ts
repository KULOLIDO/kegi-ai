import { NextRequest, NextResponse } from "next/server";
import { createAuthClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function accountFromEmail(email: string | null | undefined) {
  if (!email) return "";
  return email.endsWith("@kegi-ai.local") ? email.replace("@kegi-ai.local", "") : email;
}

async function ensureProfile({
  userId,
  email,
  displayName
}: {
  userId: string;
  email: string;
  displayName: string | null;
}) {
  const supabase = createServiceClient();

  const { error: upsertError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email,
      display_name: displayName ?? accountFromEmail(email) ?? "柯基新朋友",
      credits: 100
    },
    {
      ignoreDuplicates: true,
      onConflict: "id"
    }
  );

  if (upsertError) {
    console.error("Profile upsert failed", {
      code: upsertError.code,
      message: upsertError.message,
      details: upsertError.details
    });
    throw new Error("账户资料初始化失败，请先执行最新的 supabase/schema.sql。");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, display_name, credits, created_at")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    console.error("Profile read failed", {
      code: profileError?.code,
      message: profileError?.message,
      details: profileError?.details
    });
    throw new Error("账户资料读取失败，请稍后重试。");
  }

  return {
    ...profile,
    account: accountFromEmail(profile.email)
  };
}

async function getAuthedUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.replace("Bearer ", "");

  if (!accessToken) {
    return { user: null, error: "请先登录或注册，注册后会赠送 100 积分。" };
  }

  const authClient = createAuthClient(accessToken);
  const {
    data: { user },
    error: userError
  } = await authClient.auth.getUser();

  if (userError || !user) {
    return { user: null, error: "登录状态无效，请重新登录。" };
  }

  return { user, error: null };
}

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await getAuthedUser(request);

    if (!user) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const profile = await ensureProfile({
      userId: user.id,
      email: user.email ?? `user-${user.id}@corgi-ai.local`,
      displayName:
        typeof user.user_metadata?.display_name === "string"
          ? user.user_metadata.display_name
          : null
    });

    return NextResponse.json({ ...profile, auth_mode: "user" });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "账户服务暂时不可用，请检查环境变量和服务日志。"
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user, error } = await getAuthedUser(request);

    if (!user) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const payload = (await request.json()) as { display_name?: string };
    const displayName = String(payload.display_name ?? "").trim();

    if (displayName.length < 2 || displayName.length > 24) {
      return NextResponse.json({ error: "昵称需要 2-24 个字符。" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        updated_at: new Date().toISOString()
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Profile update failed", updateError);
      throw new Error("个人信息保存失败，请稍后再试。");
    }

    const profile = await ensureProfile({
      userId: user.id,
      email: user.email ?? `user-${user.id}@corgi-ai.local`,
      displayName
    });

    return NextResponse.json({ ...profile, auth_mode: "user" });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "个人信息服务暂时不可用。" },
      { status: 500 }
    );
  }
}
