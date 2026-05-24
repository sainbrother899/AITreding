// AITradeX Phase 6.9.2 Telegram Alert Edge Function
// Required secrets:
//   TELEGRAM_BOT_TOKEN = your bot token from BotFather
// Optional secrets:
//   TELEGRAM_DEFAULT_CHAT_ID = default admin chat/group id
//   TELEGRAM_SHARED_SECRET = optional x-aitradex-secret header value

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-aitradex-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const expectedSecret = Deno.env.get("TELEGRAM_SHARED_SECRET") || "";
    if (expectedSecret) {
      const gotSecret = req.headers.get("x-aitradex-secret") || "";
      if (gotSecret !== expectedSecret) throw new Error("Invalid Telegram shared secret");
    }

    const token = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN secret missing");

    const body = await req.json().catch(() => ({}));
    const chatId = String(body.chat_id || body.chatId || Deno.env.get("TELEGRAM_DEFAULT_CHAT_ID") || "").trim();
    const text = String(body.text || body.message || "").slice(0, 3900).trim();
    const parseMode = String(body.parse_mode || body.parseMode || "HTML").trim();

    if (!chatId) throw new Error("Telegram chat_id missing");
    if (!text) throw new Error("Telegram message text missing");

    const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });

    const json = await telegramResponse.json().catch(() => ({}));
    return new Response(JSON.stringify({ ok: telegramResponse.ok, telegram: json }), {
      status: telegramResponse.ok ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
