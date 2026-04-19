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
    const upstreamUrl =
      "https://flowise-1-4fly.onrender.com/api/v1/prediction/e20bf3ea-8f22-4c1b-95d0-209df14bd2ed";

    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream"
      },
      body: JSON.stringify(req.body)
    });

    const contentType =
      upstream.headers.get("content-type") || "application/json";

    res.statusCode = upstream.status;
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    // ❗ wichtig: wenn KEIN stream kommt → fallback
    if (!upstream.body) {
      const text = await upstream.text();
      res.end(text);
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