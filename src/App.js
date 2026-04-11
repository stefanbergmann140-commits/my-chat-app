import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* =========================
   HEADER
========================= */
function Header() {
  return (
    <div style={styles.header}>
      EDMAI
    </div>
  );
}

export default function App() {

  const [chats, setChats] = useState([
    { id: 1, title: "Neuer Chat", messages: [] }
  ]);

  const [activeChatId, setActiveChatId] = useState(1);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState("chat");

  const chatEndRef = useRef(null);
  const activeChat = chats.find(c => c.id === activeChatId);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats]);

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

  const handleUserMessage = useCallback(async (text, currentChatId, isFirstMessage) => {
    try {
      const res = await fetch(
        "https://flowise-1-4fly.onrender.com/api/v1/prediction/e20bf3ea-8f22-4c1b-95d0-209df14bd2ed",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: text,
            chatId: currentChatId
          })
        }
      );

      const data = await res.json();
      const aiText = data.text || data.answer || "Keine Antwort";

      setChats(prev =>
        prev.map(chat => {
          if (chat.id !== currentChatId) return chat;

          return {
            ...chat,
            messages: [...chat.messages, { role: "ai", text: aiText }],
            title: isFirstMessage
              ? (text.length > 30 ? text.slice(0, 30) + "..." : text)
              : chat.title
          };
        })
      );

    } catch {
      setChats(prev =>
        prev.map(chat =>
          chat.id === currentChatId
            ? {
                ...chat,
                messages: [...chat.messages, { role: "ai", text: "Error generating response" }]
              }
            : chat
        )
      );
    }

    setLoading(false);
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userText = input;
    const currentChatId = activeChatId;
    const isFirstMessage = activeChat?.messages.length === 0;

    setChats(prev =>
      prev.map(chat =>
        chat.id === currentChatId
          ? {
              ...chat,
              messages: [...chat.messages, { role: "user", text: userText }]
            }
          : chat
      )
    );

    setInput("");
    setLoading(true);

    await handleUserMessage(userText, currentChatId, isFirstMessage);
  };

  const createNewChat = () => {
    const newChat = {
      id: Date.now(),
      title: "Neuer Chat",
      messages: []
    };

    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setPage("chat");
  };

  /* =========================
     SEITEN RENDER
  ========================= */
  const renderPage = () => {

    if (page === "support") {
      return (
        <div style={styles.page}>
          <h2>Support</h2>
          <p>Kontakt: support@example.com</p>
          <button onClick={() => setPage("chat")}>← Zurück</button>
        </div>
      );
    }

    if (page === "privacy") {
      return (
        <div style={styles.page}>
          <h2>Privacy Policy</h2>
          <p>Hier steht deine Datenschutzerklärung.</p>
          <button onClick={() => setPage("chat")}>← Zurück</button>
        </div>
      );
    }

    if (page === "legal") {
      return (
        <div style={styles.page}>
          <h2>Legal Notice</h2>
          <p>Impressum / rechtliche Hinweise.</p>
          <button onClick={() => setPage("chat")}>← Zurück</button>
        </div>
      );
    }

    return (
      <div style={styles.body}>

        {/* SIDEBAR */}
        <div style={styles.sidebar}>
          <button onClick={createNewChat} style={styles.newChat}>
            + Neuer Chat
          </button>

          {chats.map(chat => (
            <div
              key={chat.id}
              onClick={() => setActiveChatId(chat.id)}
              style={{
                ...styles.chatItem,
                background: chat.id === activeChatId ? "#e5e7eb" : "transparent"
              }}
            >
              {chat.title}
            </div>
          ))}
        </div>

        {/* CHAT */}
        <div style={styles.main}>

          <div style={styles.chatArea}>
            {activeChat?.messages.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                  padding: 10
                }}
              >
                <div style={styles.bubble}>
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

          <div style={styles.inputWrapper}>
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

              <button onClick={sendMessage} style={styles.button}>
                Send
              </button>

            </div>
          </div>

        </div>
      </div>
    );
  };

  return (
    <div style={styles.app}>

      <Header />

      {renderPage()}

      {/* FOOTER */}
      <div style={styles.footer}>
        <button onClick={() => setPage("support")} style={styles.link}>Support</button>
        <button onClick={() => setPage("privacy")} style={styles.link}>Privacy Policy</button>
        <button onClick={() => setPage("legal")} style={styles.link}>Legal Notice</button>
      </div>

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

  header: {
    height: 60,
    background: "#000",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    paddingLeft: 20,
    fontSize: 26,
    fontWeight: 600,
    fontFamily: "Poppins, sans-serif"
  },

  body: {
    display: "flex",
    flex: 1
  },

  sidebar: {
    width: 260,
    borderRight: "1px solid #e5e7eb",
    padding: 10,
    background: "#f7f7f8"
  },

  newChat: {
    width: "100%",
    padding: 10,
    marginBottom: 10
  },

  chatItem: {
    padding: 10,
    cursor: "pointer"
  },

  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column"
  },

  chatArea: {
    flex: 1,
    overflowY: "auto",
    padding: 10
  },

  bubble: {
    maxWidth: 700,
    padding: 12,
    border: "1px solid #e5e7eb",
    borderRadius: 8
  },

  inputWrapper: {
    padding: 20
  },

  inputBar: {
    display: "flex",
    gap: 10
  },

  input: {
    flex: 1,
    padding: 10
  },

  button: {
    padding: "8px 12px"
  },

  footer: {
    borderTop: "1px solid #e5e7eb",
    padding: 10,
    display: "flex",
    justifyContent: "center",
    gap: 20
  },

  link: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    color: "#555"
  },

  page: {
    padding: 20
  }
};