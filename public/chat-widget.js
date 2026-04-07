class ChatWidget extends HTMLElement {
  connectedCallback() {
    this.style.display = "block";

    const iframe = document.createElement("iframe");
    iframe.src = "https://my-chat-app-eosin.vercel.app/";
    iframe.style.cssText = "width:100%;border:none;min-height:400px;";
    iframe.scrolling = "no";
    iframe.setAttribute("scrolling", "no");
    this.appendChild(iframe);

    window.addEventListener("message", (e) => {
      if (e.data && e.data.type === "chat-resize") {
        const h = e.data.height + "px";
        iframe.style.height = h;
        this.style.height = h;
      }
    });
  }
}

customElements.define("chat-widget", ChatWidget);
