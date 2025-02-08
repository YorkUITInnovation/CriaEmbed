import {Command} from "./Command.js";
import {checkChatExpired} from "../../../QueryBox.jsx";

export default class PingCommand extends Command {

    static getId() {
        return "ping";
    }

    getDescription() {
        return "Check the server ping"
    }

    async execute(text, ref = undefined) {

        const startTime = Date.now();
        await checkChatExpired();
        const endTime = Date.now();

        return `Response in ${Math.round((endTime - startTime) * 100) / 100} ms.`
    }
}
