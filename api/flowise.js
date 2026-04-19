export const config = {
  runtime: "nodejs"
};

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const flowiseBaseUrl = process.env.FLOWISE_BASE_URL?.replace(/\/$/, "");
    const chatflowId = process.env.FLOWISE_CHATFLOW_ID;
    const flowiseApiKey = process.env.FLOWISE_API_KEY;

    if (!flowiseBaseUrl || !chatflowId) {
      return res.status(500).json({
        error: "Missing FLOWISE_BASE_URL or FLOWISE_CHATFLOW_ID"
      });
    }

    const upstreamUrl = `${flowiseBaseUrl}/api/v1/prediction/${chatflowId}`;

    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json"
    };

    if (flowiseApiKey) {
      headers.Authorization = `Bearer ${flowiseApiKey}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    let upstream;

    try {
      upstream = await fetch(upstreamUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...req.body,
          streaming: false
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    const raw = await upstream.text();
    const contentType = upstream.headers.get("content-type") || "";

    if (!upstream.ok) {
      return res.status(upstream.status).send(raw);
    }

    if (!contentType.includes("application/json")) {
      return res.status(502).json({
        error: "Flowise returned unexpected content type",
        contentType,
        preview: raw.slice(0, 300)
      });
    }

    return res.status(200).send(raw);
  } catch (error) {
    return res.status(500).json({
      error:
        error.name === "AbortError"
          ? "Flowise request timed out after 60s"
          : error.message || "Proxy request failed"
    });
  }
}