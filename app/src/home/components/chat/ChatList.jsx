import { Component } from "react";
import { styled } from "styled-components";
import Chat from "./Chat.jsx";
import StreamingChatBubble from "./StreamingChatBubble.jsx";
import {
  CHAT_EXPIRED_AT,
  CHAT_STARTED_AT,
  ChatSystemMessage,
} from "./ChatSystemMessage.jsx";
import QueryBox from "../query/QueryBox.jsx";
import ChatExpiredButton from "./ChatExpiredButton.jsx";

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow-y: scroll;
`;

const ExpiredContainer = styled.div`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
`;

const EMPTY_STREAM = {
  steps: [],
  message: "",
  citations: [],
  showShimmer: true,
  isComplete: false,
  elapsedMs: null,
  hasError: false,
  errorMessage: null,
};

export default class ChatList extends Component {
  getTimeString = () => new Date().toLocaleTimeString();

  #elementId = "chat-list";
  #botIconUrl = window.Cria.botIconUrl || "/icons/lion.png";
  #userIconUrl = "/icons/pfp.png";
  #startTime = this.getTimeString();
  #expiredTime = null;
  #waitingChatId = null;
  #streamFinalized = false;

  hasMounted = false;

  state = {
    chats: this.getInitialChats(),
    streaming: null,
    expiredMessage: null,
    autoPlay: false,
  };

  getInitialChats() {
    return [
      <Chat
        key={1}
        time={this.getTimeString()}
        pictureURL={window.Cria.botIconUrl || "/icons/lion.png"}
        content={window.Cria.botGreeting || "Hey there! Got a question?"}
        isGreeting={true}
        messageId={window.Cria.botGreetingId}
        userMessage={false}
        relatedPrompts={window.Cria.initialPrompts}
      />,
    ];
  }

  componentDidMount() {
    if (this.hasMounted) return;
    this.hasMounted = true;

    document.addEventListener("chatSend", this.onChatSend);
    document.addEventListener("chatReply", this.onChatReply);
    document.addEventListener("chatStatus", this.onChatStatus);
    document.addEventListener("chatChunk", this.onChatChunk);
    document.addEventListener("chatCitations", this.onChatCitations);
    document.addEventListener("chatStreamComplete", this.onChatStreamComplete);
    document.addEventListener("chatStreamError", this.onChatStreamError);
    document.addEventListener("commandSend", this.onCommandSend);
    document.addEventListener("chatExpired", this.onChatExpired);
    document.addEventListener("setAutoPlay", this.onSetAutoPlay);
  }

  componentWillUnmount() {
    document.removeEventListener("chatSend", this.onChatSend);
    document.removeEventListener("chatReply", this.onChatReply);
    document.removeEventListener("chatStatus", this.onChatStatus);
    document.removeEventListener("chatChunk", this.onChatChunk);
    document.removeEventListener("chatCitations", this.onChatCitations);
    document.removeEventListener(
      "chatStreamComplete",
      this.onChatStreamComplete
    );
    document.removeEventListener("chatStreamError", this.onChatStreamError);
    document.removeEventListener("commandSend", this.onCommandSend);
    document.removeEventListener("chatExpired", this.onChatExpired);
    document.removeEventListener("setAutoPlay", this.onSetAutoPlay);
  }

  componentDidUpdate(_prevProps, prevState) {
    const streamingChanged =
      this.state.streaming &&
      (prevState.streaming?.message !== this.state.streaming?.message ||
        prevState.streaming?.steps?.length !==
          this.state.streaming?.steps?.length);

    if (streamingChanged || (!prevState.streaming && this.state.streaming)) {
      const chatList = document.getElementById(this.#elementId);
      if (chatList) {
        chatList.scrollTop = chatList.scrollHeight;
      }
    }
  }

  onSetAutoPlay = (event) => {
    this.setState({ autoPlay: event.detail });
  };

  onChatExpired = () => {
    this.clearStreaming();

    this.setState({
      expiredMessage: (
        <ExpiredContainer>
          <ChatSystemMessage
            key={2048}
            messageMap={CHAT_EXPIRED_AT}
            timestamp={(this.#expiredTime ||= this.getTimeString())}
          />
          <ChatExpiredButton key={1024} />
        </ExpiredContainer>
      ),
    });
  };

  onChatTimeout = () => {
    if (!this.state.streaming) return;

    this.finalizeStreamingReply({
      code: "ERROR",
      reply: null,
      message: "The request timed out. Please try again.",
    });
  };

  insertChatElement(...chats) {
    this.setState({ chats: [...this.state.chats, ...chats] });
  }

  clearStreaming() {
    this.#waitingChatId = null;
    this.#streamFinalized = false;
    this.setState({ streaming: null });
  }

  beginStreaming() {
    const waitingChatId = Math.random();
    this.#waitingChatId = waitingChatId;
    this.#streamFinalized = false;

    setTimeout(() => {
      if (this.#waitingChatId !== waitingChatId) return;
      this.onChatTimeout();
    }, QueryBox.CHAT_TIMEOUT);

    this.setState({
      streaming: { ...EMPTY_STREAM },
    });
  }

  appendReasoningStep(engine, state, message) {
    this.setState((prev) => {
      if (!prev.streaming) return null;

      const steps = [...prev.streaming.steps];
      const last = steps[steps.length - 1];

      if (
        last &&
        last.engine === engine &&
        last.state === state &&
        last.message === message
      ) {
        return null;
      }

      steps.push({
        engine,
        state,
        message,
        timestamp: Date.now(),
      });

      return {
        streaming: {
          ...prev.streaming,
          steps,
          showShimmer: false,
        },
      };
    });
  }

  onChatStatus = (event) => {
    const { engine, state, message } = event.detail || {};
    if (!engine || !this.state.streaming) return;
    this.appendReasoningStep(engine, state, message);
  };

  onChatChunk = (event) => {
    const chunk = event.detail;
    if (!chunk || !this.state.streaming) return;

    this.setState((prev) => ({
      streaming: {
        ...prev.streaming,
        message: `${prev.streaming.message}${chunk}`,
        showShimmer: false,
      },
    }));
  };

  onChatCitations = (event) => {
    const sources = event.detail;
    if (!Array.isArray(sources) || !this.state.streaming) return;

    this.setState((prev) => ({
      streaming: {
        ...prev.streaming,
        citations: sources,
        showShimmer: false,
      },
    }));
  };

  onChatStreamComplete = () => {
    // Terminal handling is done via chatReply for compatibility with non-stream paths.
  };

  onChatStreamError = (event) => {
    if (!this.state.streaming || this.#streamFinalized) return;

    this.finalizeStreamingReply({
      code: "ERROR",
      reply: null,
      message: event.detail?.message || "Streaming failed. Please try again.",
    });
  };

  buildStreamingContent(streaming, { isLive = false } = {}) {
    return (
      <StreamingChatBubble
        steps={streaming.steps}
        message={streaming.message}
        citations={streaming.citations}
        showShimmer={streaming.showShimmer}
        isLive={isLive}
        isComplete={streaming.isComplete}
        elapsedMs={streaming.elapsedMs}
        hasError={streaming.hasError}
        errorMessage={streaming.errorMessage}
      />
    );
  }

  finalizeStreamingReply(detail) {
    if (this.#streamFinalized) return;
    this.#streamFinalized = true;
    this.#waitingChatId = null;

    const streaming = this.state.streaming;
    if (!streaming) return;

    const finalMessage = detail?.reply || streaming.message || null;
    const isError =
      detail?.code === "ERROR" || (!finalMessage && !streaming.message?.trim());
    const resolvedMessage = finalMessage || streaming.message || null;

    const finalizedStream = {
      ...streaming,
      message: resolvedMessage,
      isComplete: true,
      showShimmer: false,
      elapsedMs: detail?.elapsedMs ?? streaming.elapsedMs,
      citations:
        detail?.citations?.length > 0 ? detail.citations : streaming.citations,
      hasError: isError,
      errorMessage: isError
        ? detail?.message || "Failed to retrieve a response. Please try again."
        : null,
    };

    this.insertChatElement(
      <Chat
        key={Math.random().toString()}
        time={this.getTimeString()}
        pictureURL={this.#botIconUrl}
        content={this.buildStreamingContent(finalizedStream)}
        autoPlay={this.state.autoPlay}
        userMessage={false}
        allowCopy={!isError}
        relatedPrompts={detail?.relatedPrompts}
        verifiedResponse={detail?.verifiedResponse}
      />
    );

    this.setState({ streaming: null });
  }

  onChatSend = (event) => {
    if (!event.detail) return;

    this.beginStreaming();

    this.insertChatElement(
      <Chat
        key={Math.random().toString()}
        time={this.getTimeString()}
        pictureURL={this.#userIconUrl}
        content={event.detail}
        userMessage={true}
        allowCopy={true}
      />
    );
  };

  async onCommandSend(event) {
    this.clearStreaming();

    const command = event.detail.command;
    const content = await command.execute(event.detail.text, this);

    document.dispatchEvent(new CustomEvent("commandFinished"));

    this.insertChatElement(
      <Chat
        key={Math.random().toString()}
        time={this.getTimeString()}
        pictureURL={this.#botIconUrl}
        content={content}
        command={command}
        userMessage={false}
        allowCopy={true}
        hideInPrint={command.hideInPrint()}
      />
    );
  }

  onChatReply = (event) => {
    const detail = event.detail;

    if (this.state.streaming) {
      if (this.#streamFinalized) return;
      this.finalizeStreamingReply(detail);
      return;
    }

    if (!detail?.reply) {
      if (detail?.code === "ERROR") {
        this.insertChatElement(
          <Chat
            key={Math.random().toString()}
            time={this.getTimeString()}
            pictureURL={this.#botIconUrl}
            content={
              <StreamingChatBubble
                hasError={true}
                errorMessage={
                  detail.message ||
                  "Chat failed to send due to an error. Please try again later."
                }
              />
            }
            userMessage={false}
            allowCopy={false}
          />
        );
      }
      return;
    }

    this.insertChatElement(
      <Chat
        key={Math.random().toString()}
        time={this.getTimeString()}
        pictureURL={this.#botIconUrl}
        content={detail.reply}
        messageId={detail.replyId}
        autoPlay={this.state.autoPlay}
        userMessage={false}
        allowCopy={true}
        relatedPrompts={detail.relatedPrompts}
        verifiedResponse={detail.verifiedResponse}
      />
    );
  };

  render() {
    const { streaming } = this.state;

    return (
      <Container id={this.#elementId}>
        <ChatSystemMessage
          messageMap={CHAT_STARTED_AT}
          timestamp={this.#startTime}
        />
        {this.state.chats}
        {streaming && (
          <Chat
            key="streaming-response"
            time={this.getTimeString()}
            pictureURL={this.#botIconUrl}
            content={this.buildStreamingContent(streaming, { isLive: true })}
            userMessage={false}
            allowCopy={false}
          />
        )}
        {this.state.expiredMessage}
      </Container>
    );
  }
}
