import {TextNode} from "lexical";
import "./CommandNodeStyle.scss";
import {COMMAND_PREFIX, CommandManager} from "../CommandManager.jsx";

class CommandNode extends TextNode {

    constructor(text, key) {
        super(text, key);
    }

    static getType() {
        return 'command';
    }

    static clone(node) {
        return new CommandNode(node.__text, node.__key);
    }

    /**
     *
     * @param {Command} command
     */
    setAs(command) {
        this.setTextContent(command.constructor.qualifiedId())
    }

    /**
     * Refresh node value
     *
     * @param config
     * @param editor
     * @returns {HTMLSpanElement}
     */
    createDOM(config, editor) {
        return CommandManager.render(this.__text);
    }

    isValidCommand() {
        return Boolean(CommandManager.getCommand(this.__text))
    }

    updateDOM(prevNode, dom, config) {
        return true;
    }

    exportJSON() {
        return super.exportJSON();
    }

    importJSON() {

    }

}

export function $createCommandNode(text) {
    return new CommandNode(text);
}

export function $isCommandNode(node) {
    return node instanceof CommandNode;
}

export {CommandNode};
