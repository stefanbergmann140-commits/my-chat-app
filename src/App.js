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
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY;

const SUPABASE_JWT_TEMPLATE = "supabase";

const GUEST_LOGIN_PROMPT_AFTER = 5;
const FREE_MESSAGE_LIMIT = 20;
const MOBILE_BREAKPOINT = 768;

/* =========================
   HELPERS
========================= */
function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseSSEEvent(eventBlock) {
  const lines = eventBlock.split("\n");
  let explicitEvent = null;
  const dataLines = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      explicitEvent = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5));
    }
  }

  const rawData = dataLines.join("\n");

  if (!rawData) {
    return {
      event: explicitEvent || "message",
      data: ""
    };
  }

  try {
    const parsed = JSON.parse(rawData);

    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.event === "string"
    ) {
      return {
        event: parsed.event,
        data:
          typeof parsed.data === "string"
            ? parsed.data
            : JSON.stringify(parsed.data ?? "")
      };
    }
  } catch (_) {}

  return {
    event: explicitEvent || "token",
    data: rawData
  };
}

function normalizeMarkdownText(text) {
  if (typeof text !== "string") return "";

  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t");
}

async function uploadFilesToFlowise(files, chatId) {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("files", file);
  });

  formData.append("chatId", chatId);

  const res = await fetch("/api/flowise-upload", {
    method: "POST",
    body: formData
  });

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
      return (
        (await session?.getToken({ template: SUPABASE_JWT_TEMPLATE })) ?? null
      );
    }
  });
}

/* =========================
   ICONS
========================= */
function MicrophoneIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 3a3 3 0 0 0-3 3v6a3 3 0 1 0 6 0V6a3 3 0 0 0-3-3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 10v2a7 7 0 0 1-14 0v-2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 19v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M8 22h8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PaperclipIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M21.44 11.05 12.25 20.24a5.5 5.5 0 0 1-7.78-7.78l9.2-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a1.5 1.5 0 0 1-2.12-2.12l8.49-8.48"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* =========================
   HEADER
========================= */
function Header({ isSignedIn, isMobile, onToggleSidebar }) {
  return (
    <header
      style={{
        ...headerStyles.header,
        ...(isMobile
          ? {
              height: 72,
              padding: "0 14px"
            }
          : {})
      }}
    >
      <div style={headerStyles.leftArea}>
        {isMobile ? (
          <button
            type="button"
            onClick={onToggleSidebar}
            style={headerStyles.menuButton}
            aria-label="Toggle menu"
          >
            ☰
          </button>
        ) : null}

        <div style={headerStyles.container}>
          <h1
            style={{
              ...headerStyles.logo,
              ...(isMobile ? { fontSize: 20 } : {})
            }}
          >
            EDMAI
          </h1>
          <img
            src={headphones}
            alt="Headphones"
            style={{
              ...headerStyles.logoImage,
              ...(isMobile ? { height: 20 } : {})
            }}
          />
        </div>
      </div>

      <div style={headerStyles.userArea}>
        {isSignedIn ? (
          <UserButton
            appearance={{
              elements: {
                avatarBox: {
                  width: isMobile ? 32 : 36,
                  height: isMobile ? 32 : 36
                }
              }
            }}
          />
        ) : (
          <SignInButton mode="modal">
            <button
              style={{
                ...headerStyles.loginButton,
                ...(isMobile
                  ? {
                      padding: "8px 12px",
                      fontSize: 14
                    }
                  : {})
              }}
            >
              Login
            </button>
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
    padding: "0 20px",
    flexShrink: 0
  },

  leftArea: {
    display: "flex",
    alignItems: "center",
    gap: 12
  },

  menuButton: {
    border: "1px solid #2a2a2a",
    background: "#111",
    color: "#fff",
    borderRadius: 8,
    width: 36,
    height: 36,
    cursor: "pointer",
    fontSize: 18
  },

  container: {
    display: "flex",
    alignItems: "center",
    gap: 3
  },

  logo: {
    margin: 0,
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: "1px"
  },

  logoImage: {
    height: 24,
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
function Footer({ isMobile }) {
  const [activeSection, setActiveSection] = useState(null);

  const toggleSection = (section) => {
    setActiveSection((prev) => (prev === section ? null : section));
  };

  return (
    <footer
      style={{
        ...footerStyles.footer,
        ...(isMobile ? { padding: "12px 14px" } : {})
      }}
    >
      <div style={footerStyles.container}>
        <div
          style={{
            ...footerStyles.links,
            ...(isMobile ? { gap: 16 } : {})
          }}
        >
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
          <div
            style={{
              ...footerStyles.panel,
              ...(isMobile
                ? {
                    maxHeight: 220,
                    padding: 14
                  }
                : {})
            }}
          >
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
    padding: "14px 20px",
    flexShrink: 0
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

const markdownStyles = {
  h1: {
    fontSize: 24,
    fontWeight: 700,
    lineHeight: 1.3,
    margin: "0 0 10px 0",
    color: "#1f2937"
  },

  h2: {
    fontSize: 20,
    fontWeight: 600,
    lineHeight: 1.35,
    margin: "16px 0 8px 0",
    color: "#1f2937"
  },

  h3: {
    fontSize: 16,
    fontWeight: 600,
    lineHeight: 1.4,
    margin: "14px 0 6px 0",
    color: "#1f2937"
  },

  p: {
    margin: "0 0 10px 0",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    color: "#111827"
  },

  ul: {
    margin: "0 0 12px 0",
    paddingLeft: 22
  },

  ol: {
    margin: "0 0 12px 0",
    paddingLeft: 22
  },

  li: {
    marginBottom: 6,
    lineHeight: 1.6,
    color: "#111827"
  },

  strong: {
    fontWeight: 600
  },

  em: {
    fontStyle: "italic"
  },

  inlineCode: {
    background: "#f3f4f6",
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    padding: "2px 6px",
    fontSize: "0.95em",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
  },

  pre: {
    background: "#111827",
    color: "#f9fafb",
    padding: 12,
    borderRadius: 8,
    overflowX: "auto",
    margin: "12px 0"
  },

  codeBlock: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 13,
    whiteSpace: "pre-wrap"
  }
};

/* =========================
   APP
========================= */
export default function App() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { session } = useSession();

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= MOBILE_BREAKPOINT;
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const bubbleStyles = useMemo(
    () => ({
      ...styles.bubble,
      ...(isMobile
        ? {
            maxWidth: "92vw",
            padding: 10,
            fontSize: 15
          }
        : {})
    }),
    [isMobile]
  );

  useEffect(() => {
    const handleResize = () => {
      const nextIsMobile = window.innerWidth <= MOBILE_BREAKPOINT;
      setIsMobile(nextIsMobile);
      if (!nextIsMobile) {
        setSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
  }, [supabase, isSignedIn]);

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
    [supabase, isSignedIn]
  );

  const handleUserMessage = useCallback(
    async (text, currentChatId, isFirstMessage, aiMessageId) => {
      let fullText = "";
      let finalMetadata = null;

      try {
        const res = await fetch("/api/flowise", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream"
          },
          body: JSON.stringify({
            question: text,
            chatId: currentChatId,
            streaming: true
          })
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText || "Prediction request failed");
        }

        const contentType = res.headers.get("content-type") || "";

        if (!contentType.includes("text/event-stream") || !res.body) {
          const raw = await res.text();

          let data;
          try {
            data = JSON.parse(raw);
          } catch (_) {
            throw new Error(
              `Expected JSON from /api/flowise, got ${
                contentType || "unknown content-type"
              }: ${raw.slice(0, 120)}`
            );
          }

          const aiText = normalizeMarkdownText(
            data.text || data.answer || data.result || "No response"
          );

          let updatedChat = null;

          setChats((prev) =>
            prev.map((chat) => {
              if (chat.id !== currentChatId) return chat;

              updatedChat = {
                ...chat,
                messages: chat.messages.map((message) =>
                  message.id === aiMessageId
                    ? { ...message, text: aiText }
                    : message
                ),
                title: isFirstMessage
                  ? text.length > 30
                    ? `${text.slice(0, 30)}...`
                    : text
                  : chat.title
              };

              return updatedChat;
            })
          );

          if (updatedChat && isSignedIn) {
            await persistChat(updatedChat);
          }

          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        const applyPartialText = (partialText) => {
          setChats((prev) =>
            prev.map((chat) => {
              if (chat.id !== currentChatId) return chat;

              return {
                ...chat,
                messages: chat.messages.map((message) =>
                  message.id === aiMessageId
                    ? { ...message, text: partialText }
                    : message
                )
              };
            })
          );
        };

        const processEventBlock = (eventBlock) => {
          if (!eventBlock.trim()) return;

          const { event, data } = parseSSEEvent(eventBlock);

          if (!data && event !== "end") return;
          if (event === "start") return;

          if (event === "token" || event === "message") {
            const chunk = normalizeMarkdownText(data);
            fullText += chunk;
            applyPartialText(fullText);
            return;
          }

          if (event === "metadata" || event === "sourceDocuments") {
            try {
              finalMetadata = JSON.parse(data);
            } catch (_) {
              finalMetadata = data;
            }
            return;
          }

          if (event === "error") {
            throw new Error(data || "Streaming error");
          }

          if (event === "end") {
            return;
          }
        };

        while (true) {
          const { value, done } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const eventBlocks = buffer.split("\n\n");
          buffer = eventBlocks.pop() || "";

          for (const block of eventBlocks) {
            processEventBlock(block);
          }
        }

        buffer += decoder.decode();

        if (buffer.trim()) {
          processEventBlock(buffer);
        }

        const finalText = normalizeMarkdownText(fullText) || "No response";

        let updatedChat = null;

        setChats((prev) =>
          prev.map((chat) => {
            if (chat.id !== currentChatId) return chat;

            updatedChat = {
              ...chat,
              messages: chat.messages.map((message) =>
                message.id === aiMessageId
                  ? {
                      ...message,
                      text: finalText,
                      metadata: finalMetadata || message.metadata
                    }
                  : message
              ),
              title: isFirstMessage
                ? text.length > 30
                  ? `${text.slice(0, 30)}...`
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
              messages: chat.messages.map((message) =>
                message.id === aiMessageId
                  ? {
                      ...message,
                      text: `Error generating response${
                        err?.message ? `: ${err.message}` : ""
                      }`
                    }
                  : message
              )
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
      id: createMessageId(),
      role: "user",
      text: `📎 File attached: ${file.name}`
    }));

    const userMessage = input.trim()
      ? {
          id: createMessageId(),
          role: "user",
          text: userText
        }
      : null;

    const aiMessageId = createMessageId();

    const aiPlaceholderMessage = {
      id: aiMessageId,
      role: "ai",
      text: ""
    };

    let updatedChat = null;

    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== currentChatId) return chat;

        updatedChat = {
          ...chat,
          messages: [
            ...chat.messages,
            ...(userMessage ? [userMessage] : []),
            ...uploadPreviewMessages,
            aiPlaceholderMessage
          ]
        };

        return updatedChat;
      })
    );

    setInput("");
    setLoading(true);

    try {
      if (updatedChat && isSignedIn) {
        await persistChat(updatedChat);
      }

      if (pendingUploads.length > 0) {
        await uploadFilesToFlowise(pendingUploads, currentChatId);
      }

      setLoading(false);

      await handleUserMessage(
        userText,
        currentChatId,
        isFirstMessage,
        aiMessageId
      );

      if (isSignedIn) {
        await incrementUsage();
      } else {
        setGuestMessageCount((prev) => prev + 1);
      }
    } catch (err) {
      let erroredChat = null;

      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== currentChatId) return chat;

          erroredChat = {
            ...chat,
            messages: chat.messages.map((message) =>
              message.id === aiMessageId
                ? {
                    ...message,
                    text: `Error${err?.message ? `: ${err.message}` : ""}`
                  }
                : message
            )
          };

          return erroredChat;
        })
      );

      if (erroredChat && isSignedIn) {
        try {
          await persistChat(erroredChat);
        } catch (_) {}
      }
    } finally {
      setPendingUploads([]);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const createNewChat = async () => {
    if (!isLoaded || !isSignedIn || !supabase) return;

    const newChat = {
      id: String(Date.now()),
      title: "New Chat",
      messages: [],
      updated_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase
        .from("chats")
        .insert(newChat)
        .select()
        .single();

      if (error) {
        throw new Error(error.message || "Failed to create chat.");
      }

      setChats((prev) => [data, ...prev]);
      setActiveChatId(data.id);
      setHasStarted(false);
      setInput("");
      setPendingUploads([]);
      if (isMobile) setSidebarOpen(false);

      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    } catch (err) {
      setDbError(err.message || "Failed to create chat.");
    }
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setPendingUploads((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}-${f.size}`));

      const nextFiles = files.filter(
        (file) => !existingKeys.has(`${file.name}-${file.size}`)
      );

      return [...prev, ...nextFiles];
    });

    if (!hasStarted) setHasStarted(true);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const removePendingUpload = (indexToRemove) => {
    setPendingUploads((prev) =>
      prev.filter((_, index) => index !== indexToRemove)
    );

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    inputRef.current?.focus();
  };

  const openChat = (chatId) => {
    if (!isSignedIn) {
      alert("Please log in to access saved chats.");
      return;
    }

    setActiveChatId(chatId);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const showDbLoading = isLoaded && isSignedIn && !dbReady && !dbError;
  const canUseSavedFeatures = isLoaded && isSignedIn && !!supabase;

  return (
    <div style={styles.app}>
      <Header
        isSignedIn={isSignedIn}
        isMobile={isMobile}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
      />

      <div
        style={{
          ...styles.body,
          ...(isMobile ? { overflow: "auto" } : {})
        }}
      >
        {isMobile && sidebarOpen ? (
          <div
            onClick={() => setSidebarOpen(false)}
            style={styles.mobileOverlay}
          />
        ) : null}

        <div
          style={{
            ...styles.sidebar,
            ...(isMobile
              ? {
                  position: "fixed",
                  top: 72,
                  left: 0,
                  bottom: 0,
                  width: "86vw",
                  maxWidth: 360,
                  zIndex: 30,
                  transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
                  transition: "transform 0.2s ease",
                  boxShadow: sidebarOpen
                    ? "0 10px 30px rgba(0,0,0,0.18)"
                    : "none",
                  borderRight: "1px solid #e5e7eb"
                }
              : {})
          }}
        >
          <button
            onClick={() => {
              if (!canUseSavedFeatures) return;
              createNewChat();
            }}
            style={{
              ...styles.newChat,
              opacity: canUseSavedFeatures ? 1 : 0.5,
              cursor: canUseSavedFeatures ? "pointer" : "not-allowed"
            }}
            disabled={!canUseSavedFeatures}
          >
            + New Chat
          </button>

          <input
            type="text"
            value={sessionSearch}
            onChange={(e) => {
              if (!canUseSavedFeatures) return;
              setSessionSearch(e.target.value);
            }}
            placeholder={
              canUseSavedFeatures
                ? "Search sessions..."
                : "Login to search sessions..."
            }
            style={{
              ...styles.searchInput,
              opacity: canUseSavedFeatures ? 1 : 0.5,
              cursor: canUseSavedFeatures ? "text" : "not-allowed"
            }}
            disabled={!canUseSavedFeatures}
          />

          {!isSignedIn ? (
            <div style={styles.infoBox}>
              Chat, voice input, and file upload are free to try. Log in to save
              and search your chats.
            </div>
          ) : null}

          {isSignedIn && usage ? (
            <div style={styles.usageBox}>
              {usage.plan === "premium"
                ? "Premium active"
                : `${usage.message_count} / ${FREE_MESSAGE_LIMIT} free messages used`}
            </div>
          ) : null}

          {dbError ? <div style={styles.errorBox}>{dbError}</div> : null}

          <div style={styles.chatList}>
            {filteredChats.length > 0 ? (
              filteredChats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => openChat(chat.id)}
                  style={{
                    ...styles.chatItem,
                    background:
                      chat.id === activeChatId ? "#e5e7eb" : "transparent",
                    cursor: canUseSavedFeatures ? "pointer" : "not-allowed",
                    opacity: canUseSavedFeatures ? 1 : 0.6
                  }}
                >
                  <div style={styles.chatTitle}>{chat.title}</div>

                  {chat.messages.length > 0 && (
                    <div style={styles.chatPreview}>
                      {chat.messages[chat.messages.length - 1].text}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div style={styles.noResults}>No sessions found</div>
            )}
          </div>
        </div>

        <div
          style={{
            ...styles.main,
            ...(isMobile ? { width: "100%" } : {})
          }}
        >
          {showDbLoading ? (
            <div style={styles.centerState}>Loading your chats...</div>
          ) : (
            <>
              <div
                style={{
                  ...styles.chatArea,
                  flex: hasStarted ? 1 : "unset",
                  maxHeight: hasStarted ? "none" : 300,
                  overflowY: hasStarted ? "auto" : "hidden",
                  ...(isMobile ? { padding: 8 } : {})
                }}
              >
                {activeChat?.messages.map((m, i) => (
                  <div
                    key={m.id || i}
                    style={{
                      display: "flex",
                      justifyContent:
                        m.role === "user" ? "flex-end" : "flex-start",
                      padding: isMobile ? 6 : 10
                    }}
                  >
                    <div
                      style={{
                        ...bubbleStyles,
                        ...(m.role === "user"
                          ? styles.userBubble
                          : styles.aiBubble)
                      }}
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: ({ children }) => (
                            <h1
                              style={{
                                ...markdownStyles.h1,
                                ...(isMobile ? { fontSize: 22 } : {})
                              }}
                            >
                              {children}
                            </h1>
                          ),
                          h2: ({ children }) => (
                            <h2
                              style={{
                                ...markdownStyles.h2,
                                ...(isMobile ? { fontSize: 18 } : {})
                              }}
                            >
                              {children}
                            </h2>
                          ),
                          h3: ({ children }) => (
                            <h3
                              style={{
                                ...markdownStyles.h3,
                                ...(isMobile ? { fontSize: 15 } : {})
                              }}
                            >
                              {children}
                            </h3>
                          ),
                          p: ({ children }) => (
                            <p style={markdownStyles.p}>{children}</p>
                          ),
                          ul: ({ children }) => (
                            <ul style={markdownStyles.ul}>{children}</ul>
                          ),
                          ol: ({ children }) => (
                            <ol style={markdownStyles.ol}>{children}</ol>
                          ),
                          li: ({ children }) => (
                            <li style={markdownStyles.li}>{children}</li>
                          ),
                          strong: ({ children }) => (
                            <strong style={markdownStyles.strong}>
                              {children}
                            </strong>
                          ),
                          em: ({ children }) => (
                            <em style={markdownStyles.em}>{children}</em>
                          ),
                          code({ inline, children }) {
                            if (inline) {
                              return (
                                <code style={markdownStyles.inlineCode}>
                                  {children}
                                </code>
                              );
                            }

                            return (
                              <pre style={markdownStyles.pre}>
                                <code style={markdownStyles.codeBlock}>
                                  {children}
                                </code>
                              </pre>
                            );
                          }
                        }}
                      >
                        {m.text}
                      </ReactMarkdown>
                    </div>
                  </div>
                ))}

                {loading && (
                  <div style={{ padding: 10, opacity: 0.6 }}>
                    Bot is typing...
                  </div>
                )}

                {shouldShowGuestLoginHint ? (
                  <div style={styles.funnelCard}>
                    <div style={styles.funnelTitle}>
                      Save your chats and unlock more free usage
                    </div>
                    <div style={styles.funnelText}>
                      You have already tested EDMAI. Create a free account to
                      save your chats and get {FREE_MESSAGE_LIMIT} free messages
                      per month.
                    </div>
                    <SignInButton mode="modal">
                      <button style={styles.funnelButton}>
                        Create free account
                      </button>
                    </SignInButton>
                  </div>
                ) : null}

                {hasReachedFreeLimit ? (
                  <div style={styles.paywallCard}>
                    <div style={styles.paywallTitle}>Free limit reached</div>
                    <div style={styles.paywallText}>
                      You have used all {FREE_MESSAGE_LIMIT} free messages this
                      month. Upgrade to continue using saved chats.
                    </div>
                    <button
                      style={styles.paywallButton}
                      onClick={openCheckout}
                      disabled={checkoutLoading}
                    >
                      {checkoutLoading
                        ? "Redirecting..."
                        : "Upgrade to Premium — €0.99/month"}
                    </button>
                  </div>
                ) : null}

                <div ref={chatEndRef} />
              </div>

              <div
                style={{
                  ...styles.inputWrapper,
                  justifyContent: "center",
                  alignItems: hasStarted ? "flex-end" : "center",
                  flex: hasStarted ? "unset" : 1,
                  ...(isMobile ? { padding: 10 } : {})
                }}
              >
                <div
                  style={{
                    ...styles.composerWrap,
                    ...(isMobile ? { maxWidth: "100%" } : {})
                  }}
                >
                  {pendingUploads.length > 0 && (
                    <div style={styles.uploadPreviewBar}>
                      {pendingUploads.map((file, index) => (
                        <div
                          key={`${file.name}-${file.size}-${index}`}
                          style={styles.uploadChip}
                        >
                          <span style={styles.uploadChipText}>{file.name}</span>

                          <button
                            onClick={() => removePendingUpload(index)}
                            style={styles.uploadChipRemove}
                            title="Remove"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div
                    style={{
                      ...styles.inputBar,
                      ...(isMobile
                        ? {
                            gap: 8,
                            padding: 8,
                            flexWrap: "wrap",
                            alignItems: "stretch"
                          }
                        : {})
                    }}
                  >
                    <input
                      ref={inputRef}
                      autoFocus
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="What problem are you facing right now producing EDM?"
                      style={{
                        ...styles.input,
                        ...(isMobile
                          ? {
                              minWidth: "100%",
                              width: "100%"
                            }
                          : {})
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") sendMessage();
                      }}
                    />

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        width: isMobile ? "100%" : "auto"
                      }}
                    >
                      <button
                        onClick={toggleRecording}
                        style={{
                          ...styles.iconButton,
                          ...(isRecording ? styles.recordingButton : {}),
                          ...(speechSupported ? {} : styles.disabledButton),
                          ...(isMobile ? { flex: 1 } : {})
                        }}
                        title="Voice input"
                        disabled={!speechSupported}
                        aria-label="Voice input"
                      >
                        <MicrophoneIcon size={18} />
                      </button>

                      <button
                        onClick={() => {
                          fileInputRef.current?.click();
                        }}
                        style={{
                          ...styles.iconButton,
                          ...(isMobile ? { flex: 1 } : {})
                        }}
                        title="Upload file"
                        aria-label="Upload file"
                      >
                        <PaperclipIcon size={18} />
                      </button>

                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        style={{ display: "none" }}
                        onChange={handleFileSelect}
                      />

                      <button
                        onClick={sendMessage}
                        style={{
                          ...styles.button,
                          ...(isMobile ? { flex: 2 } : {})
                        }}
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Footer isMobile={isMobile} />
    </div>
  );
}

/* =========================
   STYLES
========================= */
const styles = {
  app: {
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
    fontFamily: "system-ui",
    background: "#ffffff"
  },

  mobileOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.28)",
    zIndex: 20
  },

  body: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
    minHeight: 0
  },

  sidebar: {
    width: 280,
    borderRight: "1px solid #e5e7eb",
    padding: 12,
    background: "#f7f7f8",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    minHeight: 0
  },

  newChat: {
    width: "100%",
    padding: 10,
    marginBottom: 2,
    borderRadius: 6,
    border: "1px solid #d1d5db",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 600,
    color: "#111827"
  },

  searchInput: {
    width: "100%",
    padding: 10,
    borderRadius: 6,
    border: "1px solid #d1d5db",
    outline: "none",
    boxSizing: "border-box",
    background: "#fff"
  },

  usageBox: {
    padding: 10,
    borderRadius: 8,
    background: "#f9fafb",
    color: "#374151",
    fontSize: 12,
    border: "1px solid #e5e7eb"
  },

  chatList: {
    overflowY: "auto",
    flex: 1,
    paddingRight: 4,
    minHeight: 0
  },

  chatItem: {
    padding: 10,
    borderRadius: 6,
    cursor: "pointer",
    marginBottom: 6,
    border: "1px solid transparent"
  },

  chatTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#111827",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  },

  chatPreview: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  },

  noResults: {
    fontSize: 13,
    color: "#6b7280",
    padding: 10
  },

  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    minWidth: 0,
    minHeight: 0
  },

  chatArea: {
    padding: 10,
    minHeight: 0
  },

  bubble: {
    maxWidth: 700,
    padding: 12,
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    wordBreak: "break-word"
  },

  userBubble: {
    background: "#f3f4f6"
  },

  aiBubble: {
    background: "#fff"
  },

  inputWrapper: {
    display: "flex",
    padding: 20
  },

  composerWrap: {
    width: "100%",
    maxWidth: 900,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 10
  },

  uploadPreviewBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    padding: 10,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    background: "#fff"
  },

  uploadChip: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 999,
    background: "#f3f4f6",
    border: "1px solid #d1d5db",
    maxWidth: "100%"
  },

  uploadChipText: {
    fontSize: 12,
    color: "#111827",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 220
  },

  uploadChipRemove: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 16,
    lineHeight: 1,
    color: "#6b7280",
    padding: 0
  },

  inputBar: {
    display: "flex",
    gap: 10,
    padding: 10,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    background: "#fff",
    width: "100%",
    alignItems: "center"
  },

  input: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    outline: "none",
    minWidth: 0
  },

  button: {
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #111827",
    background: "#111827",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600
  },

  iconButton: {
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    color: "#374151",
    cursor: "pointer",
    fontSize: 16,
    minWidth: 44,
    height: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box"
  },

  recordingButton: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c"
  },

  disabledButton: {
    opacity: 0.5,
    cursor: "not-allowed"
  },

  errorBox: {
    padding: 10,
    borderRadius: 8,
    background: "#fef2f2",
    color: "#991b1b",
    fontSize: 12,
    border: "1px solid #fecaca"
  },

  infoBox: {
    padding: 10,
    borderRadius: 8,
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 12,
    border: "1px solid #bfdbfe"
  },

  centerState: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    color: "#6b7280"
  },

  funnelCard: {
    maxWidth: 700,
    margin: "12px auto 0",
    padding: 16,
    borderRadius: 12,
    border: "1px solid #bfdbfe",
    background: "#eff6ff"
  },

  funnelTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#1e3a8a",
    marginBottom: 6
  },

  funnelText: {
    fontSize: 13,
    color: "#1d4ed8",
    marginBottom: 12
  },

  funnelButton: {
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #1d4ed8",
    background: "#1d4ed8",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600
  },

  paywallCard: {
    maxWidth: 700,
    margin: "12px auto 0",
    padding: 16,
    borderRadius: 12,
    border: "1px solid #fde68a",
    background: "#fffbeb"
  },

  paywallTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#92400e",
    marginBottom: 6
  },

  paywallText: {
    fontSize: 13,
    color: "#b45309",
    marginBottom: 12
  },

  paywallButton: {
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #d97706",
    background: "#d97706",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600
  }
};