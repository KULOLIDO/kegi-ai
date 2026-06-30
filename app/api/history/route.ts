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
      .from("generations")
      .select(
        "id, template_id, template_name, cost, ratio, model, ai_task_id, input_image_url, output_image_url, created_at"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) {
      console.error("History read failed", {
        code: error.code,
        message: error.message,
        details: error.details
      });
      throw new Error("作品历史读取失败，请确认已执行最新的 supabase/schema.sql。");
    }

    return NextResponse.json({ items: data ?? [] });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "作品历史暂时不可用，请稍后再试。"
      },
      { status: 500 }
    );
  }
}
