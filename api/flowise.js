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
    const flowiseBaseUrl = process.env.FLOWISE_BASE_URL;
    const chatflowId = process.env.FLOWISE_CHATFLOW_ID;
    const flowiseApiKey = process.env.FLOWISE_API_KEY;

    if (!flowiseBaseUrl || !chatflowId) {
      return res.status(500).json({
        error: "Missing FLOWISE_BASE_URL or FLOWISE_CHATFLOW_ID"
      });
    }

    const upstreamUrl = `${flowiseBaseUrl}/prediction/${chatflowId}`;

    const headers = {
      "Content-Type": "application/json",
      Accept: "text/event-stream"
    };

    if (flowiseApiKey) {
      headers.Authorization = `Bearer ${flowiseApiKey}`;
    }

    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(req.body)
    });

    res.statusCode = upstream.status;
    res.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") || "text/event-stream"
    );
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    if (!upstream.body) {
      res.end();
      return;
    }

    const reader = upstream.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }

    res.end();
  } catch (error) {
    res.status(500).json({
      error: error.message || "Proxy request failed"
    });
  }
}