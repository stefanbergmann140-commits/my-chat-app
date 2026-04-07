import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function App() {

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chatId, setChatId] = useState(null);

  const chatEndRef = useRef(null);

  // =========================
  // 📡 COMMUNICATION
  // =========================
  useEffect(() => {

    window.parent.postMessage({ type: "ready" }, "*");

    window.onmessage = async (event) => {
      const data = event.data;
      if (!data) return;

      if (data.type === "init") {
        setChatId(data.chatId || null);
      }

      if (data.type === "user-message") {
        await handleUserMessage(data.text, data.chatId);
      }
    };

  }, []);

  // =========================
  // 🤖 CHAT LOGIC
  // =========================
  const handleUserMessage = async (text, wixChatId) => {

    setMessages(prev => [
      ...prev,
      { role: "user", text }
    ]);

    setLoading(true);

    sendHeight();

    try {

      const res = await fetch(
        "https://flowise-1-4fly.onrender.com/api/v1/prediction/e20bf3ea-8f22-4c1b-95d0-209df14bd2ed",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: text,
            chatId: wixChatId || chatId
          })
        }
      );

      const data = await res.json();

      const aiText = data.text || data.answer || "No response received";

      setMessages(prev => [
        ...prev,
        { role: "assistant", text: aiText }
      ]);

    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", text: "Something went wrong" }
      ]);
    }

    setLoading(false);

    sendHeight();
  };

  // =========================
  // 📏 RESIZE WIX
  // =========================
  const sendHeight = () => {
    const height = document.documentElement.scrollHeight;

    window.parent.postMessage({
      type: "resize",
      height
    }, "*");
  };

  // =========================
  // 📜 SCROLL
  // =========================
  const scrollToBottom = () => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // =========================
  // UI
  // =========================
  return (
    <div style={styles.app}>

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

        {/* 🤖 TYPING INDICATOR */}
        {loading && (
          <div style={{ display: "flex", padding: 10 }}>
            <div style={styles.bubble}>
              <Typing />
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

    </div>
  );
}

// =========================
// ⏳ TYPING (ENGLISH UI)
// =========================
function Typing() {
  return (
    <div style={{ display: "flex", gap: 5 }}>
      <span>Thinking</span>
      <span className="dot">.</span>
      <span className="dot">.</span>
      <span className="dot">.</span>

      <style>
        {`
          .dot {
            animation: blink 1.2s infinite;
          }

          @keyframes blink {
            0% { opacity: 0.2; }
            50% { opacity: 1; }
            100% { opacity: 0.2; }
          }
        `}
      </style>
    </div>
  );
}

// =========================
// 🎨 STYLE
// =========================
const styles = {
  app: {
    display: "flex",
    flexDirection: "column",
    fontFamily: "system-ui"
  },

  chatArea: {
    padding: 10
  },

  bubble: {
    maxWidth: 700,
    padding: 12,
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#fff"
  }
};