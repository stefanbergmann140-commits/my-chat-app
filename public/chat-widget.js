class ChatWidget extends HTMLElement {
  constructor() {
    super();
    this.chats = [{ id: 1, title: "Neuer Chat", messages: [] }];
    this.activeChatId = 1;
    this.loading = false;
    this.input = "";
  }

  connectedCallback() {
    this.style.display = "block";
    this.style.fontFamily = "system-ui, sans-serif";
    this.style.minHeight = "500px";
    this.render();
    this._startHeightReporting();
  }

  _startHeightReporting() {
    const sendHeight = () => {
      const height = Math.max(500, document.body ? document.body.scrollHeight : this.scrollHeight);
      window.parent.postMessage({ type: "chat-resize", height }, "*");
    };
    this._resizeObserver = new ResizeObserver(sendHeight);
    this._resizeObserver.observe(this);
    sendHeight();
  }

  disconnectedCallback() {
    if (this._resizeObserver) this._resizeObserver.disconnect();
  }

  get activeChat() {
    return this.chats.find(c => c.id === this.activeChatId);
  }

  render() {
    this.innerHTML = `
      <div style="display:flex;">
        <div id="cw-sidebar" style="width:260px;border-right:1px solid #e5e7eb;padding:10px;background:#f7f7f8;flex-shrink:0;">
          <button id="cw-new" style="width:100%;padding:10px;margin-bottom:10px;border-radius:6px;border:1px solid #d1d5db;background:#fff;cursor:pointer;">+ Neuer Chat</button>
          <div id="cw-chat-list"></div>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;">
          <div id="cw-messages" style="padding:10px;"></div>
          <div style="padding:12px 20px;border-top:1px solid #e5e7eb;background:#fff;">
            <div style="display:flex;gap:10px;padding:10px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;max-width:800px;margin:0 auto;">
              <input id="cw-input" placeholder="Type a message..." style="flex:1;padding:10px;border-radius:6px;border:1px solid #d1d5db;font-size:14px;" />
              <button id="cw-send" style="padding:8px 12px;border-radius:6px;border:1px solid #d1d5db;background:#f3f4f6;cursor:pointer;">Send</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.renderChatList();
    this.renderMessages();

    this.querySelector("#cw-new").addEventListener("click", () => this.createNewChat());
    this.querySelector("#cw-send").addEventListener("click", () => this.sendMessage());
    this.querySelector("#cw-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.sendMessage();
    });
  }

  renderChatList() {
    const list = this.querySelector("#cw-chat-list");
    list.innerHTML = this.chats.map(chat => `
      <div class="cw-chat-item" data-id="${chat.id}" style="padding:10px;border-radius:6px;cursor:pointer;background:${chat.id === this.activeChatId ? '#e5e7eb' : 'transparent'};">
        ${this.escapeHtml(chat.title)}
      </div>
    `).join("");

    list.querySelectorAll(".cw-chat-item").forEach(el => {
      el.addEventListener("click", () => {
        this.activeChatId = parseInt(el.dataset.id);
        this.renderChatList();
        this.renderMessages();
      });
    });
  }

  renderMessages() {
    const container = this.querySelector("#cw-messages");
    const chat = this.activeChat;
    if (!chat) return;

    let html = chat.messages.map(m => `
      <div style="display:flex;justify-content:${m.role === 'user' ? 'flex-end' : 'flex-start'};padding:10px;">
        <div style="max-width:700px;padding:12px;border-radius:8px;border:1px solid #e5e7eb;background:#fff;">
          ${this.escapeHtml(m.text)}
        </div>
      </div>
    `).join("");

    if (this.loading) {
      html += `<div style="padding:10px;opacity:0.6;">Bot is typing...</div>`;
    }

    container.innerHTML = html;
    // Report updated height to Wix after DOM update
    setTimeout(() => {
      const height = Math.max(500, document.body ? document.body.scrollHeight : this.scrollHeight);
      window.parent.postMessage({ type: "chat-resize", height }, "*");
    }, 50);
  }

  createNewChat() {
    const newChat = { id: Date.now(), title: "Neuer Chat", messages: [] };
    this.chats.unshift(newChat);
    this.activeChatId = newChat.id;
    this.render();
  }

  async sendMessage() {
    const inputEl = this.querySelector("#cw-input");
    const text = inputEl.value.trim();
    if (!text || this.loading) return;

    const chat = this.activeChat;
    const isFirst = chat.messages.length === 0;

    chat.messages.push({ role: "user", text });
    inputEl.value = "";
    this.loading = true;
    this.renderMessages();
    this.renderChatList();

    try {
      const res = await fetch(
        "https://flowise-1-4fly.onrender.com/api/v1/prediction/e20bf3ea-8f22-4c1b-95d0-209df14bd2ed",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: text, chatId: this.activeChatId })
        }
      );
      const data = await res.json();
      const aiText = data.text || data.answer || "Keine Antwort";

      chat.messages.push({ role: "ai", text: aiText });

      if (isFirst) {
        chat.title = text.length > 30 ? text.slice(0, 30) + "..." : text;
      }
    } catch (err) {
      chat.messages.push({ role: "ai", text: "Error generating response" });
    }

    this.loading = false;
    this.renderMessages();
    this.renderChatList();
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

customElements.define("chat-widget", ChatWidget);
