import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type PaymentOrder = {
  id: string;
  order_no: string;
  user_id: string;
  amount_yuan: number | string;
  credits: number | string;
  status: string;
};

type ProfileRow = {
  id: string;
  credits: number | string | null;
};

function signPayload(payload: Record<string, string>, secret: string) {
  const source = Object.entries(payload)
    .filter(([key, value]) => key !== "hash" && value !== "" && value !== undefined && value !== null)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return crypto.createHash("md5").update(`${source}${secret}`, "utf8").digest("hex");
}

async function readNotifyPayload(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const data = (await request.json()) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value ?? "")]));
  }

  const text = await request.text();
  const params = new URLSearchParams(text);
  return Object.fromEntries(Array.from(params.entries()));
}

function isPaidStatus(status: string) {
  return ["od", "paid", "success", "1", "ok"].includes(status.trim().toLowerCase());
}

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.XUNHUPAY_APP_SECRET;
    if (!secret) throw new Error("缺少虎皮椒支付密钥。");

    const payload = await readNotifyPayload(request);
    const receivedHash = String(payload.hash ?? "").toLowerCase();
    const expectedHash = signPayload(payload, secret).toLowerCase();

    if (!receivedHash || receivedHash !== expectedHash) {
      console.warn("Xunhupay notify signature mismatch", payload);
      return new NextResponse("fail", { status: 400 });
    }

    const orderNo = String(payload.trade_order_id ?? payload.order_no ?? "").trim();
    const status = String(payload.status ?? payload.trade_status ?? payload.pay_status ?? "").trim();
    const providerOrderId = String(payload.transaction_id ?? payload.open_order_id ?? payload.pay_order_id ?? "").trim();

    if (!orderNo || !isPaidStatus(status)) {
      return new NextResponse("success");
    }

    const supabase = createServiceClient();
    const { data: order, error: orderError } = await supabase
      .from("payment_orders")
      .select("id, order_no, user_id, amount_yuan, credits, status")
      .eq("order_no", orderNo)
      .single();

    if (orderError || !order) {
      console.error("Payment order not found", orderError);
      return new NextResponse("fail", { status: 404 });
    }

    const typedOrder = order as PaymentOrder;
    const notifyAmount = Number(payload.total_fee ?? payload.total_amount ?? payload.money ?? typedOrder.amount_yuan);
    if (Math.abs(notifyAmount - Number(typedOrder.amount_yuan)) > 0.001) {
      console.warn("Payment amount mismatch", { order: typedOrder, payload });
      return new NextResponse("fail", { status: 400 });
    }

    if (typedOrder.status === "paid") {
      return new NextResponse("success");
    }

    const { data: lockedOrder, error: lockError } = await supabase
      .from("payment_orders")
      .update({
        status: "paid",
        provider_order_id: providerOrderId || null,
        raw_notify: payload,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", typedOrder.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (lockError) throw lockError;
    if (!lockedOrder) {
      return new NextResponse("success");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, credits")
      .eq("id", typedOrder.user_id)
      .single();

    if (profileError || !profile) throw profileError ?? new Error("用户不存在。");

    const currentCredits = Number((profile as ProfileRow).credits ?? 0);
    const rechargeCredits = Number(typedOrder.credits);
    const nextCredits = currentCredits + rechargeCredits;

    const { error: updateProfileError } = await supabase
      .from("profiles")
      .update({ credits: nextCredits, updated_at: new Date().toISOString() })
      .eq("id", typedOrder.user_id);

    if (updateProfileError) throw updateProfileError;

    const { error: txError } = await supabase.from("credit_transactions").insert({
      user_id: typedOrder.user_id,
      type: "grant",
      amount: rechargeCredits,
      balance_after: nextCredits,
      note: `微信支付充值 ${rechargeCredits} 积分`
    });

    if (txError) {
      console.error("Recharge credit transaction insert failed", txError);
    }

    return new NextResponse("success");
  } catch (error) {
    console.error(error);
    return new NextResponse("fail", { status: 500 });
  }
}

export async function GET() {
  return new NextResponse("ok");
}
