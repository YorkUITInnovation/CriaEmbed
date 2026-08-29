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

const Frame = styled.div`
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  align-self: stretch;
  width: 100%;
  background: #ffffff;
  isolation: isolate;
  contain: paint;
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  height: 100%;
  overflow-y: scroll;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  background: #ffffff;
`;

const NewResponseChip = styled.button`
  position: absolute;
  right: 14px;
  bottom: 14px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.97);
  color: #1f2937;
  font-size: 12px;
  line-height: 1;
  padding: 8px 11px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
  z-index: 3;
  cursor: pointer;

  &:hover {
    background: #ffffff;
    box-shadow: 0 10px 26px rgba(15, 23, 42, 0.16);
  }

  &:focus-visible {
    outline: 2px solid #0ea5e9;
    outline-offset: 2px;
  }
`;

const Dot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.35);
  animation: pulse 1.6s ease-in-out infinite;

  @keyframes pulse {
    70% {
      box-shadow: 0 0 0 8px rgba(34, 197, 94, 0);
    }

    100% {
      box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
    }
  }
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
  #scrollBottomThreshold = 72;
  #lockAutoStickToBottom = false;
  #smoothScrollRaf = null;
  #isProgrammaticScroll = false;
  #responseScrollPadding = 12;

  hasMounted = false;

  state = {
    chats: this.getInitialChats(),
    streaming: null,
    expiredMessage: null,
    autoPlay: false,
    hasUnseenResponse: false,
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

  getChatListElement() {
    return document.getElementById(this.#elementId);
  }

  isNearBottom(element = this.getChatListElement()) {
    if (!element) return true;
    const distanceFromBottom =
      element.scrollHeight - (element.scrollTop + element.clientHeight);
    return distanceFromBottom <= this.#scrollBottomThreshold;
  }

  getLatestBotResponseElement() {
    const chatList = this.getChatListElement();
    if (!chatList) return null;

    const botNodes = chatList.querySelectorAll('[data-chat-role="bot"]');
    if (!botNodes.length) return null;
    return botNodes.item(botNodes.length - 1);
  }

  getElementScrollTop(element, padding = this.#responseScrollPadding) {
    const chatList = this.getChatListElement();
    if (!chatList || !element) return null;

    const listRect = chatList.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    return chatList.scrollTop + (elementRect.top - listRect.top) - padding;
  }

  cancelSmoothScroll() {
    if (this.#smoothScrollRaf) {
      cancelAnimationFrame(this.#smoothScrollRaf);
      this.#smoothScrollRaf = null;
    }
    this.#isProgrammaticScroll = false;
  }

  smoothScrollToTop(targetTop) {
    const chatList = this.getChatListElement();
    if (!chatList) return;

    this.cancelSmoothScroll();

    const maxScroll = Math.max(
      0,
      chatList.scrollHeight - chatList.clientHeight
    );
    const boundedTarget = Math.max(0, Math.min(targetTop, maxScroll));

    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      chatList.scrollTop = boundedTarget;
      return;
    }

    const startTop = chatList.scrollTop;
    const distance = boundedTarget - startTop;
    if (Math.abs(distance) <= 1) {
      chatList.scrollTop = boundedTarget;
      return;
    }

    const duration = Math.min(520, Math.max(240, Math.abs(distance) * 0.4));
    const startTime = performance.now();
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    this.#isProgrammaticScroll = true;

    const animate = (now) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = easeOutCubic(progress);
      chatList.scrollTop = startTop + distance * eased;

      if (progress < 1) {
        this.#smoothScrollRaf = requestAnimationFrame(animate);
        return;
      }

      this.#smoothScrollRaf = null;
      this.#isProgrammaticScroll = false;
    };

    this.#smoothScrollRaf = requestAnimationFrame(animate);
  }

  scrollToBottom(smooth = false) {
    const chatList = this.getChatListElement();
    if (!chatList) return;

    if (smooth) {
      this.smoothScrollToTop(chatList.scrollHeight - chatList.clientHeight);
      return;
    }

    this.cancelSmoothScroll();
    chatList.scrollTop = chatList.scrollHeight;
  }

  markUnseenResponse() {
    if (!this.state.hasUnseenResponse) {
      this.setState({ hasUnseenResponse: true });
    }
  }

  clearUnseenResponse() {
    if (this.state.hasUnseenResponse) {
      this.setState({ hasUnseenResponse: false });
    }
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
    this.cancelSmoothScroll();
  }

  getSnapshotBeforeUpdate() {
    return this.isNearBottom();
  }

  componentDidUpdate(_prevProps, prevState, wasNearBottomBefore) {
    const chatCountIncreased = this.state.chats.length > prevState.chats.length;
    const addedChats = chatCountIncreased
      ? this.state.chats.slice(prevState.chats.length)
      : [];
    const addedBotReply = addedChats.some(
      (chatElement) => chatElement?.props?.userMessage === false
    );
    const streamingStarted =
      !prevState.streaming && Boolean(this.state.streaming);
    const streamingUpdated =
      this.state.streaming &&
      (prevState.streaming?.message !== this.state.streaming?.message ||
        prevState.streaming?.steps?.length !==
          this.state.streaming?.steps?.length);
    const streamingFinished =
      Boolean(prevState.streaming) && !this.state.streaming;

    const shouldStickToBottom =
      chatCountIncreased ||
      streamingStarted ||
      streamingUpdated ||
      streamingFinished;

    if (
      shouldStickToBottom &&
      wasNearBottomBefore &&
      !this.#lockAutoStickToBottom
    ) {
      this.scrollToBottom();
      this.clearUnseenResponse();
      return;
    }

    if (
      (addedBotReply || streamingFinished) &&
      (!wasNearBottomBefore || this.#lockAutoStickToBottom)
    ) {
      this.markUnseenResponse();
    }

    if (this.state.hasUnseenResponse && this.isNearBottom()) {
      this.#lockAutoStickToBottom = false;
      this.clearUnseenResponse();
    }
  }

  onChatListScroll = () => {
    // Programmatic jump/smooth-scroll updates scrollTop every frame and is often
    // mid-thread (not near bottom). Don't treat that as a user scroll-away.
    if (this.#isProgrammaticScroll) {
      return;
    }

    if (!this.isNearBottom()) {
      this.#lockAutoStickToBottom = true;
    }

    if (this.state.hasUnseenResponse && this.isNearBottom()) {
      this.#lockAutoStickToBottom = false;
      this.clearUnseenResponse();
    }
  };

  onUserScrollIntent = () => {
    // Let the user take over if they wheel/touch during a programmatic jump.
    if (this.#isProgrammaticScroll) {
      this.cancelSmoothScroll();
    }
  };

  onJumpToLatestResponse = () => {
    this.#lockAutoStickToBottom = false;

    const latestBotResponse = this.getLatestBotResponseElement();
    const targetTop = this.getElementScrollTop(latestBotResponse);

    if (targetTop == null) {
      this.scrollToBottom(true);
    } else {
      // Anchor to the start of the unread bot reply so the user can read it,
      // instead of dumping them at the trailing edge of a long answer.
      this.smoothScrollToTop(targetTop);
    }

    this.clearUnseenResponse();
  };

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

    this.#lockAutoStickToBottom = false;

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

  // Arrow property so `this` stays bound when used as an addEventListener handler
  // (the sibling handlers are all arrow properties for the same reason).
  onCommandSend = async (event) => {
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
  };

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
    const { streaming, hasUnseenResponse } = this.state;

    return (
      <Frame>
        <Container
          id={this.#elementId}
          onScroll={this.onChatListScroll}
          onWheel={this.onUserScrollIntent}
          onTouchStart={this.onUserScrollIntent}
        >
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
        {hasUnseenResponse && (
          <NewResponseChip
            type="button"
            onClick={this.onJumpToLatestResponse}
            aria-label="Jump to latest response"
          >
            <Dot aria-hidden="true" />
            Response ready
          </NewResponseChip>
        )}
      </Frame>
    );
  }
}
