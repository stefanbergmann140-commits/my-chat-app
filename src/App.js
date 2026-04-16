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
      return (await session?.getToken()) ?? null;
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
  return (
    <footer style={footerStyles.footer}>
      <div style={footerStyles.links}>
        <a href="/imprint" style={footerStyles.link}>
          Imprint
        </a>

        <a href="/privacy" style={footerStyles.link}>
          Privacy
        </a>

        <a href="/legal" style={footerStyles.link}>
          Legal Policy
        </a>
      </div>
    </footer>
  );
}

const footerStyles = {
  footer: {
    height: 60,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#000",
    borderTop: "1px solid #111"
  },

  links: {
    display: "flex",
    gap: 25,
    justifyContent: "center",
    alignItems: "center"
  },

  link: {
    color: "#ffffff",
    textDecoration: "none",
    fontSize: 12,
    opacity: 1
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

      await handleUserMessage(userText, currentChatId, isFirstMessage);

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
            messages: [
              ...chat.messages,
              {
                role: "ai",
                text: `Upload error${err?.message ? `: ${err.message}` : ""}`
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
    if (!isLoaded || !isSignedIn || !supabase || !user?.id) return;

    const newChat = {
      id: String(Date.now()),
      user_id: user.id,
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
  };

  const showDbLoading = isLoaded && isSignedIn && !dbReady && !dbError;
  const canUseSavedFeatures = isLoaded && isSignedIn && !!supabase;

  return (
    <div style={styles.app}>
      <Header isSignedIn={isSignedIn} />

      <div style={styles.body}>
        <div style={styles.sidebar}>
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

        <div style={styles.main}>
          {showDbLoading ? (
            <div style={styles.centerState}>Loading your chats...</div>
          ) : (
            <>
              <div
                style={{
                  ...styles.chatArea,
                  flex: hasStarted ? 1 : "unset",
                  maxHeight: hasStarted ? "none" : 300,
                  overflowY: hasStarted ? "auto" : "hidden"
                }}
              >
                {activeChat?.messages.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent:
                        m.role === "user" ? "flex-end" : "flex-start",
                      padding: 10
                    }}
                  >
                    <div
                      style={{
                        ...styles.bubble,
                        ...(m.role === "user"
                          ? styles.userBubble
                          : styles.aiBubble)
                      }}
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
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
                  flex: hasStarted ? "unset" : 1
                }}
              >
                <div style={styles.composerWrap}>
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

                  <div style={styles.inputBar}>
                    <input
                      ref={inputRef}
                      autoFocus
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="What problem are you facing right now producing EDM?"
                      style={styles.input}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") sendMessage();
                      }}
                    />

                    <button
                      onClick={toggleRecording}
                      style={{
                        ...styles.iconButton,
                        ...(isRecording ? styles.recordingButton : {}),
                        ...(speechSupported ? {} : styles.disabledButton)
                      }}
                      title="Voice input"
                      disabled={!speechSupported}
                    >
                      🎤
                    </button>

                    <button
                      onClick={() => {
                        fileInputRef.current?.click();
                      }}
                      style={styles.iconButton}
                      title="Upload file"
                    >
                      📎
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      style={{ display: "none" }}
                      onChange={handleFileSelect}
                    />

                    <button onClick={sendMessage} style={styles.button}>
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Footer />
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
    height: "100vh",
    fontFamily: "system-ui",
    background: "#ffffff"
  },

  body: {
    display: "flex",
    flex: 1,
    overflow: "hidden"
  },

  sidebar: {
    width: 280,
    borderRight: "1px solid #e5e7eb",
    padding: 12,
    background: "#f7f7f8",
    display: "flex",
    flexDirection: "column",
    gap: 10
  },

  newChat: {
    width: "100%",
    padding: 10,
    marginBottom: 2,
    borderRadius: 6,
    border: "1px solid #d1d5db",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 600
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
    paddingRight: 4
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
    minWidth: 0
  },

  chatArea: {
    padding: 10
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
    borderRadius: 6,
    border: "1px solid #d1d5db",
    outline: "none"
  },

  button: {
    padding: "10px 14px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    background: "#f3f4f6",
    cursor: "pointer",
    fontWeight: 600
  },

  iconButton: {
    padding: "10px 12px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    background: "#fff",
    cursor: "pointer",
    fontSize: 16,
    minWidth: 44
  },

  recordingButton: {
    background: "#fee2e2",
    border: "1px solid #ef4444"
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