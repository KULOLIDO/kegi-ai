import { NextRequest, NextResponse } from "next/server";
import { defaultTemplates, getDefaultTemplate, type CorgiTemplate } from "@/lib/templates";
import { createAuthClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const TASK_POLL_INTERVAL_MS = 2000;
const TASK_POLL_ATTEMPTS = 180;
const allowedRatios = new Set(["1:1", "4:3", "3:4", "16:9", "9:16"]);

type AiuxuGenerationResponse = {
  message?: string;
  data?: Array<{ task_id?: string; taskId?: string }>;
};

type AiuxuTaskResponse = {
  message?: string;
  data?: {
    status?: string;
    error?: { message?: string };
    result?: {
      images?: Array<string | { url?: string | string[] }>;
    };
  };
};

function getAiuxuConfig() {
  const baseURL = process.env.OPENAI_BASE_URL ?? "https://api.aiuxu.com/v1";
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("缺少 OPENAI_API_KEY。");
  }

  return {
    apiKey,
    baseURL: baseURL.replace(/\/$/, "")
  };
}

async function aiuxuFetch<T>(
  path: string,
  init: RequestInit,
  timeoutMs = 60_000
) {
  const { apiKey, baseURL } = getAiuxuConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseURL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(init.headers ?? {})
      },
      signal: controller.signal
    });
    const payload = (await response.json().catch(() => null)) as T | null;

    if (!response.ok) {
      throw new Error(`AIUXU 请求失败：${response.status} ${JSON.stringify(payload)}`);
    }

    if (!payload) {
      throw new Error("AIUXU 返回了空响应。");
    }

    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function getImageUrlFromTask(payload: AiuxuTaskResponse) {
  const image = payload.data?.result?.images?.[0];

  if (typeof image === "string") {
    return image;
  }

  if (Array.isArray(image?.url)) {
    return image.url[0];
  }

  return image?.url;
}

function normalizeAiuxuFailureMessage(message?: string) {
  const raw = message ?? "AIUXU 图片任务失败。";

  if (raw.toLowerCase().includes("prohibit")) {
    return "图片或提示词触发了内容审核，请更换参考图、换一个模板，或减少可能敏感的描述后重试。";
  }

  return raw;
}

async function getRuntimeTemplate(
  supabase: ReturnType<typeof createServiceClient>,
  templateId: string
) {
  const fallback = getDefaultTemplate(templateId);

  if (templateId === "custom-image") {
    return fallback;
  }

  const { data, error } = await supabase
    .from("templates")
    .select("id, name, description, cover_url, prompt, cost, size, is_active, sort_order")
    .eq("id", templateId)
    .maybeSingle();

  if (error) {
    console.warn("Template read failed, falling back to default", {
      code: error.code,
      message: error.message
    });
    return fallback;
  }

  if (!data) {
    return fallback;
  }

  if (data.is_active === false) {
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    tagline: data.description,
    description: data.description,
    cover_url: data.cover_url,
    cost: data.cost,
    size: data.size,
    accent: fallback?.accent ?? defaultTemplates[0].accent,
    prompt: data.prompt,
    is_active: data.is_active ?? true,
    sort_order: data.sort_order ?? fallback?.sort_order ?? 999,
    isCustom: false
  } satisfies CorgiTemplate;
}

async function createAiuxuImageTask({
  prompt,
  ratio,
  imageDataUrl
}: {
  prompt: string;
  ratio: string;
  imageDataUrl?: string;
}) {
  const body: Record<string, unknown> = {
    model: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2",
    prompt,
    n: 1,
    size: ratio,
    resolution: process.env.OPENAI_IMAGE_RESOLUTION ?? "1k"
  };

  if (imageDataUrl) {
    body.image_urls = [imageDataUrl];
  }

  console.info("AIUXU create image task", {
    model: body.model,
    size: body.size,
    resolution: body.resolution,
    hasReferenceImage: Boolean(imageDataUrl)
  });

  const payload = await aiuxuFetch<AiuxuGenerationResponse>(
    "/images/generations",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );
  const taskId = payload.data?.[0]?.task_id ?? payload.data?.[0]?.taskId;

  if (!taskId) {
    throw new Error(normalizeAiuxuFailureMessage(payload.message));
  }

  return taskId;
}

async function waitForAiuxuImage(taskId: string) {
  for (let attempt = 0; attempt < TASK_POLL_ATTEMPTS; attempt += 1) {
    const payload = await aiuxuFetch<AiuxuTaskResponse>(
      `/tasks/${taskId}?language=zh`,
      { method: "GET" },
      30_000
    );
    const status = payload.data?.status;

    console.info("AIUXU task status", { taskId, status, attempt });

    if (status === "completed") {
      const imageUrl = getImageUrlFromTask(payload);

      if (!imageUrl) {
        throw new Error("AIUXU 任务完成，但没有返回图片 URL。");
      }

      return imageUrl;
    }

    if (status === "failed" || status === "cancelled") {
      throw new Error(
        normalizeAiuxuFailureMessage(payload.data?.error?.message ?? payload.message)
      );
    }

    await new Promise((resolve) => setTimeout(resolve, TASK_POLL_INTERVAL_MS));
  }

  throw new Error("AIUXU 图片任务超时。");
}

async function saveGeneratedImageOrUseRemote(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  remoteImageUrl: string
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const outputResponse = await fetch(remoteImageUrl, { signal: controller.signal });

    if (!outputResponse.ok) {
      return remoteImageUrl;
    }

    const outputBuffer = Buffer.from(await outputResponse.arrayBuffer());
    const outputPath = `${userId}/outputs/${crypto.randomUUID()}.png`;
    const { error: outputUploadError } = await supabase.storage
      .from("generations")
      .upload(outputPath, outputBuffer, {
        contentType: outputResponse.headers.get("content-type") ?? "image/png",
        upsert: false
      });

    if (outputUploadError) {
      console.warn("Supabase output upload failed", outputUploadError.message);
      return remoteImageUrl;
    }

    const {
      data: { publicUrl }
    } = supabase.storage.from("generations").getPublicUrl(outputPath);

    return publicUrl;
  } catch (error) {
    console.warn("Generated image transfer failed, using remote URL", {
      message: error instanceof Error ? error.message : String(error)
    });
    return remoteImageUrl;
  } finally {
    clearTimeout(timer);
  }
}

async function uploadInputImage(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  file: File,
  buffer: Buffer
) {
  const extension = file.name.split(".").pop() || "png";
  const inputPath = `${userId}/inputs/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from("generations")
    .upload(inputPath, buffer, {
      contentType: file.type || "image/png",
      upsert: false
    });

  if (error) {
    console.warn("Supabase input upload failed", error.message);
    return null;
  }

  const {
    data: { publicUrl }
  } = supabase.storage.from("generations").getPublicUrl(inputPath);

  return publicUrl;
}

async function spendCreditsAndCreateGeneration({
  supabase,
  userId,
  templateId,
  templateName,
  prompt,
  cost,
  ratio,
  aiTaskId,
  inputImageUrl,
  outputImageUrl
}: {
  supabase: ReturnType<typeof createServiceClient>;
  userId: string;
  templateId: string;
  templateName: string;
  prompt: string;
  cost: number;
  ratio: string;
  aiTaskId: string;
  inputImageUrl: string | null;
  outputImageUrl: string;
}) {
  const model = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";
  const { data, error } = await supabase.rpc("spend_credits_and_create_generation", {
    p_user_id: userId,
    p_template_id: templateId,
    p_template_name: templateName,
    p_prompt: prompt,
    p_cost: cost,
    p_input_image_url: inputImageUrl,
    p_output_image_url: outputImageUrl,
    p_ratio: ratio,
    p_model: model,
    p_ai_task_id: aiTaskId
  });

  if (error || !data) {
    console.error("Generation RPC failed", {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint
    });
    throw new Error("生成记录保存或积分扣除失败，请确认已执行最新的 supabase/schema.sql。");
  }

  return data as { id: string; credits_after: number };
}

function fileToDataUrl(file: File, buffer: Buffer) {
  return `data:${file.type || "image/png"};base64,${buffer.toString("base64")}`;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.replace("Bearer ", "");

    if (!accessToken) {
      return NextResponse.json(
        { error: "请先登录或注册，注册后会赠送 100 积分。" },
        { status: 401 }
      );
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
      throw new Error("账户资料读取失败，请刷新页面重新同步访客账户。");
    }

    const formData = await request.formData();
    const templateId = String(formData.get("templateId") ?? "");
    const customPrompt = String(formData.get("customPrompt") ?? "").trim();
    const requestedRatio = String(
      formData.get("ratio") ?? process.env.OPENAI_IMAGE_SIZE ?? "1:1"
    );
    const ratio = allowedRatios.has(requestedRatio) ? requestedRatio : "1:1";
    const template = await getRuntimeTemplate(supabase, templateId);

    if (!template) {
      return NextResponse.json({ error: "请选择有效且已启用的模板。" }, { status: 400 });
    }

    if (template.isCustom && customPrompt.length < 6) {
      return NextResponse.json(
        { error: "自定义生成至少需要输入 6 个字。" },
        { status: 400 }
      );
    }

    const imageFile = formData.get("image");
    let imageDataUrl: string | undefined;
    let inputImageUrl: string | null = null;

    if (imageFile instanceof File && imageFile.size > 0) {
      if (!imageFile.type.startsWith("image/")) {
        return NextResponse.json(
          { error: "请上传 JPG、PNG 或 WebP 图片。" },
          { status: 400 }
        );
      }

      if (imageFile.size > MAX_IMAGE_SIZE) {
        return NextResponse.json({ error: "图片不能超过 8MB。" }, { status: 400 });
      }

      const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
      imageDataUrl = fileToDataUrl(imageFile, imageBuffer);
      inputImageUrl = await uploadInputImage(supabase, userId, imageFile, imageBuffer);
    }

    const finalPrompt =
      template.isCustom && customPrompt
        ? `${template.prompt}\n用户自定义要求：${customPrompt}`
        : template.prompt;
    const safePrompt = `${finalPrompt}\n只生成健康、日常、友好的艺术图片，画面干净清爽，保持主体自然完整。`;

    const taskId = await createAiuxuImageTask({
      prompt: safePrompt,
      ratio,
      imageDataUrl
    });
    const remoteImageUrl = await waitForAiuxuImage(taskId);
    const outputImageUrl = await saveGeneratedImageOrUseRemote(
      supabase,
      userId,
      remoteImageUrl
    );

    const spendResult = await spendCreditsAndCreateGeneration({
      supabase,
      userId,
      templateId: template.id,
      templateName: template.name,
      prompt: safePrompt,
      cost: template.cost,
      ratio,
      aiTaskId: taskId,
      inputImageUrl,
      outputImageUrl
    });

    return NextResponse.json({
      id: spendResult.id,
      outputImageUrl,
      credits: spendResult.credits_after
    });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "";
    const causeCode =
      error && typeof error === "object" && "cause" in error
        ? (error.cause as { code?: string } | undefined)?.code
        : undefined;

    if (
      message.includes("AIUXU 图片任务超时") ||
      message.includes("aborted") ||
      causeCode === "ETIMEDOUT" ||
      causeCode === "UND_ERR_CONNECT_TIMEOUT" ||
      message.includes("fetch failed")
    ) {
      return NextResponse.json(
        { error: "AIUXU 图片任务超时，请稍后重试，或检查模型与网络状态。" },
        { status: 504 }
      );
    }

    if (message.includes("内容审核") || message.toLowerCase().includes("prohibit")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (message.includes("AIUXU")) {
      return NextResponse.json({ error: `AIUXU 调用失败：${message}` }, { status: 502 });
    }

    if (
      message.includes("积分") ||
      message.includes("账户资料") ||
      message.includes("登录状态") ||
      message.includes("生成记录")
    ) {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json(
      { error: "生成服务暂时不可用，请检查环境变量和服务日志。" },
      { status: 500 }
    );
  }
}
