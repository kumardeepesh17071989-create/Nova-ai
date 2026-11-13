// NOVA AI 2.0 — Cloudflare Worker proxy
// Keep GEMINI_API_KEY in Worker > Settings > Variables and Secrets > Secret.
const ALLOWED_ORIGIN = "https://kumardeepesh17071989-create.github.io";

function json(data, status, origin = ALLOWED_ORIGIN) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (origin !== ALLOWED_ORIGIN) return new Response("Forbidden", { status: 403 });

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin"
        }
      });
    }
    if (request.method !== "POST") return json({ error: "Use POST." }, 405);
    if (!env.GEMINI_API_KEY) return json({ error: "Server AI key is not configured." }, 503);

    try {
      const body = await request.json();
      const messages = Array.isArray(body.messages) ? body.messages : [];
      if (!messages.length || messages.length > 12) return json({ error: "Send between 1 and 12 messages." }, 400);

      const contents = messages.map(m => ({
        role: m.role === "model" ? "model" : "user",
        parts: [{ text: String(m.text || "").slice(0, 4000) }]
      })).filter(m => m.parts[0].text.trim());

      if (!contents.length) return json({ error: "Message is empty." }, 400);

      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY
          },
          body: JSON.stringify({
            system_instruction: {
              parts: [{
                text: "You are NOVA, Mahesh's personal AI assistant. Reply naturally in the language the user uses, including Hindi and Hinglish. Help with planning, learning, finance education and trading research. Do not claim live market data unless current data is provided. Never guarantee profits, never place trades, and explain financial risks clearly. Be useful, accurate, practical and concise."
              }]
            },
            contents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
          })
        }
      );
      const data = await response.json();
      if (!response.ok) return json({ error: data?.error?.message || "AI provider request failed." }, response.status);
      const reply = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim();
      if (!reply) return json({ error: "AI returned no text. Try again." }, 502);
      return json({ reply }, 200);
    } catch {
      return json({ error: "Invalid request or network error." }, 400);
    }
  }
};