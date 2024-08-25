import {Component} from "react";
import {styled} from "styled-components";
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

export default class Home extends Component {

  #mounted = false;
  state = {chatExpired: false, configLoaded: false}

  async componentDidMount() {
    if (this.#mounted) return;
    this.#mounted = true;
    document.addEventListener("chatExpired", () => this.setState({chatExpired: true}));

    // Fetch config
    await window.Cria.fetchConfig()
    document.dispatchEvent(new CustomEvent("criaConfigLoaded"));
    this.setState({configLoaded: true});
  }

  render() {

    if (!this.state.configLoaded) return null;

    return (
      <Container>
        <PrintDebug />
        <ChatHeader/>
        <ChatList/>
        {!this.state.chatExpired ? <QueryBox/> : null}
      </Container>
    )
  }
}
