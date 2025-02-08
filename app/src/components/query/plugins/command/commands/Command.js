import {COMMAND_PREFIX} from "../CommandManager.jsx";


export class Command {

    static getId() {
        return "command";
    }

    static qualifiedId() {
        return COMMAND_PREFIX + this.getId();
    }

    qualifiedId() {
        return this.constructor.qualifiedId();
    }

    getArgs(text) {
        return text.split(" ")?.slice(1) || []
    }

    hideInPrint() {
        return false;
    }

    render(text, theme) {
        const containerElement = document.createElement("span");
        containerElement.classList.add("commandNode");

        const textSplits = text.split(" ");
        const commandElement = document.createElement("span");
        commandElement.classList.add("commandSubNode");
        commandElement.textContent = text;
        commandElement.style.setProperty("--theme", theme);
        containerElement.appendChild(commandElement);

        if (textSplits.length === 1 && this.argsText()) {
            commandElement.setAttribute("placeholder", this.argsText());
        }

        return containerElement;

    }

    isHidden() {
        return false;
    }

    argsText() {
        return null;
    }

    /**
     *
     * @param {string} text
     * @param {ChatList | undefined} ref
     * @return {Promise<string>}
     */
    async execute(text, ref = undefined) {
        return "[NOT IMPLEMENTED]";
    }

    getSyntax() {
        const qualId = this.constructor.qualifiedId();
        const argsText = this.argsText();

        if (!argsText) return qualId;

        return `${qualId} ${argsText}</strong>`;
    }

    getDescription() {
        return "";
    }

    argMismatchResponse(reason = "Argument mismatch.") {
        const reasonText = reason ? " " + reason + " " : " ";
        return `${reasonText}<i>Syntax: ${this.getSyntax()}<strong></i>`
    }



}
