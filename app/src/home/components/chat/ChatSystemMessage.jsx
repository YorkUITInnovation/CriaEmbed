import {styled} from "styled-components";

const StartText = styled.span`
  font-size: 10.5px;
  color: var(--grey-1);
  padding: 6px;
  display: flex;
  justify-content: center;
  margin-top: 2px;
  margin-bottom: 2px;
`;

export const CHAT_STARTED_AT = {
    "en-US": "chat started at",
    "fr-FR": "commencé à",
}

export const CHAT_EXPIRED_AT = {
    "en-US": "chat expired at",
    "fr-FR": "la conversation a expiré à",
}

export function ChatSystemMessage({messageMap, timestamp}) {

    return (
        <StartText>
            {(messageMap[Cria.botLocale] || messageMap["en-US"] || "N/A").toUpperCase()} {timestamp}
        </StartText>
    )

}



