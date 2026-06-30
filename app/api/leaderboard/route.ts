import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type CreditTransactionRow = {
  amount: number | string | null;
};

type MaybeArray<T> = T | T[];

type ProfileRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  credits: number | string | null;
  credit_transactions: CreditTransactionRow[] | null;
};

type PostRow = {
  id: string;
  title: string;
  generation: MaybeArray<{
    output_image_url: string | null;
    template_name: string | null;
  }> | null;
  profile: MaybeArray<{
    display_name: string | null;
    email: string | null;
  }> | null;
  likes: { id: string }[] | null;
  favorites: { id: string }[] | null;
};

function firstItem<T>(value: MaybeArray<T> | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function displayName(profile: { display_name?: string | null; email?: string | null }) {
  return profile.display_name || profile.email?.split("@")[0] || "柯基创作者";
}

function level(totalCredits: number) {
  if (totalCredits >= 1000) return "传说";
  if (totalCredits >= 500) return "大师";
  if (totalCredits >= 200) return "高手";
  return "新秀";
}

export async function GET() {
  try {
    const supabase = createServiceClient();
    const [{ data: profiles, error: profileError }, { data: posts, error: postError }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, email, avatar_url, credits, credit_transactions(amount)")
          .limit(100),
        supabase
          .from("plaza_posts")
          .select(`
            id,
            title,
            user_id,
            generation:generations(output_image_url, template_name),
            profile:profiles(display_name, email),
            likes(id),
            favorites(id)
          `)
          .limit(100)
      ]);

    if (profileError) throw profileError;
    if (postError) throw postError;

    const creditBoard = ((profiles ?? []) as unknown as ProfileRow[])
      .map((profile) => {
        const earned = (profile.credit_transactions ?? [])
          .filter((item) => Number(item.amount) > 0)
          .reduce((sum, item) => sum + Number(item.amount), 0);
        const totalCredits = Math.max(earned, Number(profile.credits ?? 0));
        return {
          user_id: profile.id,
          name: displayName(profile),
          avatar_url: profile.avatar_url ?? null,
          total_credits: totalCredits,
          level: level(totalCredits)
        };
      })
      .sort((a, b) => b.total_credits - a.total_credits)
      .slice(0, 30)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    const hotBoard = ((posts ?? []) as unknown as PostRow[])
      .map((post) => {
        const generation = firstItem(post.generation);
        const profile = firstItem(post.profile);
        const likeCount = post.likes?.length ?? 0;
        const favoriteCount = post.favorites?.length ?? 0;
        return {
          id: post.id,
          title: post.title,
          author_name: displayName(profile ?? {}),
          image_url: generation?.output_image_url,
          template_name: generation?.template_name ?? "未知风格",
          hot_score: likeCount + favoriteCount * 2,
          like_count: likeCount,
          favorite_count: favoriteCount
        };
      })
      .sort((a, b) => b.hot_score - a.hot_score)
      .slice(0, 30);

    return NextResponse.json({ creditBoard, hotBoard });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "封神榜暂时不可用。" },
      { status: 500 }
    );
  }
}
