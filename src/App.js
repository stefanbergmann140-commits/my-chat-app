const handleUserMessage = useCallback(
  async (text, currentChatId, isFirstMessage, aiMessageId) => {
    let fullText = "";
    let finalMetadata = null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 45000);

    try {
      const res = await fetch(
        `${FLOWISE_BASE_URL}/prediction/${CHATFLOW_ID}`,
        {
          method: "POST",
          headers: getAuthHeaders({
            "Content-Type": "application/json",
            Accept: "text/event-stream"
          }),
          body: JSON.stringify({
            question: text,
            chatId: currentChatId,
            streaming: true
          }),
          signal: controller.signal
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Prediction request failed");
      }

      const contentType = res.headers.get("content-type") || "";

      if (!contentType.includes("text/event-stream") || !res.body) {
        const data = await readJsonSafely(
          res,
          "Prediction response was not valid JSON"
        );

        const aiText = normalizeMarkdownText(
          data.text || data.answer || data.result || "No response"
        );

        let updatedChat = null;

        setChats((prev) =>
          prev.map((chat) => {
            if (chat.id !== currentChatId) return chat;

            updatedChat = {
              ...chat,
              messages: chat.messages.map((message) =>
                message.id === aiMessageId
                  ? { ...message, text: aiText }
                  : message
              ),
              title: isFirstMessage
                ? text.length > 30
                  ? `${text.slice(0, 30)}...`
                  : text
                : chat.title
            };

            return updatedChat;
          })
        );

        if (updatedChat && isSignedIn) {
          queuePersistChat(updatedChat);
        }

        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let streamEnded = false;

      const applyPartialText = (partialText) => {
        setChats((prev) =>
          prev.map((chat) => {
            if (chat.id !== currentChatId) return chat;

            return {
              ...chat,
              messages: chat.messages.map((message) =>
                message.id === aiMessageId
                  ? { ...message, text: partialText }
                  : message
              )
            };
          })
        );
      };

      const processEventBlock = (eventBlock) => {
        if (!eventBlock.trim()) return;

        const { event, data } = parseSSEEvent(eventBlock);

        if (!data && event !== "end") return;
        if (event === "start") return;

        if (event === "token" || event === "message") {
          const chunk = normalizeMarkdownText(data);
          fullText += chunk;
          applyPartialText(fullText);
          return;
        }

        if (event === "metadata" || event === "sourceDocuments") {
          try {
            finalMetadata = JSON.parse(data);
          } catch (_) {
            finalMetadata = data;
          }
          return;
        }

        if (event === "error") {
          throw new Error(data || "Streaming error");
        }

        if (event === "end") {
          streamEnded = true;
        }
      };

      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const eventBlocks = buffer.split("\n\n");
        buffer = eventBlocks.pop() || "";

        for (const block of eventBlocks) {
          processEventBlock(block);

          if (streamEnded) {
            try {
              await reader.cancel();
            } catch (_) {}
            break;
          }
        }

        if (streamEnded) {
          break;
        }
      }

      buffer += decoder.decode();

      if (buffer.trim() && !streamEnded) {
        processEventBlock(buffer);
      }

      const finalText = normalizeMarkdownText(fullText) || "No response";

      let updatedChat = null;

      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== currentChatId) return chat;

          updatedChat = {
            ...chat,
            messages: chat.messages.map((message) =>
              message.id === aiMessageId
                ? {
                    ...message,
                    text: finalText,
                    metadata: finalMetadata || message.metadata
                  }
                : message
            ),
            title: isFirstMessage
              ? text.length > 30
                ? `${text.slice(0, 30)}...`
                : text
              : chat.title
          };

          return updatedChat;
        })
      );

      if (updatedChat && isSignedIn) {
        queuePersistChat(updatedChat);
      }
    } catch (err) {
      const errorMessage =
        err?.name === "AbortError"
          ? "Die Antwort hat zu lange gedauert und wurde abgebrochen."
          : `Error generating response${err?.message ? `: ${err.message}` : ""}`;

      let erroredChat = null;

      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== currentChatId) return chat;

          erroredChat = {
            ...chat,
            messages: chat.messages.map((message) =>
              message.id === aiMessageId
                ? {
                    ...message,
                    text: errorMessage
                  }
                : message
            )
          };

          return erroredChat;
        })
      );

      if (erroredChat && isSignedIn) {
        queuePersistChat(erroredChat);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  },
  [queuePersistChat, isSignedIn]
);