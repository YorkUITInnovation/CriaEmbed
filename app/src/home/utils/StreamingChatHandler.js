/**
 * Utility for handling SSE streaming responses from the Criabot API.
 * Parses streaming events and provides callbacks for status, chunks, and citations.
 */

export class StreamingChatHandler {
  constructor(botId, chatId, apiUrl) {
    this.botId = botId;
    this.chatId = chatId;
    this.apiUrl = apiUrl;
    this.controller = new AbortController();
  }

  /**
   * Send a streaming chat message and handle SSE events
   * @param {string} prompt - The user's message
   * @param {Object} callbacks - Callback functions for different event types
   *   - onStatus(engine, state, message) - Called for status updates
   *   - onChunk(content) - Called for each chunk of the response
   *   - onCitations(sources) - Called when citations are available
   *   - onError(error) - Called on errors
   *   - onComplete(result) - Called when streaming is complete
   * @returns {Promise<Object>} Final result containing all accumulated data
   */
  async sendStream(prompt, callbacks = {}) {
    const {
      onStatus = () => {},
      onChunk = () => {},
      onCitations = () => {},
      onError = () => {},
      onComplete = () => {},
    } = callbacks;

    const result = {
      message: "",
      status_events: [],
      citations: [],
      errors: [],
      elapsed_ms: 0,
    };

    try {
      const response = await fetch(
        `${this.apiUrl}/embed/${this.botId}/stream`,
        {
          method: "POST",
          headers: {
            Accept: "text/event-stream",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chatId: this.chatId,
            prompt: prompt,
          }),
          signal: this.controller.signal,
        }
      );

      if (!response.ok) {
        let errorMsg = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData?.message || errorMsg;
        } catch (_error) {
          try {
            const errorText = await response.text();
            if (errorText) {
              errorMsg = errorText;
            }
          } catch (__error) {
            // Keep default HTTP message.
          }
        }
        onError(new Error(errorMsg));
        result.errors.push(errorMsg);
        return result;
      }

      if (!response.body) {
        const errorMsg = "Streaming response body is empty.";
        onError(new Error(errorMsg));
        result.errors.push(errorMsg);
        onComplete(result);
        return result;
      }

      // Read the response stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse complete SSE messages from buffer
        const lines = buffer.split("\n");

        // Keep the last incomplete line in the buffer
        buffer = lines[lines.length - 1];

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();

          if (line.startsWith("data: ")) {
            try {
              const eventData = JSON.parse(line.substring(6));
              this._handleEvent(eventData, result, {
                onStatus,
                onChunk,
                onCitations,
                onError,
              });
            } catch (parseError) {
              console.error("Failed to parse SSE event:", parseError);
              onError(parseError);
              result.errors.push(parseError.message);
            }
          }
        }
      }

      // Handle any remaining data
      if (buffer.trim().startsWith("data: ")) {
        try {
          const eventData = JSON.parse(buffer.trim().substring(6));
          this._handleEvent(eventData, result, {
            onStatus,
            onChunk,
            onCitations,
            onError,
          });
        } catch (parseError) {
          console.error("Failed to parse final SSE event:", parseError);
        }
      }

      onComplete(result);
      return result;
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Streaming error:", error);
        onError(error);
        result.errors.push(error.message);
      }
      onComplete(result);
      return result;
    }
  }

  /**
   * Handle individual SSE events
   */
  _handleEvent(event, result, callbacks) {
    const { onStatus, onChunk, onCitations, onError } = callbacks;

    switch (event.type) {
      case "status":
        result.status_events.push(event);
        onStatus(event.engine, event.state, event.message);
        break;

      case "chunk":
        result.message += event.content;
        onChunk(event.content);
        break;

      case "citations":
        result.citations = event.sources || [];
        onCitations(result.citations);
        break;

      case "error":
        result.errors.push(event.message);
        onError(new Error(event.message));
        break;

      case "done":
        result.elapsed_ms = event.elapsed_ms || 0;
        break;

      default:
        console.warn("Unknown event type:", event.type);
    }
  }

  /**
   * Cancel the streaming request
   */
  cancel() {
    this.controller.abort();
  }
}

export default StreamingChatHandler;
