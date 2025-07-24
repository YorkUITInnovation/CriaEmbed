import {Command} from "./Command.js";
import {checkChatExpired} from "../../../QueryBox.jsx";

export default class ClearChatCommand extends Command {

    static getId() {
        return "clear";
    }

    getDescription() {
        return "Clear messages"
    }

    async execute(text, ref) {

        const args = this.getArgs(text);

        let amount = undefined;
        if (args[0]) {
            let amountInt = parseInt(args[0])
            if (isNaN(amountInt)) {
                return this.argMismatchResponse("Argument [amount] must be a number.");
            }
            if (amountInt > 0) {
                amount = amountInt;
            }
        }

        let chats = ref.state.chats;
        amount ||= chats.length;
        amount = Math.min(chats.length, amount);

        chats = chats.splice(0, Math.max(0, chats.length - (amount)));
        ref.setState({chats: chats});

        await checkChatExpired();
        return `Successfully cleared ${amount} messages.`
    }

    argsText() {
        return "[amount]";
    }



}
