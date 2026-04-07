import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function App() {

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatId = useRef(Date.now());

  // =========================
  // RESIZE IFRAME VIA postMessage
  // =========================
  useEffect(() => {
    const height = document.documentElement.scrollHeight;
    window.parent.postMessage({ type: "chat-resize", height }, "*");
  }, [messages, loading]);

  // =========================
  // API CALL
  // =========================
  const handleUserMessage = useCallback(async (text) => {
    try {
      const res = await fetch(
        "https://flowise-1-4fly.onrender.com/api/v1/prediction/e20bf3ea-8f22-4c1b-95d0-209df14bd2ed",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: text, chatId: chatId.current })
        }
      );

      const data = await res.json();
      const aiText = data.text || data.answer || "Keine Antwort";

      setMessages(prev => [...prev, { role: "ai", text: aiText }]);

    } catch (err) {
      setMessages(prev => [...prev, { role: "ai", text: "Error generating response" }]);
    }

    setLoading(false);
  }, []);

  // =========================
  // SEND MESSAGE
  // =========================
  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userText = input;
    setMessages(prev => [...prev, { role: "user", text: userText }]);
    setInput("");
    setLoading(true);
    await handleUserMessage(userText);
  };

  return (
    <div style={styles.app}>

      {/* CHAT AREA — grows with content */}
      <div style={styles.chatArea}>
        {messages.map((m, i) => (
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

      {/* INPUT — fixed at bottom */}
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
  );
}

const styles = {
  app: {
    display: "flex",
    flexDirection: "column",
    fontFamily: "system-ui",
    background: "#ffffff",
    minHeight: "100vh",
    paddingBottom: 90
  },

  chatArea: {
    flex: 1,
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
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
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
