import { NextRequest, NextResponse } from "next/server";
import { createAuthClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const DEFAULT_PUBLIC_NOTICE =
  "生成图片请遵守平台规则，请勿上传违规内容。作品生成或充值问题，可在个人中心联系管理员 KOLOLIDO。";

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? process.env.TEMPLATE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
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

export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "public_notice")
      .maybeSingle();

    if (error) {
      console.warn("Site settings read fallback", error);
      return NextResponse.json({ publicNotice: DEFAULT_PUBLIC_NOTICE, source: "default" });
    }

    return NextResponse.json({
      publicNotice: String(data?.value ?? DEFAULT_PUBLIC_NOTICE),
      source: data ? "database" : "default"
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ publicNotice: DEFAULT_PUBLIC_NOTICE, source: "default" });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdminRequest(request))) {
      return NextResponse.json({ error: "无权修改站点设置。" }, { status: 401 });
    }

    const payload = (await request.json()) as { publicNotice?: string };
    const publicNotice = String(payload.publicNotice ?? "").trim();

    if (publicNotice.length < 2 || publicNotice.length > 500) {
      return NextResponse.json({ error: "公告内容需要 2-500 个字符。" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase.from("site_settings").upsert(
      {
        key: "public_notice",
        value: publicNotice,
        updated_at: new Date().toISOString()
      },
      { onConflict: "key" }
    );

    if (error) {
      console.error("Site settings save failed", error);
      throw new Error("公告保存失败，请先确认 Supabase 已创建 site_settings 表。");
    }

    return NextResponse.json({ publicNotice });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "站点设置服务暂时不可用。" },
      { status: 500 }
    );
  }
}
