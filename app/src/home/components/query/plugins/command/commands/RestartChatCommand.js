import { Command } from "./Command.js";
import { refreshChatId } from "../../../../chat/ChatExpiredButton.jsx";

export default class RestartChatCommand extends Command {
  static restarting = false;

  static getId() {
    return "restart";
  }

  getDescription() {
    return "Restart the chat";
  }

  isHidden() {
    return true;
  }

  async execute(text, ref = undefined) {
    if (RestartChatCommand.restarting) {
      return `Already restarting!`;
    }

    RestartChatCommand.restarting = true;
    document
      .getElementById("reset-chat-button")
      ?.classList?.add("reset-chat-spin");

    setTimeout(async () => {
      const navigated = await refreshChatId();
      // On success refreshChatId navigates away (full reload), which resets
      // this static flag naturally. On failure it returns without navigating,
      // so we MUST clear the flag here or the reset button stays dead forever.
      if (!navigated) {
        document
          .getElementById("reset-chat-button")
          ?.classList?.remove("reset-chat-spin");
        RestartChatCommand.restarting = false;
      }
    }, 3000);

    return `Restarting the chat in 3 seconds...`;
  }
}
