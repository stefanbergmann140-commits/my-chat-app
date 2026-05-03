import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function getBaseUrl(req) {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  const protocol =
    req.headers["x-forwarded-proto"] ||
    (process.env.NODE_ENV === "production" ? "https" : "http");

  const host = req.headers.host;

  return `${protocol}://${host}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({
        error: "Missing STRIPE_SECRET_KEY"
      });
    }

    if (!process.env.STRIPE_PRICE_ID) {
      return res.status(500).json({
        error: "Missing STRIPE_PRICE_ID"
      });
    }

    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Missing or invalid Authorization header"
      });
    }

    const token = authHeader.slice("Bearer ".length).trim();

    if (!token) {
      return res.status(401).json({
        error: "Missing auth token"
      });
    }

    let clerkUserId = null;

    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(
          Buffer.from(parts[1], "base64url").toString("utf8")
        );
        clerkUserId = payload.sub || null;
      }
    } catch (_) {}

    if (!clerkUserId) {
      return res.status(401).json({
        error: "Could not determine Clerk user ID from token"
      });
    }

    const baseUrl = getBaseUrl(req);

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",

      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1
        }
      ],

      success_url: `${baseUrl}/?checkout=success`,
      cancel_url: `${baseUrl}/?checkout=cancelled`,

      client_reference_id: clerkUserId,

      metadata: {
        clerk_user_id: clerkUserId
      },

      subscription_data: {
        metadata: {
          clerk_user_id: clerkUserId
        }
      },

      allow_promotion_codes: true
    });

    return res.status(200).json({
      url: checkoutSession.url
    });
  } catch (error) {
    console.error("create-checkout-session error:", error);

    return res.status(500).json({
      error: error?.message || "Failed to create checkout session"
    });
  }
}