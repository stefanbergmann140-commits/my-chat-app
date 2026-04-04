import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function App() {

  const [chats, setChats] = useState([
    { id: 1, title: "Neuer Chat", messages: [] }
  ]);

  const [activeChatId, setActiveChatId] = useState(1);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const chatEndRef = useRef(null);

  const activeChat = chats.find(c => c.id === activeChatId);
  const isEmptyChat = activeChat?.messages.length === 0;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats]);

  const createNewChat = () => {
    const newChat = {
      id: Date.now(),
      title: "Neuer Chat",
      messages: []
    };

    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userText = input;
    const currentChatId = activeChatId;
    const isFirstMessage = activeChat?.messages.length === 0;

    // USER MESSAGE
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

    try {
      const res = await fetch(
        "https://flowise-1-4fly.onrender.com/api/v1/prediction/e20bf3ea-8f22-4c1b-95d0-209df14bd2ed",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: userText,
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
              ? (userText.length > 30
                  ? userText.slice(0, 30) + "..."
                  : userText)
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
                  { role: "ai", text: "Fehler bei Antwort" }
                ]
              }
            : chat
        )
      );
    }

    setLoading(false);
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

        {/* CHAT AREA */}
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

          <div ref={chatEndRef} />
        </div>

        {/* INPUT AREA (CENTER + BOTTOM SWITCH) */}
        <div
          style={{
            ...styles.inputWrapper,
            alignItems: isEmptyChat ? "center" : "flex-end",
            justifyContent: "center",
            height: isEmptyChat ? "100%" : "auto"
          }}
        >
          <div
            style={{
              ...styles.inputBar,
              width: isEmptyChat ? "60%" : "100%",
              maxWidth: 800,
              transition: "all 0.3s ease"
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Nachricht schreiben..."
              style={styles.input}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
            />

            <button onClick={sendMessage} style={styles.button}>
              Senden
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

/* 🎨 STYLES */
const styles = {

  app: {
    display: "flex",
    height: "100vh",
    fontFamily: "system-ui",
    background: "#ffffff"
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
    height: "100vh"
  },

  chatArea: {
    flex: 1,
    overflowY: "auto",
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
    background: "#fff"
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