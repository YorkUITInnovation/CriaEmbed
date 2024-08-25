import {Command} from "./Command.js";
import {checkChatExpired} from "../../../QueryBox.jsx";
import {CommandManager} from "../CommandManager.jsx";

export default class CommandListCommand extends Command {

    static getId() {
        return "help";
    }

    getDescription() {
        return "List all commands"
    }

    isHidden() {
        return true;
    }

    async execute(text, ref) {

        const syntaxes = [];

        for (let command of CommandManager.getCommands()) {

            if (!command.isHidden()) {
                let description = "";
                if (command.getDescription()) {
                    description = ` - <i>${command.getDescription()}</i>`
                }

                syntaxes.push(
                    "<li><strong>" + command.getSyntax() + "</strong>" + description + "</li>"
                );
            }

        }

        return `There are ${syntaxes.length} commands available:<br/><ul style="padding-left: 20px">${syntaxes.join("\n")}</ul>`
    }



}
