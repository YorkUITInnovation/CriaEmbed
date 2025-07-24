import {Command} from "./Command.js";
import {refreshChatId} from "../../../../chat/ChatExpiredButton.jsx";

export default class RestartChatCommand extends Command {

    static restarting = false;

    static getId() {
        return "restart";
    }

    getDescription() {
        return "Restart the chat"
    }

    isHidden() {
        return true;
    }

    async execute(text, ref = undefined) {
        if (RestartChatCommand.restarting) {
            return `Already restarting!`;
        }


        document.getElementById("reset-chat-button")?.classList?.add("reset-chat-spin");
        setTimeout(() => {
            document.getElementById("reset-chat-button")?.classList?.remove("reset-chat-spin");
           refreshChatId();
        }, 3000);

        RestartChatCommand.restarting = true;
        return `Restarting the chat in 3 seconds...`;
    }
}
