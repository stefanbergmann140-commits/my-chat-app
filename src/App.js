import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* =========================
   CONFIG
========================= */
const FLOWISE_BASE_URL = "https://flowise-production-86eb.up.railway.app/api/v1";
const CHATFLOW_ID = "77fe7e7c-0238-4f2b-a688-abc4e4e2c43c";
const FLOWISE_API_KEY = "";

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
    throw new Error(errText || "Upload fehlgeschlagen");
  }

  return await res.json();
}

/* =========================
   HEADER
========================= */
function Header() {
  return (
    <header style={headerStyles.header}>
      <div style={headerStyles.container}>
        <h1 style={headerStyles.logo}>EDMAI</h1>
      </div>
    </header>
  );
}

const headerStyles = {
  header: {
    height: 90,
    display: "flex",
    alignItems: "center",
    background: "#000",
    borderBottom: "1px solid #111",
    padding: "0 20px"
  },

  container: {
    display: "flex",
    alignItems: "center"
  },

  logo: {
    margin: 0,
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: "1px"
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
  const [chats, setChats] = useState([
    { id: "1", title: "Neuer Chat", messages: [] }
  ]);

  const [activeChatId, setActiveChatId] = useState("1");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [sessionSearch, setSessionSearch] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [pendingUploads, setPendingUploads] = useState([]);

  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);

  const activeChat = chats.find((c) => c.id === activeChatId);

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
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    setSpeechSupported(true);

    const recognition = new SpeechRecognition();
    recognition.lang = "de-DE";
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
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
  }, []);

  const filteredChats = useMemo(() => {
    const query = sessionSearch.trim().toLowerCase();

    if (!query) return chats;

    return chats.filter((chat) => {
      const titleMatch = chat.title.toLowerCase().includes(query);

      const messageMatch = chat.messages.some((message) =>
        message.text.toLowerCase().includes(query)
      );

      return titleMatch || messageMatch;
    });
  }, [chats, sessionSearch]);

  const handleUserMessage = useCallback(async (text, currentChatId, isFirstMessage) => {
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
      const aiText = data.text || data.answer || "Keine Antwort";

      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== currentChatId) return chat;

          return {
            ...chat,
            messages: [...chat.messages, { role: "ai", text: aiText }],
            title: isFirstMessage
              ? text.length > 30
                ? text.slice(0, 30) + "..."
                : text
              : chat.title
          };
        })
      );
    } catch (err) {
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === currentChatId
            ? {
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
              }
            : chat
        )
      );
    }
  }, []);

  const sendMessage = async () => {
    if ((!input.trim() && pendingUploads.length === 0) || loading) return;

    if (!hasStarted) setHasStarted(true);

    const userText =
      input.trim() ||
      (pendingUploads.length > 0
        ? "Bitte analysiere die hochgeladenen Dateien."
        : "");

    const currentChatId = activeChatId;
    const isFirstMessage = activeChat?.messages.length === 0;

    const uploadPreviewMessages = pendingUploads.map((file) => ({
      role: "user",
      text: `📎 Datei angehängt: ${file.name}`
    }));

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === currentChatId
          ? {
              ...chat,
              messages: [
                ...chat.messages,
                ...(input.trim() ? [{ role: "user", text: userText }] : []),
                ...uploadPreviewMessages
              ]
            }
          : chat
      )
    );

    setInput("");
    setLoading(true);

    try {
      if (pendingUploads.length > 0) {
        await uploadFilesToFlowise(pendingUploads, currentChatId);
      }

      await handleUserMessage(userText, currentChatId, isFirstMessage);
    } catch (err) {
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === currentChatId
            ? {
                ...chat,
                messages: [
                  ...chat.messages,
                  {
                    role: "ai",
                    text: `Upload Fehler${
                      err?.message ? `: ${err.message}` : ""
                    }`
                  }
                ]
              }
            : chat
        )
      );
    } finally {
      setPendingUploads([]);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setLoading(false);
    }
  };

  const createNewChat = () => {
    const newChat = {
      id: String(Date.now()),
      title: "Neuer Chat",
      messages: []
    };

    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setHasStarted(false);
    setInput("");
    setPendingUploads([]);
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Spracherkennung wird in diesem Browser nicht unterstützt.");
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
  };

  const removePendingUpload = (indexToRemove) => {
    setPendingUploads((prev) =>
      prev.filter((_, index) => index !== indexToRemove)
    );

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div style={styles.app}>
      <Header />

      <div style={styles.body}>
        <div style={styles.sidebar}>
          <button onClick={createNewChat} style={styles.newChat}>
            + Neuer Chat
          </button>

          <input
            type="text"
            value={sessionSearch}
            onChange={(e) => setSessionSearch(e.target.value)}
            placeholder="Sessions durchsuchen..."
            style={styles.searchInput}
          />

          <div style={styles.chatList}>
            {filteredChats.length > 0 ? (
              filteredChats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => setActiveChatId(chat.id)}
                  style={{
                    ...styles.chatItem,
                    background:
                      chat.id === activeChatId ? "#e5e7eb" : "transparent"
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
              <div style={styles.noResults}>Keine Sessions gefunden</div>
            )}
          </div>
        </div>

        <div style={styles.main}>
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
                    ...(m.role === "user" ? styles.userBubble : styles.aiBubble)
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
                        title="Entfernen"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={styles.inputBar}>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message..."
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
                  title="Sprachaufnahme"
                  disabled={!speechSupported}
                >
                  🎤
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={styles.iconButton}
                  title="Datei hochladen"
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
  }
};