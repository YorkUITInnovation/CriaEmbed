/**
 * SSE streaming client for embed chat.
 *
 * Terminal rules (stream contract):
 * - Success requires exactly one `done` event.
 * - EOF without `done` is an interruption, even if chunks arrived.
 * - `error` is terminal; never followed by success.
 * - The first terminal event finalizes the turn immediately: the reader is
 *   cancelled and the result is completed without waiting for EOF.
 * - A second terminal event in the same read batch (e.g. `done` followed by
 *   `error`) is a protocol violation and fails the turn. Non-terminal events
 *   after a terminal event are ignored.
 * - Abort is distinct from success/error/interrupted.
 */

const MAX_INCOMPLETE_BUFFER = 256 * 1024;

export class StreamingChatHandler {
  constructor(botId, chatId, apiUrl, options = {}) {
    this.botId = botId;
    this.chatId = chatId;
    this.apiUrl = apiUrl;
    this.streamVersion = options.streamVersion ?? 2;
    this.controller = new AbortController();
  }

  /**
   * @param {string} prompt
   * @param {Object} callbacks
   * @returns {Promise<Object>}
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
      web_search: null,
      reply_html: null,
      format: null,
      received_done: false,
      received_error: false,
      outcome: "pending",
      partial_emitted: false,
      history_committed: null,
    };

    let reader = null;

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
            prompt,
            stream_version: this.streamVersion,
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
        result.outcome = "error";
        result.received_error = true;
        onError(new Error(errorMsg));
        result.errors.push(errorMsg);
        onComplete(result);
        return result;
      }

      if (!response.body) {
        const errorMsg = "Streaming response body is empty.";
        result.outcome = "error";
        result.received_error = true;
        onError(new Error(errorMsg));
        result.errors.push(errorMsg);
        onComplete(result);
        return result;
      }

      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let terminalKind = null; // "done" | "error"
      let terminalViolation = false;

      const cancelReader = async () => {
        try {
          await reader.cancel();
        } catch (_e) {
          // ignore
        }
      };

      // Process one batch of parsed events. Returns true when a terminal
      // event (or a second terminal event) was seen in this batch.
      const processEvents = (events) => {
        for (const eventData of events) {
          if (terminalKind) {
            if (eventData.type === "done" || eventData.type === "error") {
              terminalViolation = true;
              return true;
            }
            continue;
          }
          const eventTerminal = this._handleEvent(eventData, result, {
            onStatus,
            onChunk,
            onCitations,
            onError,
          });
          if (eventTerminal === "done" || eventTerminal === "error") {
            terminalKind = eventTerminal;
          }
        }
        return terminalKind !== null;
      };

      // Finalize exactly once at the first terminal event: cancel the
      // reader instead of waiting for the connection to reach EOF.
      const finalizeTerminal = async () => {
        if (terminalViolation) {
          const errorMsg =
            "Invalid terminal sequence: multiple terminal events in one stream.";
          result.outcome = "error";
          result.received_error = true;
          if (!result.errors.includes(errorMsg)) {
            result.errors.push(errorMsg);
          }
          onError(new Error(errorMsg));
        } else {
          result.outcome = terminalKind === "done" ? "success" : "error";
        }
        await cancelReader();
        onComplete(result);
        return result;
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        if (buffer.length > MAX_INCOMPLETE_BUFFER) {
          const errorMsg = "SSE frame exceeded buffer limit.";
          result.outcome = "error";
          result.received_error = true;
          onError(new Error(errorMsg));
          result.errors.push(errorMsg);
          await cancelReader();
          onComplete(result);
          return result;
        }

        const parsed = this._consumeSseBuffer(buffer);
        buffer = parsed.remainder;

        if (processEvents(parsed.events)) {
          return finalizeTerminal();
        }
      }

      // Flush any final complete event left without trailing blank line.
      if (!terminalKind && buffer.trim()) {
        const parsed = this._consumeSseBuffer(buffer + "\n\n");
        if (processEvents(parsed.events)) {
          return finalizeTerminal();
        }
      }

      if (!terminalKind) {
        result.outcome = "interrupted";
        const errorMsg =
          "The response ended without a terminal done event.";
        onError(new Error(errorMsg));
        result.errors.push(errorMsg);
      }

      onComplete(result);
      return result;
    } catch (error) {
      if (error.name === "AbortError") {
        result.outcome = "aborted";
        onComplete(result);
        return result;
      }
      console.error("Streaming error:", error);
      result.outcome = "error";
      result.received_error = true;
      onError(error);
      result.errors.push(error.message);
      onComplete(result);
      return result;
    } finally {
      if (reader) {
        try {
          reader.releaseLock();
        } catch (_e) {
          // Already cancelled/closed.
        }
      }
    }
  }

  /**
   * Parse SSE events from a buffer. Events end at a blank line.
   * Supports LF/CRLF, comments, and multi-line data fields.
   */
  _consumeSseBuffer(buffer) {
    const normalized = buffer.replace(/\r\n/g, "\n");
    const events = [];
    let start = 0;

    while (true) {
      const sep = normalized.indexOf("\n\n", start);
      if (sep === -1) {
        break;
      }
      const rawEvent = normalized.slice(start, sep);
      start = sep + 2;
      const dataLines = [];
      for (const line of rawEvent.split("\n")) {
        if (!line || line.startsWith(":")) {
          continue;
        }
        if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).replace(/^ /, ""));
        }
      }
      if (dataLines.length === 0) {
        continue;
      }
      const payload = dataLines.join("\n");
      if (payload === "[DONE]") {
        continue;
      }
      try {
        events.push(JSON.parse(payload));
      } catch (parseError) {
        events.push({
          type: "error",
          message: `Failed to parse SSE event: ${parseError.message}`,
          code: "SSE_PARSE",
        });
      }
    }

    return { events, remainder: normalized.slice(start) };
  }

  /**
   * @returns {"done"|"error"|null}
   */
  _handleEvent(event, result, callbacks) {
    const { onStatus, onChunk, onCitations, onError } = callbacks;

    if (result.received_done || result.received_error) {
      return null;
    }

    switch (event.type) {
      case "status":
        result.status_events.push(event);
        onStatus(event.engine, event.state, event.message);
        return null;

      case "chunk": {
        const content = event.content ?? "";
        if (!content) {
          return null;
        }
        if (event.format) {
          result.format = event.format;
        }
        result.message += content;
        result.partial_emitted = true;
        onChunk(content, event);
        return null;
      }

      case "citations":
        result.citations = event.sources || [];
        onCitations(result.citations);
        return null;

      case "error": {
        result.received_error = true;
        const message = event.message || "Stream error";
        result.errors.push(message);
        if (typeof event.partial_emitted === "boolean") {
          result.partial_emitted = event.partial_emitted;
        }
        if (typeof event.history_committed === "boolean") {
          result.history_committed = event.history_committed;
        }
        onError(new Error(message));
        return "error";
      }

      case "done":
        result.received_done = true;
        result.elapsed_ms = event.elapsed_ms || 0;
        result.web_search = event.web_search || null;
        if (typeof event.reply_html === "string") {
          result.reply_html = event.reply_html;
        }
        if (event.usage !== undefined) {
          result.usage = event.usage;
        }
        return "done";

      default:
        console.warn("Unknown event type:", event.type);
        return null;
    }
  }

  cancel() {
    this.controller.abort();
  }
}

export default StreamingChatHandler;
