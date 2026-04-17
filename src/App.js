import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@supabase/supabase-js";
import {
  SignInButton,
  UserButton,
  useSession,
  useUser
} from "@clerk/clerk-react";
import headphones from "./assets/headphones.png";

/* =========================
   CONFIG
========================= */
const FLOWISE_BASE_URL = "https://flowise-production-86eb.up.railway.app/api/v1";
const CHATFLOW_ID = "77fe7e7c-0238-4f2b-a688-abc4e4e2c43c";
const FLOWISE_API_KEY = "";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY;

// Muss exakt zum Clerk JWT Template Namen passen
const SUPABASE_JWT_TEMPLATE = "supabase";

const GUEST_LOGIN_PROMPT_AFTER = 5;
const FREE_MESSAGE_LIMIT = 20;

/* =========================
   HELPERS
========================= */
function getAuthHeaders(extra = {}) {
  const headers = { ...extra };

  if (FLOWISE_API_KEY) {
    headers.Authorization = `Bearer ${FLOWISE_API_KEY}`;
  }

  return headers;
}

async function uploadFilesToFlowise(files, chatId) {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("files", file);
  });

  const res = await fetch(
    `${FLOWISE_BASE_URL}/attachments/${CHATFLOW_ID}/${chatId}`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: formData
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || "Upload failed");
  }

  return await res.json();
}

function createClerkSupabaseClient(session) {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Missing REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_PUBLISHABLE_KEY"
    );
  }

  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    accessToken: async () => {
      // Wichtig: nicht session.getToken() ohne Template
      return (
        (await session?.getToken({ template: SUPABASE_JWT_TEMPLATE })) ?? null
      );
    }
  });
}

/* =========================
   HEADER
========================= */
function Header({ isSignedIn }) {
  return (
    <header style={headerStyles.header}>
      <div style={headerStyles.container}>
        <h1 style={headerStyles.logo}>EDMAI</h1>
        <img
          src={headphones}
          alt="Headphones"
          style={headerStyles.logoImage}
        />
      </div>

      <div style={headerStyles.userArea}>
        {isSignedIn ? (
          <UserButton
            appearance={{
              elements: {
                avatarBox: {
                  width: 36,
                  height: 36
                }
              }
            }}
          />
        ) : (
          <SignInButton mode="modal">
            <button style={headerStyles.loginButton}>Login</button>
          </SignInButton>
        )}
      </div>
    </header>
  );
}

const headerStyles = {
  header: {
    height: 90,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#000",
    borderBottom: "1px solid #111",
    padding: "0 20px"
  },

  container: {
    display: "flex",
    alignItems: "center",
    gap: 12
  },

  logo: {
    margin: 0,
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: "1px"
  },

  logoImage: {
    height: 32,
    width: "auto",
    objectFit: "contain"
  },

  userArea: {
    display: "flex",
    alignItems: "center"
  },

  loginButton: {
    padding: "10px 16px",
    borderRadius: 8,
    border: "1px solid #2a2a2a",
    background: "#fff",
    color: "#111827",
    cursor: "pointer",
    fontWeight: 600
  }
};

/* =========================
   FOOTER
========================= */
function Footer() {
  const [activeSection, setActiveSection] = useState(null);

  const toggleSection = (section) => {
    setActiveSection((prev) => (prev === section ? null : section));
  };

  return (
    <footer style={footerStyles.footer}>
      <div style={footerStyles.container}>
        <div style={footerStyles.links}>
          <button
            type="button"
            onClick={() => toggleSection("support")}
            style={footerStyles.linkButton}
          >
            Support
          </button>

          <button
            type="button"
            onClick={() => toggleSection("about")}
            style={footerStyles.linkButton}
          >
            About us
          </button>

          <button
            type="button"
            onClick={() => toggleSection("privacy")}
            style={footerStyles.linkButton}
          >
            Privacy Policy
          </button>

          <button
            type="button"
            onClick={() => toggleSection("legal")}
            style={footerStyles.linkButton}
          >
            Legal Notice
          </button>
        </div>

        {activeSection && (
          <div style={footerStyles.panel}>
            {activeSection === "support" && (
              <div>
                <h3 style={footerStyles.title}>Support</h3>
                <p style={footerStyles.text}>info@edmai.net</p>
              </div>
            )}

            {activeSection === "about" && (
              <div>
                <h3 style={footerStyles.title}>About us</h3>
                <p style={footerStyles.text}></p>
              </div>
            )}

            {activeSection === "privacy" && (
              <div>
                <h3 style={footerStyles.title}>Privacy Policy</h3>

                <p style={footerStyles.text}>
                  <strong>1. Introduction</strong>
                  <br />
                  This Privacy Policy explains how we collect, use, and protect
                  your personal data when you use our website and chat-based
                  service.
                  <br />
                  By using our service, you agree to the collection and use of
                  information in accordance with this policy.
                </p>

                <p style={footerStyles.text}>
                  <strong>2. Data Controller</strong>
                  <br />
                  The data controller responsible for this website is:
                  <br />
                  Edmai
                  <br />
                  An der Schützenwiese 5, 40231 Düsseldorf
                  <br />
                  Email: info@edmai.net
                </p>

                <p style={footerStyles.text}>
                  <strong>3. Information We Collect</strong>
                  <br />
                  We may collect the following types of personal data:
                  <br />
                  Email address (for account registration and login)
                  <br />
                  Account information (such as user ID)
                  <br />
                  Chat messages and inputs sent to the AI chat agent
                  <br />
                  Usage data (such as browser type, device information, and
                  interaction logs)
                  <br />
                  IP address and approximate location (for security and analytics
                  purposes)
                </p>

                <p style={footerStyles.text}>
                  <strong>4. How We Use Your Data</strong>
                  <br />
                  We use your data for the following purposes:
                  <br />
                  To provide and maintain the chat service
                  <br />
                  To allow user authentication and account access
                  <br />
                  To generate AI-based responses in the chat
                  <br />
                  To improve and optimize our service
                  <br />
                  To ensure security and prevent misuse
                  <br />
                  To comply with legal obligations
                </p>

                <p style={footerStyles.text}>
                  <strong>5. AI Chat Processing</strong>
                  <br />
                  Our platform uses an AI-based chat system.
                  <br />
                  When you send messages to the chat agent:
                  <br />
                  Your input is processed by automated systems to generate
                  responses
                  <br />
                  Messages may be temporarily stored to provide context and
                  improve interaction quality
                  <br />
                  You should avoid entering sensitive personal data (such as
                  health, financial, or identity-related information)
                </p>

                <p style={footerStyles.text}>
                  <strong>6. Legal Basis for Processing (GDPR)</strong>
                  <br />
                  We process your personal data based on the following legal
                  grounds:
                  <br />
                  Contract: to provide access to the service
                  <br />
                  Consent: where you have given permission (e.g., cookies)
                  <br />
                  Legitimate interest: for security, improvement, and fraud
                  prevention
                </p>

                <p style={footerStyles.text}>
                  <strong>7. Cookies and Tracking</strong>
                  <br />
                  We may use cookies and similar technologies to:
                  <br />
                  Enable login sessions
                  <br />
                  Improve user experience
                  <br />
                  Analyze website usage
                  <br />
                  You can manage or disable cookies through your browser settings
                  or via our cookie banner (if applicable).
                </p>

                <p style={footerStyles.text}>
                  <strong>8. Data Sharing</strong>
                  <br />
                  We may share your data with trusted third-party providers,
                  including:
                  <br />
                  Hosting providers
                  <br />
                  Authentication services
                  <br />
                  AI processing providers (for generating chat responses)
                  <br />
                  Analytics tools (if used)
                  <br />
                  These providers are only allowed to process data on our behalf
                  and are required to comply with data protection regulations.
                </p>

                <p style={footerStyles.text}>
                  <strong>9. International Data Transfers</strong>
                  <br />
                  Some of our service providers may be located outside the
                  European Union (e.g., in the United States).
                  <br />
                  In such cases, we ensure appropriate safeguards such as
                  Standard Contractual Clauses (SCCs) to protect your data.
                </p>

                <p style={footerStyles.text}>
                  <strong>10. Data Retention</strong>
                  <br />
                  We retain personal data only as long as necessary for the
                  purposes described in this policy:
                  <br />
                  Account data is stored as long as the account is active
                  <br />
                  Chat logs may be stored temporarily to improve system
                  performance
                  <br />
                  Logs may be deleted or anonymized after a defined period
                </p>

                <p style={footerStyles.text}>
                  <strong>11. Your Rights (GDPR)</strong>
                  <br />
                  You have the following rights regarding your personal data:
                  <br />
                  Right to access your data
                  <br />
                  Right to rectification of incorrect data
                  <br />
                  Right to deletion (“right to be forgotten”)
                  <br />
                  Right to restrict processing
                  <br />
                  Right to data portability
                  <br />
                  Right to object to processing
                  <br />
                  To exercise these rights, contact us at: info@edmai.net
                </p>

                <p style={footerStyles.text}>
                  <strong>12. Security</strong>
                  <br />
                  We take appropriate technical and organizational measures to
                  protect your data against unauthorized access, loss, or misuse.
                </p>

                <p style={footerStyles.text}>
                  <strong>13. Changes to This Privacy Policy</strong>
                  <br />
                  We may update this Privacy Policy from time to time. Updates
                  will be posted on this page with a revised “last updated” date.
                </p>

                <p style={footerStyles.text}>
                  <strong>14. Contact</strong>
                  <br />
                  If you have any questions about this Privacy Policy or your
                  data, please contact us:
                  <br />
                  Email: info@edmai.net
                </p>
              </div>
            )}

            {activeSection === "legal" && (
              <div>
                <h3 style={footerStyles.title}>Legal Notice</h3>
                <p style={footerStyles.text}>
                  EDMAI
                  <br />
                  An der Schützenwiese 5
                  <br />
                  40231 Düsseldorf
                  <br />
                  <br />
                  info@edmai.net
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </footer>
  );
}

const footerStyles = {
  footer: {
    background: "#000",
    borderTop: "1px solid #111",
    padding: "14px 20px"
  },

  container: {
    maxWidth: 1100,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 14
  },

  links: {
    display: "flex",
    gap: 25,
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap"
  },

  linkButton: {
    color: "#ffffff",
    background: "transparent",
    border: "none",
    textDecoration: "none",
    fontSize: 12,
    opacity: 1,
    cursor: "pointer",
    padding: 0
  },

  panel: {
    background: "#0f0f0f",
    border: "1px solid #1f1f1f",
    borderRadius: 10,
    padding: 16,
    maxHeight: 260,
    overflowY: "auto"
  },

  title: {
    color: "#fff",
    fontSize: 16,
    marginTop: 0,
    marginBottom: 12
  },

  text: {
    color: "#d1d5db",
    fontSize: 13,
    lineHeight: 1.6,
    margin: "0 0 14px 0"
  }
};

/* =========================
   APP
========================= */
export default function App() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { session } = useSession();

  const supabase = useMemo(() => {
    if (!isLoaded || !session || !isSignedIn) return null;
    return createClerkSupabaseClient(session);
  }, [isLoaded, session, isSignedIn]);

  const [chats, setChats] = useState([
    { id: "guest-1", title: "New Chat", messages: [] }
  ]);
  const [activeChatId, setActiveChatId] = useState("guest-1");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [sessionSearch, setSessionSearch] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [pendingUploads, setPendingUploads] = useState([]);
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState("");
  const [guestMessageCount, setGuestMessageCount] = useState(0);
  const [usage, setUsage] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const inputRef = useRef(null);

  const activeChat = chats.find((c) => c.id === activeChatId) || null;

  const filteredChats = useMemo(() => {
    const query = sessionSearch.trim().toLowerCase();

    if (!query) return chats;

    return chats.filter((chat) => {
      const titleMatch = (chat.title || "").toLowerCase().includes(query);

      const messageMatch = (chat.messages || []).some((message) =>
        String(message.text || "").toLowerCase().includes(query)
      );

      return titleMatch || messageMatch;
    });
  }, [chats, sessionSearch]);

  const shouldShowGuestLoginHint =
    !isSignedIn && guestMessageCount >= GUEST_LOGIN_PROMPT_AFTER;

  const hasReachedFreeLimit =
    isSignedIn &&
    usage &&
    usage.plan !== "premium" &&
    usage.message_count >= FREE_MESSAGE_LIMIT;

  const ensureUsageRow = useCallback(async () => {
    if (!supabase || !isSignedIn || !user?.id) return null;

    const { data, error } = await supabase
      .from("user_usage")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || "Failed to load usage.");
    }

    if (data) {
      return data;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("user_usage")
      .insert({
        user_id: user.id,
        message_count: 0,
        plan: "free"
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(insertError.message || "Failed to create usage row.");
    }

    return inserted;
  }, [supabase, isSignedIn, user?.id]);

  const loadUsage = useCallback(async () => {
    if (!supabase || !isSignedIn || !user?.id) return;

    try {
      const usageRow = await ensureUsageRow();
      setUsage(usageRow);
    } catch (err) {
      setDbError(err.message || "Failed to load usage.");
    }
  }, [supabase, isSignedIn, user?.id, ensureUsageRow]);

  const incrementUsage = useCallback(async () => {
    if (!supabase || !isSignedIn || !user?.id) return;

    const currentUsage = usage || (await ensureUsageRow());
    if (!currentUsage) return;

    if (currentUsage.plan === "premium") {
      setUsage(currentUsage);
      return;
    }

    const nextCount = (currentUsage.message_count || 0) + 1;

    const { data, error } = await supabase
      .from("user_usage")
      .update({
        message_count: nextCount,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message || "Failed to update usage.");
    }

    setUsage(data);
  }, [supabase, isSignedIn, user?.id, usage, ensureUsageRow]);

  const loadChats = useCallback(async () => {
    if (!supabase || !isSignedIn) return;

    setDbError("");

    const { data, error } = await supabase
      .from("chats")
      .select("id, user_id, title, messages, created_at, updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      setDbError(error.message || "Failed to load chats.");
      setDbReady(true);
      return;
    }

    const safeChats = Array.isArray(data) ? data : [];

    if (safeChats.length > 0) {
      setChats(safeChats);
      setActiveChatId(safeChats[0].id);
      setHasStarted(
        safeChats.some(
          (chat) => Array.isArray(chat.messages) && chat.messages.length > 0
        )
      );
      setDbReady(true);
      return;
    }

    const starterChat = {
      id: String(Date.now()),
      user_id: user?.id || "",
      title: "New Chat",
      messages: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: inserted, error: insertError } = await supabase
      .from("chats")
      .insert(starterChat)
      .select()
      .single();

    if (insertError) {
      setDbError(insertError.message || "Failed to create starter chat.");
      setDbReady(true);
      return;
    }

    setChats([inserted]);
    setActiveChatId(inserted.id);
    setHasStarted(false);
    setDbReady(true);
  }, [supabase, isSignedIn, user?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, activeChatId, loading]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      window.parent.postMessage(
        { type: "chat-resize", height: document.body.scrollHeight },
        "*"
      );
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeChatId]);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    setSpeechSupported(true);

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event) => {
      let transcript = "";

      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }

      setInput(transcript.trim());
    };

    recognition.onerror = () => {
      setIsRecording(false);
      inputRef.current?.focus();
    };

    recognition.onend = () => {
      setIsRecording(false);
      inputRef.current?.focus();
    };

    recognitionRef.current = recognition;
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn && supabase) {
      loadChats();
      loadUsage();
    } else {
      setChats([{ id: "guest-1", title: "New Chat", messages: [] }]);
      setActiveChatId("guest-1");
      setHasStarted(false);
      setDbReady(false);
      setDbError("");
      setPendingUploads([]);
      setSessionSearch("");
      setUsage(null);
    }
  }, [isLoaded, isSignedIn, supabase, loadChats, loadUsage]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");

    if (!checkout) return;

    if (checkout === "success") {
      setDbError("");
      if (isSignedIn && supabase) {
        loadUsage();
      }
      alert("Payment successful. Premium will be activated shortly.");
    }

    if (checkout === "cancelled") {
      alert("Checkout was cancelled.");
    }

    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, "", cleanUrl);
  }, [isSignedIn, supabase, loadUsage]);

  const persistChat = useCallback(
    async (chat) => {
      if (!supabase || !isSignedIn || !chat) return;

      const payload = {
        id: chat.id,
        user_id: chat.user_id || user?.id || null,
        title: chat.title || "New Chat",
        messages: chat.messages || [],
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from("chats")
        .upsert(payload)
        .select()
        .single();

      if (error) {
        throw new Error(error.message || "Failed to save chat.");
      }

      return data;
    },
    [supabase, isSignedIn, user?.id]
  );

  const handleUserMessage = useCallback(
    async (text, currentChatId, isFirstMessage) => {
      try {
        const res = await fetch(
          `${FLOWISE_BASE_URL}/prediction/${CHATFLOW_ID}`,
          {
            method: "POST",
            headers: getAuthHeaders({
              "Content-Type": "application/json"
            }),
            body: JSON.stringify({
              question: text,
              chatId: currentChatId
            })
          }
        );

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText || "Prediction request failed");
        }

        const data = await res.json();
        const aiText = data.text || data.answer || "No response";

        let updatedChat = null;

        setChats((prev) =>
          prev.map((chat) => {
            if (chat.id !== currentChatId) return chat;

            updatedChat = {
              ...chat,
              messages: [...chat.messages, { role: "ai", text: aiText }],
              title: isFirstMessage
                ? text.length > 30
                  ? text.slice(0, 30) + "..."
                  : text
                : chat.title
            };

            return updatedChat;
          })
        );

        if (updatedChat && isSignedIn) {
          await persistChat(updatedChat);
        }
      } catch (err) {
        let erroredChat = null;

        setChats((prev) =>
          prev.map((chat) => {
            if (chat.id !== currentChatId) return chat;

            erroredChat = {
              ...chat,
              messages: [
                ...chat.messages,
                {
                  role: "ai",
                  text: `Error generating response${
                    err?.message ? `: ${err.message}` : ""
                  }`
                }
              ]
            };

            return erroredChat;
          })
        );

        if (erroredChat && isSignedIn) {
          try {
            await persistChat(erroredChat);
          } catch (_) {}
        }
      }
    },
    [persistChat, isSignedIn]
  );

  const openCheckout = async () => {
    if (!isSignedIn) {
      alert("Please log in first to upgrade.");
      return;
    }

    if (!session) {
      alert("Missing session. Please try again.");
      return;
    }

    try {
      setCheckoutLoading(true);

      // Das hier nur ändern, wenn dein Backend ebenfalls ein spezielles Clerk-Template erwartet.
      const token = await session.getToken();

      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to start checkout");
      }

      window.location.href = data.url;
    } catch (err) {
      alert(err?.message || "Checkout failed");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!activeChat) return;
    if ((!input.trim() && pendingUploads.length === 0) || loading) return;

    if (hasReachedFreeLimit) {
      alert(
        "You have used all 20 free messages this month. Please upgrade to continue."
      );
      return;
    }

    if (!hasStarted) setHasStarted(true);

    const userText =
      input.trim() ||
      (pendingUploads.length > 0
        ? "Please analyze the uploaded files."
        : "");

    const currentChatId = activeChatId;
    const isFirstMessage = activeChat.messages.length === 0;

    const uploadPreviewMessages = pendingUploads.map((file) => ({
      role: "user",
      text: `📎 File attached: ${file.name}`
    }));

    let updatedChat = null;

    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== currentChatId) return chat;

        updatedChat = {
          ...chat,
          user_id: chat.user_id || user?.id || chat.user_id,
          messages: [
            ...chat.messages,
            ...(input.trim() ? [{ role: "user", text: userText }] : []),
            ...uploadPreviewMessages
          ]
        };

        return updatedChat