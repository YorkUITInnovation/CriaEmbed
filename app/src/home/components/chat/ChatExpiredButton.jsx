import { getTheme } from "./ChatHeader.jsx";
import { styled } from "styled-components";
import { pickFontColorFromBg } from "./Chat.jsx";

const ButtonContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 3px;
  margin-bottom: 20px;
`;

const Button = styled.a`
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  text-decoration: none;
  cursor: pointer;
  user-select: none;

  &:hover {
    opacity: 0.9;
  }

  &:active {
    opacity: 0.8;
  }
`;

// Returns true only when it kicks off a navigation to the new chat. Callers rely
// on a false return to re-enable the reset button after a failed restart.
export async function refreshChatId() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(
      `${window.Cria.chatApiUrl}/chats/${window.Cria.chatId}/create`,
      { method: "POST", signal: controller.signal }
    );

    const json = (await response.json()) || {};

    if (json.code !== "SUCCESS") {
      console.error("Failed to fetch new chat!");
      return false;
    }

    const url = new URL(window.location.href);
    url.searchParams.set("chatId", json.chatId);
    url.searchParams.set("originalChatId", Cria.originalChatId || Cria.chatId);
    window.location.href = url.toString();
    return true;
  } catch (ex) {
    console.error("Failed to fetch new chat!", ex);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export default function ChatExpiredButton() {
  const bgColor = getTheme();
  const fgColor = pickFontColorFromBg(bgColor);

  return (
    <ButtonContainer>
      <Button
        style={{ background: bgColor, color: fgColor }}
        onClick={refreshChatId}
      >
        Restart Chat
      </Button>
    </ButtonContainer>
  );
}
