import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function App() {

  const [chats, setChats] = useState([
    { id: 1, title: "Neuer Chat", messages: [] }
  ]);
  const [activeChatId, setActiveChatId] = useState(1);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const activeChat = chats.find(c => c.id === activeChatId);

  // =========================
  // SEND HEIGHT TO WIX PARENT (continuous)
  // =========================
  useEffect(() => {
    const sendHeight = () => {
      const height = document.body.scrollHeight;
      window.parent.postMessage({ type: "chat-resize", height }, "*");
    };

    const observer = new ResizeObserver(sendHeight);
    observer.observe(document.body);
    sendHeight();

    return () => observer.disconnect();
  }, []);

  // =========================
  // API CALL
  // =========================
  const handleUserMessage = useCallback(async (text, currentChatId, isFirstMessage) => {
    try {
      const res = await fetch(
        "https://flowise-1-4fly.onrender.com/api/v1/prediction/e20bf3ea-8f22-4c1b-95d0-209df14bd2ed",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: text, chatId: currentChatId })
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

    } catch (err) {
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

  // =========================
  // SEND MESSAGE
  // =========================
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

  // =========================
  // NEW CHAT
  // =========================
  const createNewChat = () => {
    const newChat = { id: Date.now(), title: "Neuer Chat", messages: [] };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
  };

  return (
    <div style={styles.app}>

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

        {/* CHAT AREA — grows naturally, no scroll */}
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
        </div>

        {/* INPUT */}
        <div style={styles.inputWrapper}>
          <div style={styles.inputBar}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              style={styles.input}
              onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
            />
            <button onClick={sendMessage} style={styles.button}>
              Send
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

const styles = {
  app: {
    display: "flex",
    fontFamily: "system-ui",
    background: "#ffffff",
    paddingBottom: 20
  },

  sidebar: {
    width: 260,
    borderRight: "1px solid #e5e7eb",
    padding: 10,
    background: "#f7f7f8",
    flexShrink: 0
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
    flexDirection: "column"
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
    padding: "12px 20px",
    background: "#fff",
    borderTop: "1px solid #e5e7eb"
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
