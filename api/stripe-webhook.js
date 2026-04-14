import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabaseAdmin = createClient(
  process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

async function readRawBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  let event;

  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers["stripe-signature"];

    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        if (session.mode === "subscription") {
          const clerkUserId =
            session.client_reference_id || session.metadata?.clerk_user_id;

          if (clerkUserId) {
            await supabaseAdmin.from("user_usage").upsert({
              user_id: clerkUserId,
              plan: "premium",
              stripe_customer_id: session.customer || null,
              stripe_subscription_id: session.subscription || null,
              updated_at: new Date().toISOString()
            });
          }
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const subscriptionStatus = subscription.status;

        const nextPlan =
          subscriptionStatus === "active" || subscriptionStatus === "trialing"
            ? "premium"
            : "free";

        const clerkUserId = subscription.metadata?.clerk_user_id || null;

        if (clerkUserId) {
          await supabaseAdmin
            .from("user_usage")
            .upsert({
              user_id: clerkUserId,
              plan: nextPlan,
              stripe_customer_id: subscription.customer || null,
              stripe_subscription_id: subscription.id || null,
              updated_at: new Date().toISOString()
            });
        } else {
          await supabaseAdmin
            .from("user_usage")
            .update({
              plan: nextPlan,
              updated_at: new Date().toISOString()
            })
            .eq("stripe_subscription_id", subscription.id);
        }

        break;
      }

      default:
        break;
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("stripe-webhook error", error);
    return res.status(500).send("Webhook handler failed");
  }
}