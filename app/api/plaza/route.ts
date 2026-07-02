import { NextRequest, NextResponse } from "next/server";
import { createAuthClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type PlazaRelation = { id: string; user_id: string };
type MaybeArray<T> = T | T[];

type PlazaPostRow = {
  id: string;
  title: string;
  description: string | null;
  status?: "published" | "hidden" | null;
  created_at: string;
  user_id: string;
  generation: MaybeArray<{
    id: string;
    template_name: string | null;
    output_image_url: string | null;
    ratio: string | null;
  }> | null;
  profile: MaybeArray<{
    display_name: string | null;
    avatar_url: string | null;
    email: string | null;
  }> | null;
  likes: PlazaRelation[] | null;
  favorites: PlazaRelation[] | null;
};

function firstItem<T>(value: MaybeArray<T> | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function isMissingStatusColumn(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message ?? "";
  return error?.code === "42703" || error?.code === "PGRST204" || message.includes("status") || message.includes("schema cache");
}

async function getUserId(request: NextRequest) {
  const accessToken = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!accessToken) return null;
  const authClient = createAuthClient(accessToken);
  const {
    data: { user }
  } = await authClient.auth.getUser();
  return user?.id ?? null;
}

function profileName(profile: { display_name?: string | null; email?: string | null } | null) {
  return profile?.display_name || profile?.email?.split("@")[0] || "柯基创作者";
}

async function readPlazaPosts(supabase: ReturnType<typeof createServiceClient>) {
  const fullQuery = await supabase
    .from("plaza_posts")
    .select(`
      id,
      title,
      description,
      status,
      created_at,
      user_id,
      generation:generations(id, template_name, output_image_url, ratio),
      profile:profiles(display_name, avatar_url, email),
      likes(id, user_id),
      favorites(id, user_id)
    `)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(80);

  if (!fullQuery.error) return fullQuery.data ?? [];
  if (!isMissingStatusColumn(fullQuery.error)) throw fullQuery.error;

  console.warn("plaza_posts.status is missing, using legacy plaza read", fullQuery.error);
  const legacyQuery = await supabase
    .from("plaza_posts")
    .select(`
      id,
      title,
      description,
      created_at,
      user_id,
      generation:generations(id, template_name, output_image_url, ratio),
      profile:profiles(display_name, avatar_url, email),
      likes(id, user_id),
      favorites(id, user_id)
    `)
    .order("created_at", { ascending: false })
    .limit(80);

  if (legacyQuery.error) throw legacyQuery.error;
  return legacyQuery.data ?? [];
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const userId = await getUserId(request);
    const sort = request.nextUrl.searchParams.get("sort") === "hot" ? "hot" : "new";
    const posts = await readPlazaPosts(supabase);

    const items = ((posts ?? []) as unknown as PlazaPostRow[]).map((post) => {
      const generation = firstItem(post.generation);
      const profile = firstItem(post.profile);
      const likeCount = post.likes?.length ?? 0;
      const favoriteCount = post.favorites?.length ?? 0;
      return {
        id: post.id,
        title: post.title,
        description: post.description,
        created_at: post.created_at,
        author_id: post.user_id,
        author_name: profileName(profile),
        author_avatar_url: profile?.avatar_url ?? null,
        image_url: generation?.output_image_url,
        template_name: generation?.template_name ?? "未知风格",
        ratio: generation?.ratio ?? "1:1",
        like_count: likeCount,
        favorite_count: favoriteCount,
        hot_score: likeCount + favoriteCount * 2,
        liked: Boolean(userId && post.likes?.some((item) => item.user_id === userId)),
        favorited: Boolean(userId && post.favorites?.some((item) => item.user_id === userId))
      };
    });

    items.sort((a, b) =>
      sort === "hot"
        ? b.hot_score - a.hot_score || +new Date(b.created_at) - +new Date(a.created_at)
        : +new Date(b.created_at) - +new Date(a.created_at)
    );

    return NextResponse.json({ items });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "瞬间广场暂时不可用。" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) return NextResponse.json({ error: "请先登录。" }, { status: 401 });

    const payload = (await request.json()) as {
      generationId?: string;
      title?: string;
      description?: string;
    };
    const generationId = String(payload.generationId ?? "").trim();
    const title = String(payload.title ?? "").trim();
    const description = String(payload.description ?? "").trim();

    if (!generationId || title.length < 2 || title.length > 40) {
      return NextResponse.json({ error: "标题需要 2-40 个字符。" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: generation, error: generationError } = await supabase
      .from("generations")
      .select("id, user_id")
      .eq("id", generationId)
      .eq("user_id", userId)
      .single();

    if (generationError || !generation) {
      return NextResponse.json({ error: "只能发布自己的作品。" }, { status: 403 });
    }

    const fullSave = await supabase
      .from("plaza_posts")
      .upsert(
        {
          generation_id: generationId,
          user_id: userId,
          title,
          description: description || null,
          status: "published",
          updated_at: new Date().toISOString()
        },
        { onConflict: "generation_id" }
      )
      .select("id")
      .single();

    if (!fullSave.error && fullSave.data) return NextResponse.json({ id: fullSave.data.id });
    if (!isMissingStatusColumn(fullSave.error)) throw fullSave.error;

    console.warn("plaza_posts.status is missing, using legacy plaza publish", fullSave.error);
    const { data, error } = await supabase
      .from("plaza_posts")
      .upsert(
        {
          generation_id: generationId,
          user_id: userId,
          title,
          description: description || null,
          updated_at: new Date().toISOString()
        },
        { onConflict: "generation_id" }
      )
      .select("id")
      .single();

    if (error) throw error;
    return NextResponse.json({ id: data.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "发布失败。" },
      { status: 500 }
    );
  }
}
