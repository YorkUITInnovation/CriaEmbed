import {StartText} from "../../chat/ChatSystemMessage.jsx";

export default function BotTrustWarning() {

  return (
    <StartText>{Cria.botTrustWarning || "AI makes mistakes. Check important info."}</StartText>
  )
}