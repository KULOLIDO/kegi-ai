import { NextRequest, NextResponse } from "next/server";
import { defaultTemplates, type CorgiTemplate } from "@/lib/templates";
import { createAuthClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function withAccent(template: Partial<CorgiTemplate>, index: number): CorgiTemplate {
  const fallback =
    defaultTemplates.find((item) => item.id === template.id) ??
    defaultTemplates[index] ??
    defaultTemplates[0];

  return {
    id: String(template.id ?? fallback.id),
    name: String(template.name ?? fallback.name),
    tagline: String(template.description ?? template.tagline ?? fallback.tagline),
    description: String(template.description ?? fallback.description),
    cover_url: template.cover_url || fallback.cover_url,
    cost: Number(template.cost ?? fallback.cost),
    size: String(template.size ?? fallback.size),
    accent: fallback.accent,
    prompt: String(template.prompt ?? fallback.prompt),
    is_active: Boolean(template.is_active ?? true),
    sort_order: Number(template.sort_order ?? fallback.sort_order),
    isCustom: template.id === "custom-image"
  };
}

async function readTemplates() {
  const supabase = createServiceClient();
  const fullQuery = await supabase
    .from("templates")
    .select("id, name, description, cover_url, prompt, cost, size, is_active, sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (!fullQuery.error) {
    return fullQuery.data ?? [];
  }

  if (
    fullQuery.error.code !== "42703" &&
    fullQuery.error.code !== "PGRST204" &&
    !fullQuery.error.message.includes("schema cache")
  ) {
    throw fullQuery.error;
  }

  console.warn("Template table is missing admin columns, using compatibility read", {
    code: fullQuery.error.code,
    message: fullQuery.error.message
  });

  const legacyQuery = await supabase
    .from("templates")
    .select("id, name, description, cover_url, prompt, cost, size, created_at")
    .order("created_at", { ascending: true });

  if (legacyQuery.error) {
    throw legacyQuery.error;
  }

  return legacyQuery.data ?? [];
}

function withCustomTemplate(items: CorgiTemplate[]) {
  const hasCustom = items.some((template) => template.id === "custom-image");
  return hasCustom
    ? items
    : [...items, defaultTemplates.find((item) => item.id === "custom-image")!];
}

function composeTemplates(data: Partial<CorgiTemplate>[]) {
  const dbById = new Map(data.map((template) => [String(template.id), template]));
  const defaultIds = new Set(defaultTemplates.map((template) => template.id));
  const mergedDefaults = defaultTemplates.map((fallback, index) =>
    withAccent(dbById.get(fallback.id) ?? fallback, index)
  );
  const extraTemplates = data
    .filter((template) => template.id && !defaultIds.has(String(template.id)))
    .map((template, index) => withAccent(template, defaultTemplates.length + index));

  return withCustomTemplate([...mergedDefaults, ...extraTemplates]).sort((left, right) => {
    if (left.sort_order !== right.sort_order) return left.sort_order - right.sort_order;
    return left.name.localeCompare(right.name, "zh-CN");
  });
}

function dedupeTemplatesByName(items: CorgiTemplate[]) {
  const seen = new Set<string>();
  return items.filter((template) => {
    const key = template.name.replace(/\s+/g, "").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? process.env.TEMPLATE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function isAdminRequest(request: NextRequest) {
  const adminKey = process.env.TEMPLATE_ADMIN_KEY ?? process.env.ADMIN_API_KEY;
  const requestKey = request.headers.get("x-admin-key");

  if (adminKey && requestKey === adminKey) {
    return true;
  }

  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.replace("Bearer ", "");

  if (!accessToken) {
    return false;
  }

  const authClient = createAuthClient(accessToken);
  const {
    data: { user },
    error
  } = await authClient.auth.getUser();

  if (error || !user?.email) {
    return false;
  }

  return getAdminEmails().includes(user.email.toLowerCase());
}

export async function GET(request: NextRequest) {
  try {
    const data = await readTemplates();
    const isAdmin = await isAdminRequest(request);
    const includeInactive = isAdmin && request.nextUrl.searchParams.get("scope") === "admin";
    const scopedItems = composeTemplates(data as Partial<CorgiTemplate>[]).filter(
      (template) => includeInactive || template.is_active
    );
    const items = includeInactive ? scopedItems : dedupeTemplatesByName(scopedItems);

    return NextResponse.json({
      items,
      source: data.length > 0 ? "database" : "defaults"
    });
  } catch (error) {
    console.error("Template read failed, using defaults", error);
    return NextResponse.json({ items: defaultTemplates, source: "defaults" });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdminRequest(request))) {
      return NextResponse.json({ error: "无权修改模板。" }, { status: 401 });
    }

    const payload = (await request.json()) as Partial<CorgiTemplate>;
    const id = String(payload.id ?? "").trim();
    const name = String(payload.name ?? "").trim();
    const description = String(payload.description ?? payload.tagline ?? "").trim();
    const prompt = String(payload.prompt ?? "").trim();
    const cost = Number(payload.cost);
    const sortOrder = Number(payload.sort_order ?? 999);

    if (!id || !name || !description || !prompt || !Number.isFinite(cost) || cost <= 0) {
      return NextResponse.json(
        { error: "模板 ID、名称、描述、提示词和积分必须填写。" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const fullPayload = {
      id,
      name,
      description,
      cover_url: payload.cover_url || null,
      prompt,
      cost,
      size: String(payload.size ?? "1024x1024"),
      is_active: Boolean(payload.is_active ?? true),
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 999,
      updated_at: new Date().toISOString()
    };

    const fullSave = await supabase
      .from("templates")
      .upsert(fullPayload, { onConflict: "id" })
      .select("id, name, description, cover_url, prompt, cost, size, is_active, sort_order")
      .single();

    if (!fullSave.error && fullSave.data) {
      return NextResponse.json({
        item: withAccent(fullSave.data as Partial<CorgiTemplate>, 0),
        mode: "full"
      });
    }

    if (
      fullSave.error?.code !== "PGRST204" &&
      fullSave.error?.code !== "42703" &&
      !fullSave.error?.message.includes("schema cache")
    ) {
      console.error("Template save failed", {
        code: fullSave.error?.code,
        message: fullSave.error?.message,
        details: fullSave.error?.details
      });
      throw new Error("模板保存失败。");
    }

    console.warn("Template table is missing admin columns, using compatibility save", {
      code: fullSave.error.code,
      message: fullSave.error.message
    });

    const legacyPayload = {
      id,
      name,
      description,
      cover_url: payload.cover_url || null,
      prompt,
      cost,
      size: String(payload.size ?? "1024x1024")
    };
    const legacySave = await supabase
      .from("templates")
      .upsert(legacyPayload, { onConflict: "id" })
      .select("id, name, description, cover_url, prompt, cost, size")
      .single();

    if (legacySave.error || !legacySave.data) {
      console.error("Template compatibility save failed", {
        code: legacySave.error?.code,
        message: legacySave.error?.message,
        details: legacySave.error?.details
      });
      throw new Error("模板保存失败，请确认 templates 表已创建。");
    }

    return NextResponse.json({
      item: withAccent(legacySave.data as Partial<CorgiTemplate>, 0),
      mode: "compatibility"
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "模板服务暂时不可用，请稍后再试。"
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!(await isAdminRequest(request))) {
      return NextResponse.json({ error: "无权删除模板。" }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ error: "缺少模板 ID。" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase.from("templates").delete().eq("id", id);

    if (error) {
      console.error("Template delete failed", error);
      throw new Error("模板删除失败，请确认 templates 表已创建。");
    }

    return NextResponse.json({ id });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "模板删除服务暂时不可用。" },
      { status: 500 }
    );
  }
}
