import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* =========================
   HEADER
========================= */
function Header() {
  return (
    <header style={headerStyles.header}>
      <div style={headerStyles.container}>
        <h1 style={headerStyles.logo}>EDMAI</h1>

        <span style={headerStyles.subtitle}>
          The worlds first EDM AI Agent
        </span>
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
    alignItems: "baseline",
    gap: 20
  },

  logo: {
    margin: 0,
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: "1px"
  },

  subtitle: {
    fontSize: 30,
    fontWeight: "600",
    color: "#fff",
    margin: 0
  }
};

/* =========================
   FOOTER
========================= */
function Footer() {
  return (
    <footer style={footerStyles.footer}>
      <div style={footerStyles.links}>
        <a href="#" style={footerStyles.link}>Imprint</a>
        <a href="#" style={footerStyles.link}>Privacy</a>
        <a href="#" style={footerStyles.link}>Legal Policy</a>
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
    { id: 1, title: "Neuer Chat", messages: [] }
  ]);

  const [activeChatId, setActiveChatId] = useState(1);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const chatEndRef = useRef(null);

  const activeChat = chats.find(c => c.id === activeChatId);

  /* =========================
     AUTO SCROLL
  ========================= */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats]);

  /* =========================
     HEIGHT REPORTING
  ========================= */
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

  /* =========================
     API CALL
  ========================= */
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
            messages: [
              ...chat.messages,
              { role: "ai", text: aiText }
            ],
            title: isFirstMessage
              ? (text.length > 30 ? text.slice(0, 30) + "..." : text)
              : chat.title
          };
        })
      );

    } catch (err) {
      setChats(prev =>
        prev.map(chat =>
          chat.id === currentChatId
            ? {
                ...chat,
                messages: [
                  ...chat.messages,
                  { role: "ai", text: "Error generating response" }
                ]
              }
            : chat
        )
      );
    }

    setLoading(false);
  }, []);

  /* =========================
     SEND MESSAGE
  ========================= */
  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    if (!hasStarted) setHasStarted(true);

    const userText = input;
    const currentChatId = activeChatId;
    const isFirstMessage = activeChat?.messages.length === 0;

    setChats(prev =>
      prev.map(chat =>
        chat.id === currentChatId
          ? {
              ...chat,
              messages: [
                ...chat.messages,
                { role: "user", text: userText }
              ]
            }
          : chat
      )
    );

    setInput("");
    setLoading(true);

    await handleUserMessage(userText, currentChatId, isFirstMessage);
  };

  /* =========================
     NEW CHAT
  ========================= */
  const createNewChat = () => {
    const newChat = {
      id: Date.now(),
      title: "Neuer Chat",
      messages: []
    };

    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setHasStarted(false);
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

        {/* MAIN */}
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

          <div
            style={{
              ...styles.inputWrapper,
              justifyContent: "center",
              alignItems: hasStarted ? "flex-end" : "center",
              flex: hasStarted ? "unset" : 1
            }}
          >
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
    width: 260,
    borderRight: "1px solid #e5e7eb",
    padding: 10,
    background: "#f7f7f8"
  },

  newChat: {
    width: "100%",
    padding: 10,
    marginBottom: 10,
    borderRadius: 6,
    border: "1px solid #d1d5db",
    background: "#fff",
    cursor: "pointer"
  },

  chatItem: {
    padding: 10,
    borderRadius: 6,
    cursor: "pointer"
  },

  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center"
  },

  chatArea: {
    padding: 10
  },

  bubble: {
    maxWidth: 700,
    padding: 12,
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    background: "#fff"
  },

  inputWrapper: {
    display: "flex",
    padding: 20
  },

  inputBar: {
    display: "flex",
    gap: 10,
    padding: 10,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    background: "#fff",
    width: "100%",
    maxWidth: 800,
    margin: "0 auto"
  },

  input: {
    flex: 1,
    padding: 10,
    borderRadius: 6,
    border: "1px solid #d1d5db"
  },

  button: {
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    background: "#f3f4f6",
    cursor: "pointer"
  }
};