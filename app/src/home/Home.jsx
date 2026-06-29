import { Component } from "react";
import { styled } from "styled-components";
import ChatList from "./components/chat/ChatList.jsx";
import QueryBox from "./components/query/QueryBox.jsx";
import ChatHeader from "./components/chat/ChatHeader.jsx";
import PrintDebug from "./components/PrintDebug.jsx";

const Container = styled.div`
  margin: auto;
  height: 100svh; // Property does exist in the modern world :)
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-direction: column;
  outline: 1px solid #e3e3e3;
  box-shadow: 0 0 5px 2px rgba(227, 227, 227, 0.69);
  background: white;
`;

const ErrorContainer = styled.div`
  margin: 0;
  min-height: 100svh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff8f8;
  color: #431414;
  padding: 24px;
`;

const ErrorCard = styled.div`
  max-width: 720px;
  width: 100%;
  border: 1px solid #f1b3b3;
  background: #ffffff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
  white-space: pre-wrap;
  word-break: break-word;
`;

export default class Home extends Component {
  #mounted = false;
  state = {
    chatExpired: false,
    configLoaded: false,
    configError: null,
    standaloneMode: false,
  };

  async componentDidMount() {
    if (this.#mounted) return;
    this.#mounted = true;
    document.addEventListener("chatExpired", () =>
      this.setState({ chatExpired: true })
    );

    const hasRequiredParams = ["chatApiUrl", "botId", "chatId"].every((key) => {
      const value = window.Cria && window.Cria[key];
      return (
        value !== undefined && value !== null && String(value).trim() !== ""
      );
    });

    if (!hasRequiredParams) {
      this.setState({
        standaloneMode: true,
        configLoaded: false,
        configError: null,
      });
      return;
    }

    try {
      // Fetch config
      await window.Cria.fetchConfig();
      document.dispatchEvent(new CustomEvent("criaConfigLoaded"));
      this.setState({ configLoaded: true, configError: null });
    } catch (e) {
      const message =
        (e && e.message ? e.message : "Failed to load embed config") +
        "\n" +
        "Details: " +
        (window.Cria.lastConfigError || "n/a") +
        "\n" +
        "URL: " +
        window.location.href;

      console.error("[CriaEmbedApp] bootstrap failed", e, window.Cria);
      this.setState({ configLoaded: false, configError: message });
    }
  }

  render() {
    if (this.state.standaloneMode) {
      return (
        <ErrorContainer>
          <ErrorCard>
            <strong>Cria Embed App</strong>
            {"\n\n"}
            This URL is intended to be opened by the embed launcher.
            {"\n"}
            Open the chatbot from Moodle course page instead of visiting this
            root URL directly.
          </ErrorCard>
        </ErrorContainer>
      );
    }

    if (this.state.configError) {
      return (
        <ErrorContainer>
          <ErrorCard>
            <strong>Cria embed failed to initialize.</strong>
            {"\n\n"}
            {this.state.configError}
          </ErrorCard>
        </ErrorContainer>
      );
    }

    if (!this.state.configLoaded) return null;

    return (
      <Container>
        <PrintDebug />
        <ChatHeader />
        <ChatList />
        {!this.state.chatExpired ? <QueryBox /> : null}
      </Container>
    );
  }
}
