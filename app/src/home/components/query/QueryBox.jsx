import {Component} from "react";
import {styled} from "styled-components";
import {getTheme} from "../chat/ChatHeader.jsx";
import QueryArea from "./QueryArea.jsx";
import {ResetChat} from "./buttons/ResetChat.jsx";
import {SendMessage} from "./buttons/SendMessage.jsx";
import SpeechAutoPlay from "./buttons/SpeechAutoPlay.jsx";
import {StartText} from "../chat/ChatSystemMessage.jsx";
import BotTrustWarning from "./buttons/BotTrustWarning.jsx";
import PoweredByAura from "./buttons/PoweredByAura.jsx";

const OuterContainer = styled.div`
    width: 100%;
`;

const SubOuterContainer = styled.div`
    margin: 0 15px 15px 15px;
`;

const Container = styled.div`
    position: relative;
    border-radius: 10px;
    border: 3px solid #e8e8e8;
    display: flex;
    align-items: stretch;
    height: fit-content;
    flex-direction: column;

    &:focus-within {
        border-color: #c7d4fa;

        svg {
            color: #697783
        }
    }

`;

const TrustWarning = styled.span`
    width: 100%;
    display: flex;
    justify-content: center;
`;

const ButtonArea = styled.div`
    display: flex;
    justify-content: space-between;
    margin-left: 8px;
    margin-bottom: 5px;
    margin-top: 10px;
    margin-right: 8px;
`;


let ChatExpiredCheckIntervalId;

export async function checkChatExpired() {
  return await fetch(`${window.Cria.chatApiUrl}/chats/${window.Cria.chatId}/exists`);
}

export default class QueryBox extends Component {

  static CHAT_TIMEOUT = 60 * 1000;

  #sendButtonId = "query-send-button";
  #mounted = true;
  #chatExpiredCheckInterval = 120 * 1000;
  #chatExpired = false;
  state = {isLoading: false};

  componentDidMount() {

    // Only on mount
    if (!this.#mounted) return;
    this.#mounted = false;

    clearInterval(ChatExpiredCheckIntervalId)
    ChatExpiredCheckIntervalId = setInterval(this.checkChatExpired.bind(this), this.#chatExpiredCheckInterval);
    document.addEventListener("chatDispatch", this.onChatDispatch.bind(this));

  }

  onChatDispatch(event) {
    if (this.state.isLoading) return;

    const content = event.detail;

    if (content.length < 1) {
      return;
    }

    // Loading fails
    this.setLoading(true);

    this.sendChat(content)
      .catch(() => this.setLoading(false))
      .finally(() => this.setLoading(false));

  }

  setLoading(isLoading) {
    this.setState({isLoading: isLoading});
  }

  onChatTimeout() {
    if (!this.state.isLoading) return;
    this.setLoading(false);
  }

  getQueryBoxTheme() {
    return getTheme() || "#1d40a6";
  }

  async checkChatExpired() {
    if (this.chatExpired) return;
    const response = await checkChatExpired();

    try {
      const json = await response.json() || {};

      if (json.code === "SUCCESS") {

        // Case 1) Chat expired
        if (json.exists === false) {
          this.#chatExpired = true;
          document.dispatchEvent(new CustomEvent("chatExpired"));
          clearInterval(ChatExpiredCheckIntervalId);
        }

        // Case 2) Chat not expired
        else if (json.exists === true) {
        }

        // Case 3) Invalid response
        else {
          // noinspection ExceptionCaughtLocallyJS
          throw new Error("Invalid!")
        }
      }

    } catch (e) {
      // If there's an error, clear the interval rather than risk spamming forever
      clearInterval(ChatExpiredCheckIntervalId);
    }

  }

  async sendChat(content) {

    // Set timeout
    this.setLoading(true);
    setTimeout(this.onChatTimeout.bind(this), QueryBox.CHAT_TIMEOUT);

    document.dispatchEvent(new CustomEvent("chatSend", {detail: content}));

    let response;
    try {
      response = await fetch(
        `${window.Cria.chatApiUrl}/embed/${window.Cria.botId}/send`,
        {
          method: "POST",
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            chatId: window.Cria.chatId,
            prompt: content
          })
        }
      );
    } catch (ex) {
      console.log(ex);
      return;
    }

    const json = await response.json()

    if (json?.code === "NOT_FOUND") {
      document.dispatchEvent(new CustomEvent("chatExpired", {detail: json}));
      return;
    }

    // Log errors
    if (json?.code !== "SUCCESS") {
      console.error("Chat Send Failed:", json);
      json.reply = `Chat failed to send due to an error. Please try again later.`
    }

    document.dispatchEvent(new CustomEvent("chatReply", {detail: json}));

  }

  render() {

    return (
      <OuterContainer id={"queryBox"}>
        <SubOuterContainer>
          <BotTrustWarning/>
          <Container $boxTheme={this.getQueryBoxTheme()}>
            <QueryArea isLoading={this.state.isLoading}/>
            <ButtonArea>
              <div>
                <ResetChat
                  id={"reset-chat-button"}
                />
              </div>
              <div>
                <SpeechAutoPlay/>
                <SendMessage
                  id={this.#sendButtonId}
                  onClick={() => document.dispatchEvent(new CustomEvent("sendButtonClicked"))}
                  className={this.state.isLoading ? "send-woosh" : ""}
                />
              </div>
            </ButtonArea>
          </Container>
          <PoweredByAura/>
        </SubOuterContainer>
      </OuterContainer>
    )
  }
}
