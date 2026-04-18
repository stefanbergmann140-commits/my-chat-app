export const config = {
  runtime: "nodejs"
};

export default async function handler(req, res) {
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

    const formData = req.body;

    const chatId =
      req.query?.chatId ||
      req.headers["x-chat-id"] ||
      null;

    const upstreamUrl = `${flowiseBaseUrl}/attachments/${chatflowId}/${chatId || ""}`;

    const headers = {};

    if (flowiseApiKey) {
      headers.Authorization = `Bearer ${flowiseApiKey}`;
    }

    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers,
      body: formData,
      duplex: "half"
    });

    const contentType =
      upstream.headers.get("content-type") || "application/json";
    const text = await upstream.text();

    res.status(upstream.status);
    res.setHeader("Content-Type", contentType);
    res.send(text);
  } catch (error) {
    res.status(500).json({
      error: error.message || "Upload proxy failed"
    });
  }
}