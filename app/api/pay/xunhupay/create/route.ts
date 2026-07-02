import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAuthClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const rechargePackages = {
  starter: { amount: "9.90", credits: 1000, title: "柯基AI 1000积分套餐" },
  creator: { amount: "19.90", credits: 2000, title: "柯基AI 2000积分套餐" },
  pro: { amount: "29.90", credits: 4000, title: "柯基AI 4000积分套餐" }
} as const;

type PackageId = keyof typeof rechargePackages;

function signPayload(payload: Record<string, string | number>, secret: string) {
  const source = Object.entries(payload)
    .filter(([key, value]) => key !== "hash" && value !== "" && value !== undefined && value !== null)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return crypto.createHash("md5").update(`${source}${secret}`, "utf8").digest("hex");
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

function getConfig() {
  const appid = process.env.XUNHUPAY_APP_ID;
  const secret = process.env.XUNHUPAY_APP_SECRET;
  const gateway = process.env.XUNHUPAY_GATEWAY || "https://api.xunhupay.com/payment/do.html";

  if (!appid || !secret) {
    throw new Error("缺少虎皮椒支付配置。");
  }

  return { appid, secret, gateway };
}

async function getUser(request: NextRequest) {
  const accessToken = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!accessToken) return null;

  const authClient = createAuthClient(accessToken);
  const {
    data: { user },
    error
  } = await authClient.auth.getUser();

  if (error || !user) return null;
  return user;
}

function readPayUrl(payload: unknown) {
  const value = payload as Record<string, unknown>;
  const data = (value.data && typeof value.data === "object" ? value.data : {}) as Record<string, unknown>;
  return String(value.url ?? value.pay_url ?? value.qrcode ?? data.url ?? data.pay_url ?? data.qrcode ?? "");
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "请先登录后再充值。" }, { status: 401 });

    const payload = (await request.json()) as { packageId?: PackageId };
    const packageId = String(payload.packageId ?? "") as PackageId;
    const selectedPackage = rechargePackages[packageId];

    if (!selectedPackage) {
      return NextResponse.json({ error: "充值套餐不存在。" }, { status: 400 });
    }

    const config = getConfig();
    const orderNo = `KJ${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const baseUrl = siteUrl();
    const requestPayload: Record<string, string | number> = {
      version: "1.1",
      appid: config.appid,
      trade_order_id: orderNo,
      payment: "wechat",
      total_fee: selectedPackage.amount,
      title: selectedPackage.title,
      time: Math.floor(Date.now() / 1000),
      notify_url: `${baseUrl}/api/pay/xunhupay/notify`,
      return_url: `${baseUrl}/?payment=success`,
      nonce_str: crypto.randomBytes(12).toString("hex")
    };
    requestPayload.hash = signPayload(requestPayload, config.secret);

    const supabase = createServiceClient();
    const { error: orderError } = await supabase.from("payment_orders").insert({
      order_no: orderNo,
      user_id: user.id,
      provider: "xunhupay",
      package_id: packageId,
      amount_yuan: Number(selectedPackage.amount),
      credits: selectedPackage.credits,
      status: "pending"
    });

    if (orderError) {
      console.error("Payment order create failed", orderError);
      throw new Error("充值订单创建失败，请确认 payment_orders 表已创建。");
    }

    const gatewayResponse = await fetch(config.gateway, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload)
    });
    const gatewayPayload = await gatewayResponse.json().catch(() => ({}));

    if (!gatewayResponse.ok || Number((gatewayPayload as { errcode?: number }).errcode ?? 0) !== 0) {
      console.error("Xunhupay create failed", gatewayPayload);
      throw new Error(String((gatewayPayload as { errmsg?: string; message?: string }).errmsg ?? (gatewayPayload as { message?: string }).message ?? "虎皮椒支付下单失败。"));
    }

    const payUrl = readPayUrl(gatewayPayload);
    if (!payUrl) {
      console.error("Xunhupay response missing pay url", gatewayPayload);
      throw new Error("虎皮椒没有返回支付链接。");
    }

    await supabase.from("payment_orders").update({ pay_url: payUrl, updated_at: new Date().toISOString() }).eq("order_no", orderNo);

    return NextResponse.json({
      orderNo,
      payUrl,
      amount: selectedPackage.amount,
      credits: selectedPackage.credits
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "充值服务暂时不可用。" },
      { status: 500 }
    );
  }
}
