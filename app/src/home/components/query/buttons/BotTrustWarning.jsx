import {StartText} from "../../chat/ChatSystemMessage.jsx";


export default function BotTrustWarning() {

  return (
    <StartText>{Cria.botTrustWarning || "AI generated content. Be sure to check for accuracy."}</StartText>
  )
}
