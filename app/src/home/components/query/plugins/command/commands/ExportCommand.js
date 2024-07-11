import {Command} from "./Command.js";

export default class ExportCommand extends Command {

    static getId() {
        return "export";
    }

    getDescription() {
        return "Export chat page"
    }

    hideInPrint() {
        return true;
    }

    async execute(text, ref = undefined) {

        setTimeout(() => {
            window.print();
        }, 300);

        return `Exported the chat!`;
    }
}
