import { NextRequest, NextResponse } from "next/server";
import { createAuthClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type PlazaRow = {
  id: string;
  generation_id: string;
  user_id: string;
  title: string;
  description: string | null;
  status?: "published" | "hidden" | null;
  created_at: string;
};

type GenerationRow = {
  id: string;
  output_image_url: string | null;
  template_name: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

type ReactionRow = {
  post_id: string;
};

function isMissingStatusColumn(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message ?? "";
  return error?.code === "42703" || error?.code === "PGRST204" || message.includes("status") || message.includes("schema cache");
}

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

function authorName(profile: ProfileRow | undefined) {
  return profile?.display_name || profile?.email?.split("@")[0] || "柯基创作者";
}

function countByPost(rows: ReactionRow[] | null | undefined) {
  const counts = new Map<string, number>();
  for (const row of rows ?? []) {
    counts.set(row.post_id, (counts.get(row.post_id) ?? 0) + 1);
  }
  return counts;
}

async function readPlazaRows(supabase: ReturnType<typeof createServiceClient>) {
  const fullQuery = await supabase
    .from("plaza_posts")
    .select("id, generation_id, user_id, title, description, status, created_at")
    .order("created_at", { ascending: false })
    .limit(120);

  if (!fullQuery.error) return { rows: (fullQuery.data ?? []) as PlazaRow[], legacy: false };
  if (!isMissingStatusColumn(fullQuery.error)) throw fullQuery.error;

  console.warn("plaza_posts.status is missing, using legacy admin plaza read", fullQuery.error);
  const legacyQuery = await supabase
    .from("plaza_posts")
    .select("id, generation_id, user_id, title, description, created_at")
    .order("created_at", { ascending: false })
    .limit(120);

  if (legacyQuery.error) throw legacyQuery.error;
  return { rows: (legacyQuery.data ?? []) as PlazaRow[], legacy: true };
}

export async function GET(request: NextRequest) {
  try {
    if (!(await isAdminRequest(request))) {
      return NextResponse.json({ error: "无权查看广场管理。" }, { status: 401 });
    }

    const supabase = createServiceClient();
    const { rows, legacy } = await readPlazaRows(supabase);
    const generationIds = Array.from(new Set(rows.map((row) => row.generation_id).filter(Boolean)));
    const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)));
    const postIds = rows.map((row) => row.id);

    const [generationsResult, profilesResult, likesResult, favoritesResult] = await Promise.all([
      generationIds.length
        ? supabase.from("generations").select("id, output_image_url, template_name").in("id", generationIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? supabase.from("profiles").select("id, display_name, email, avatar_url").in("id", userIds)
        : Promise.resolve({ data: [], error: null }),
      postIds.length ? supabase.from("likes").select("post_id").in("post_id", postIds) : Promise.resolve({ data: [], error: null }),
      postIds.length ? supabase.from("favorites").select("post_id").in("post_id", postIds) : Promise.resolve({ data: [], error: null })
    ]);

    if (generationsResult.error) throw generationsResult.error;
    if (profilesResult.error) throw profilesResult.error;
    if (likesResult.error) throw likesResult.error;
    if (favoritesResult.error) throw favoritesResult.error;

    const generations = new Map(((generationsResult.data ?? []) as GenerationRow[]).map((item) => [item.id, item]));
    const profiles = new Map(((profilesResult.data ?? []) as ProfileRow[]).map((item) => [item.id, item]));
    const likeCounts = countByPost(likesResult.data as ReactionRow[]);
    const favoriteCounts = countByPost(favoritesResult.data as ReactionRow[]);

    const items = rows.map((post) => {
      const generation = generations.get(post.generation_id);
      const profile = profiles.get(post.user_id);
      const likeCount = likeCounts.get(post.id) ?? 0;
      const favoriteCount = favoriteCounts.get(post.id) ?? 0;
      return {
        id: post.id,
        title: post.title,
        description: post.description,
        status: post.status ?? "published",
        created_at: post.created_at,
        author_id: post.user_id,
        author_name: authorName(profile),
        author_avatar_url: profile?.avatar_url ?? null,
        image_url: generation?.output_image_url ?? "",
        template_name: generation?.template_name ?? "未知风格",
        like_count: likeCount,
        favorite_count: favoriteCount,
        hot_score: likeCount + favoriteCount * 2
      };
    });

    return NextResponse.json({ items, legacy });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "广场管理暂时不可用。" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!(await isAdminRequest(request))) {
      return NextResponse.json({ error: "无权修改广场作品。" }, { status: 401 });
    }

    const payload = (await request.json()) as { id?: string; status?: "published" | "hidden" };
    const id = String(payload.id ?? "").trim();
    const status = payload.status;

    if (!id || (status !== "published" && status !== "hidden")) {
      return NextResponse.json({ error: "缺少作品 ID 或状态不正确。" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("plaza_posts")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, status")
      .single();

    if (error) {
      if (isMissingStatusColumn(error)) {
        return NextResponse.json({ error: "请先在 Supabase 执行最新 SQL，给 plaza_posts 增加 status 字段后再下架。" }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "广场作品状态更新失败。" },
      { status: 500 }
    );
  }
}
