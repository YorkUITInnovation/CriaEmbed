import {styled} from "styled-components";
import {getTheme} from "./chat/ChatHeader.jsx";
import {pickFontColorFromBg} from "./chat/Chat.jsx";

const DebugContainer = styled.div`
    display: none;
    background: ${(props) => props.$bgColor};
    color: ${(props) => props.$fontColor};
`;

const DataContainer = styled.span`
  width: fit-content;
`;

export default function PrintDebug() {

    return (
        <DebugContainer
            id={"printDebug"}
            $bgColor={getTheme()}
            $fontColor={pickFontColorFromBg()}
        >
           <DataContainer>
               <strong>Bot ID:</strong> {Cria.botId}<br/>
               <strong>Chat ID:</strong> {Cria.chatId}<br/>
           </DataContainer>
        </DebugContainer>
    )
}
