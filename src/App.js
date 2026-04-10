import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Routes, Route, Link } from "react-router-dom";

/* =========================
   HEADER
========================= */
function Header() {
  return (
    <header style={headerStyles.header}>
      <h2 style={{ margin: 0 }}>💬 Chat App</h2>
    </header>
  );
}

const headerStyles = {
  header: {
    height: 60,
    display: "flex",
    alignItems: "center",
    padding: "0 16px",
    borderBottom: "1px solid #e5e7eb",
    background: "#fff",
    fontWeight: "bold"
  }
};

/* =========================
   FOOTER
========================= */
function Footer() {
  return (
    <footer style={footerStyles.footer}>
      <div style={{ display: "flex", gap: 20 }}>
        <Link style={footerStyles.link} to="/support">Support</Link>
        <Link style={footerStyles.link} to="/privacy">Privacy Policy</Link>
        <Link style={footerStyles.link} to="/legal">Legal Notice</Link>
      </div>
    </footer>
  );
}

const footerStyles = {
  footer: {
    height: 50,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderTop: "1px solid #e5e7eb",
    background: "#fff",
    fontSize: 12,
    color: "#6b7280"
  },
  link: {
    color: "#6b7280",
    textDecoration: "none"
  }
};

/* =========================
   SEITEN
========================= */
function Support() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Support</h1>
      <p>Kontaktiere uns unter: support@example.com</p>
    </div>
  );
}

function PrivacyPolicy() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Privacy Policy</h1>
      <p>Hier steht deine Datenschutzerklärung.</p>
    </div>
  );
}

function LegalNotice() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Legal Notice</h1>
      <p>Hier steht dein Impressum / rechtliche Hinweise.</p>
    </div>
  );
}

/* =========================
   MAIN CHAT LAYOUT
========================= */
function MainLayout() {

  const [chats, setChats] = useState([
    { id: 1, title: "Neuer Chat", messages: [] }
  ]);

  const [activeChatId, setActiveChatId] = useState(1);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const chatEndRef = useRef(null);
  const activeChat = chats.find(c => c.id === activeChatId);

  // AUTO SCROLL
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats]);

  // HEIGHT REPORTING
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

  // API CALL
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
            ? { ...chat, messages: [...chat.messages, { role: "ai", text: "Error generating response" }] }
            : chat
        )
      );
    }

    setLoading(false);
  }, []);

  // SEND MESSAGE
  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userText = input;
    const currentChatId = activeChatId;
    const isFirstMessage = activeChat?.messages.length === 0;

    setChats(prev =>
      prev.map(chat =>
        chat.id === currentChatId
          ? { ...chat, messages: [...chat.messages, { role: "user", text: userText }] }
          : chat
      )
    );

    setInput("");
    setLoading(true);

    await handleUserMessage(userText, currentChatId, isFirstMessage);
  };

  // NEW CHAT
  const createNewChat = () => {
    const newChat = {
      id: Date.now(),
      title: "Neuer Chat",
      messages: []
    };

    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
  };

  return (
    <div style={styles.app}>

      <Header />

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
              <div key={i} style={{
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                padding: 10
              }}>
                <div style={styles.bubble}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {m.text}
                  </ReactMarkdown>
                </div>
              </div>
            ))}

            {loading && <div style={{ padding: 10 }}>Bot is typing...</div>}

            <div ref={chatEndRef} />
          </div>

          <div style={styles.inputWrapper}>
            <div style={styles.inputBar}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type a message..."
                style={styles.input}
              />

              <button onClick={sendMessage} style={styles.button}>
                Send
              </button>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

/* =========================
   ROUTES
========================= */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />} />
      <Route path="/support" element={<Support />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/legal" element={<LegalNotice />} />
    </Routes>
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
    fontFamily: "system-ui"
  },
  body: {
    display: "flex",
    flex: 1,
    overflow: "hidden"
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
    borderRadius: 6,
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
    gap: 10,
    maxWidth: 800,
    margin: "0 auto"
  },
  input: {
    flex: 1,
    padding: 10,
    border: "1px solid #d1d5db"
  },
  button: {
    padding: "8px 12px"
  }
};