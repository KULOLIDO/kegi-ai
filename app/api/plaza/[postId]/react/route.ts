import { NextRequest, NextResponse } from "next/server";
import { createAuthClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function getUserId(request: NextRequest) {
  const accessToken = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!accessToken) return null;
  const authClient = createAuthClient(accessToken);
  const {
    data: { user }
  } = await authClient.auth.getUser();
  return user?.id ?? null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) return NextResponse.json({ error: "请先登录。" }, { status: 401 });

    const { postId } = await params;
    const payload = (await request.json()) as { type?: "like" | "favorite" };
    const table = payload.type === "favorite" ? "favorites" : "likes";
    const supabase = createServiceClient();

    const { data: existing, error: readError } = await supabase
      .from(table)
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .maybeSingle();

    if (readError) throw readError;

    if (existing) {
      const { error } = await supabase.from(table).delete().eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from(table).insert({ post_id: postId, user_id: userId });
      if (error) throw error;
    }

    const [{ count: likeCount }, { count: favoriteCount }] = await Promise.all([
      supabase.from("likes").select("id", { count: "exact", head: true }).eq("post_id", postId),
      supabase.from("favorites").select("id", { count: "exact", head: true }).eq("post_id", postId)
    ]);

    return NextResponse.json({
      active: !existing,
      like_count: likeCount ?? 0,
      favorite_count: favoriteCount ?? 0
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "操作失败。" },
      { status: 500 }
    );
  }
}
