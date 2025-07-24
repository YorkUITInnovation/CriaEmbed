import {useEffect} from "react";
import {useLexicalComposerContext} from "@lexical/react/LexicalComposerContext";
import {
    $getSelection,
    $nodesOfType,
    $setSelection,
    COMMAND_PRIORITY_LOW,
    KEY_TAB_COMMAND,
    RangeSelection
} from "lexical";
import {CommandNode} from "./nodes/CommandNodes.jsx";
import {CommandManager} from "./CommandManager.jsx";

/**
 *
 * @param offset
 * @param sel
 * @param key
 */
export function $moveCaretBy(offset, sel, key = undefined) {

    sel.anchor.set(key || sel.anchor.key, sel.anchor.offset + offset, sel.anchor.type);
    sel.focus.set(key || sel.focus.key, sel.focus.offset + offset, sel.focus.type);

    $setSelection(sel);

}


function executePlugin(event, editor) {
    const node = $nodesOfType(CommandNode)[0];
    if (!(node instanceof CommandNode)) return false;

    // Prevent tab causing usual motion
    event.preventDefault();
    const text = node.getTextContent()
    const sel = $getSelection();


    // Tab-space
    if (node.isValidCommand() && CommandManager.getCommand(text).argsText()) {
        const text = node.getTextContent();
        if (!text.endsWith(" ")) {
            node.setTextContent(text + " ");
            $moveCaretBy(1, sel);
        }
    // Tab-complete
    } else {
        const closest = CommandManager.closestCommand(text);

        if (closest) {

            /**
             * @type {RangeSelection}
             */

            node.setAs(closest);
            const diff = CommandManager.getAutocompleteRemainder(closest, text)
            const offset = diff.length;
            $moveCaretBy(offset, sel);

        }
    }

}

export default function CommandTabPlugin() {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        return editor.registerCommand(
            KEY_TAB_COMMAND,
            (payload, editor) => {executePlugin(payload, editor)},
            COMMAND_PRIORITY_LOW
        )
    }, [editor]);

    return null;
};


