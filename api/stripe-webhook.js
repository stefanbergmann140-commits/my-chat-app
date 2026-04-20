import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

/**
 * Wichtig für Stripe Webhooks:
 * Der Raw Body muss unverändert gelesen werden.
 */
export const config = {
  api: {
    bodyParser: false
  }
};

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

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("Missing STRIPE_SECRET_KEY");
    return res.status(500).send("Missing STRIPE_SECRET_KEY");
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("Missing STRIPE_WEBHOOK_SECRET");
    return res.status(500).send("Missing STRIPE_WEBHOOK_SECRET");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    return res.status(500).send("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  let event;

  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers["stripe-signature"];

    if (!signature) {
      return res.status(400).send("Missing stripe-signature header");
    }

    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    console.log("Stripe webhook received:", event.type);
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

          console.log("Checkout completed for user:", clerkUserId);

          if (!clerkUserId) {
            console.warn("No Clerk user ID found on checkout session");
            break;
          }

          const { data, error } = await supabaseAdmin
            .from("user_usage")
            .upsert(
              {
                user_id: clerkUserId,
                plan: "premium",
                stripe_customer_id: session.customer || null,
                stripe_subscription_id: session.subscription || null,
                updated_at: new Date().toISOString()
              },
              {
                onConflict: "user_id"
              }
            )
            .select();

          if (error) {
            console.error("Supabase upsert error on checkout completion:", error);
            throw error;
          }

          console.log("Supabase upsert success:", data);
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

        console.log("Subscription event:", {
          type: event.type,
          subscriptionId: subscription.id,
          status: subscriptionStatus,
          nextPlan,
          clerkUserId
        });

        if (clerkUserId) {
          const { data, error } = await supabaseAdmin
            .from("user_usage")
            .upsert(
              {
                user_id: clerkUserId,
                plan: nextPlan,
                stripe_customer_id: subscription.customer || null,
                stripe_subscription_id: subscription.id || null,
                updated_at: new Date().toISOString()
              },
              {
                onConflict: "user_id"
              }
            )
            .select();

          if (error) {
            console.error("Supabase upsert error on subscription event:", error);
            throw error;
          }

          console.log("Supabase subscription upsert success:", data);
        } else {
          const { data, error } = await supabaseAdmin
            .from("user_usage")
            .update({
              plan: nextPlan,
              updated_at: new Date().toISOString()
            })
            .eq("stripe_subscription_id", subscription.id)
            .select();

          if (error) {
            console.error("Fallback subscription update error:", error);
            throw error;
          }

          console.log("Fallback subscription update success:", data);
        }

        break;
      }

      default:
        console.log("Unhandled event type:", event.type);
        break;
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("stripe-webhook handler error:", error);
    return res.status(500).send("Webhook handler failed");
  }
}