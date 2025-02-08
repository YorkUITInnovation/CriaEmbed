import {useEffect, useState} from "react";
import {styled} from "styled-components";
import ChatList from "./components/chat/ChatList.jsx";
import QueryBox from "./components/query/QueryBox.jsx";
import ChatHeader from "./components/chat/ChatHeader.jsx";
import PrintDebug from "./components/PrintDebug.jsx";
import VoiceMode from "./components/chat/VoiceMode.jsx";
import {useRemoteStore} from "@/hooks/stores/remote-store.ts";
import Config from "@/hooks/stores/remote/config.ts";
import {useGlobalsStore} from "@/hooks/stores/local/globals.tsx";

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

/*


    // Fetch config
    window.Cria.fetchConfig().then(() => {
      document.dispatchEvent(new CustomEvent("criaConfigLoaded"));
      setConfigLoaded(true);
    });
 */

export default function Chat() {

  const configStore = useRemoteStore(Config);
  const {chatExpired, setChatExpired} = useGlobalsStore();
  const onChatExpired = () => setChatExpired(true);


  const [configLoaded, setConfigLoaded] = useState(false);

  // Handle chat expiration state
  useEffect(() => {
    document.addEventListener("chatExpired", onChatExpired);
    return () => document.removeEventListener("chatExpired", onChatExpired);
  }, []);

  if (!configStore.data) return null;

  return (
      <Container>
        <PrintDebug/>
        <ChatHeader/>
        <ChatList/>
        {!chatExpired && <QueryBox/>}
        {!chatExpired && <VoiceMode/>}
      </Container>
  )

}

