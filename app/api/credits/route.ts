import { NextRequest, NextResponse } from "next/server";
import { createAuthClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";


export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.replace("Bearer ", "");

    if (!accessToken) {
      return NextResponse.json({ items: [] });
    }

    let userId: string | null = null;

    if (accessToken) {
      const authClient = createAuthClient(accessToken);
      const {
        data: { user },
        error: userError
      } = await authClient.auth.getUser();

      if (userError || !user) {
        throw new Error("登录状态无效，请重新登录。");
      }

      userId = user.id;
    }

    if (!userId) {
      return NextResponse.json({ items: [] });
    }

    const { data, error } = await supabase
      .from("credit_transactions")
      .select("id, type, amount, balance_after, generation_id, note, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Credit transactions read failed", {
        code: error.code,
        message: error.message,
        details: error.details
      });
      throw new Error("积分流水读取失败，请确认已执行最新的 supabase/schema.sql。");
    }

    return NextResponse.json({ items: data ?? [] });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "积分流水暂时不可用，请稍后再试。"
      },
      { status: 500 }
    );
  }
}
