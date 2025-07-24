import {Component} from "react";
import {styled} from "styled-components";
import Chat from "./Chat.jsx";
import ChatTyping from "./ChatTyping.jsx";
import {CHAT_EXPIRED_AT, CHAT_STARTED_AT, ChatSystemMessage} from "./ChatSystemMessage.jsx";
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

export default class ChatList extends Component {

  getTimeString = () => (new Date().toLocaleTimeString());

  // Initial vars
  #elementId = "chat-list";
  #botIconUrl = window.Cria.botIconUrl || "/icons/lion.png";
  #userIconUrl = "/icons/pfp.png";
  #startTime = this.getTimeString();
  #expiredTime = null;

  hasMounted = false;

  // Initial state
  state = {
    chats: this.getInitialChats(),
    waitingChat: null,
    waitingChatId: null,
    expiredMessage: null,
    autoPlay: false
  }

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
      />
    ]
  }

  componentDidMount() {
    if (this.hasMounted) return;
    this.hasMounted = true;
    document.addEventListener("chatSend", this.onChatSend.bind(this));
    document.addEventListener("chatReply", this.onChatReply.bind(this));
    document.addEventListener("commandSend", this.onCommandSend.bind(this));
    document.addEventListener("chatExpired", this.onChatExpired.bind(this));
    document.addEventListener("setAutoPlay", this.onSetAutoPlay.bind(this));

  }

  onSetAutoPlay(event) {
    this.setState({autoPlay: event.detail});
  }

  /** Shut it down when the chat expires */
  onChatExpired() {

    if (this.state.waitingChat) {
      this.setWaiting(false);
    }

    this.setState({
      expiredMessage:
        <ExpiredContainer>
          <ChatSystemMessage
            key={2048}
            messageMap={CHAT_EXPIRED_AT}
            timestamp={this.#expiredTime ||= this.getTimeString()}
          />
          <ChatExpiredButton key={1024}/>
        </ExpiredContainer>
    });
  }

  /** Send a fail message on timeout */
  onChatTimeout() {
    if (!this.state.waitingChat) return;
    this.setWaiting(false);

    this.insertChatElement(
      <Chat
        key={Math.random().toString()}
        time={this.getTimeString()}
        pictureURL={this.#botIconUrl}
        content={null}
        userMessage={false}
      />
    );

  }

  /** Add one or more elements to the chat */
  insertChatElement(...chats) {
    this.setState({chats: [...this.state.chats, ...chats]});
  }

  /** Set the status as waiting for a reply or not */
  setWaiting(isWaiting) {

    if (!isWaiting) {
      this.setState({waitingChat: null, waitingChatId: null});
      return;
    }

    const waitingChat = (
      <Chat
        key={Math.random().toString()}
        time={this.getTimeString()}
        pictureURL={this.#botIconUrl}
        content={<ChatTyping/>}
        allowCopy={false}
        userMessage={false}
      />
    );

    // Generate a wait ID for matching
    const waitingChatId = Math.random();

    // Handle timeouts
    setTimeout(() => {
      if (this.state.waitingChatId !== waitingChatId) return;
      this.onChatTimeout();
    }, QueryBox.CHAT_TIMEOUT);

    this.setState({waitingChat: waitingChat, waitingChatId: waitingChatId});
  }

  /** Handle waiting state when a message is sent */
  onChatSend(event) {

    if (!event.detail) return;

    // Handle waiting
    this.setWaiting(true);

    this.insertChatElement(
      <Chat
        key={Math.random().toString()}
        time={this.getTimeString()}
        pictureURL={this.#userIconUrl}
        content={event.detail}
        userMessage={true}
        allowCopy={true}
      />
    )

  }

  /**
   *
   * @param {{command: Command, text: string}} event.detail
   */
  async onCommandSend(event) {

    this.setWaiting(true);

    const command = event.detail.command;
    const content = await command.execute(event.detail.text, this);

    this.setWaiting(false);

    document.dispatchEvent(new CustomEvent("commandFinished"))

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

  /** Handle receiving chat reply from the bot */
  onChatReply(event) {

    if (!event.detail?.reply) return;
    this.setWaiting(false);

    this.insertChatElement(
      <Chat
        key={Math.random().toString()}
        time={this.getTimeString()}
        pictureURL={this.#botIconUrl}
        content={event.detail?.reply}
        messageId={event.detail?.replyId}
        autoPlay={this.state.autoPlay}
        userMessage={false}
        allowCopy={true}
        relatedPrompts={event.detail?.relatedPrompts}
        verifiedResponse={event.detail.verifiedResponse}
      />
    );

  }



  /** Render everything */
  render() {

    return (
      <Container key={this.date} id={this.#elementId}>
        <ChatSystemMessage messageMap={CHAT_STARTED_AT} timestamp={this.#startTime}/>
        {this.state.chats}
        {this.state.waitingChat}
        {this.state.expiredMessage}
      </Container>
    )
  }

}
