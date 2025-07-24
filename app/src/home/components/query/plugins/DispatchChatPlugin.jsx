import {useLexicalComposerContext} from "@lexical/react/LexicalComposerContext.js";
import {
    $createParagraphNode,
    $createTextNode,
    $getRoot,
    $getSelection,
    COMMAND_PRIORITY_EDITOR, COMMAND_PRIORITY_LOW, KEY_DOWN_COMMAND,
    KEY_ENTER_COMMAND
} from "lexical";
import {useEffect} from "react";
import {CommandManager} from "./command/CommandManager.jsx";

export function resetEditorToInitialState(editor, initialText = "") {
    let node;

    if (initialText) {
        node = $createTextNode(initialText);
    }

    editor.update(() => {
        const root = $getRoot();
        root.clear();

        const initialParagraph = $createParagraphNode();

        if (node) {
            initialParagraph.append(node);
        }

        root.append(initialParagraph);
    });

    return node;

}

export function dispatchChat(editor) {
    const text = $getRoot().getTextContent().trim();
    resetEditorToInitialState(editor);
    if (!text) return;

    const command = CommandManager.getCommand(text);
    if (command) {
        dispatchCommand(editor, command, text);
    } else {
        editor.setEditable(false);
        document.dispatchEvent(new CustomEvent("chatDispatch", {detail: text}));
    }
    return false;
}

export function dispatchCommand(editor, command, text) {
    editor.setEditable(false);
    document.dispatchEvent(new CustomEvent("commandSend", {detail: {command, text}}));
}

const DispatchChatPlugin = () => {
    const [editor] = useLexicalComposerContext();

    function commandExec(e) {
        if (e && e.shiftKey) {
            return false;
        }

        dispatchChat(editor);
        return false;
    }

    function setEditable() {
        editor.setEditable(true)
    }

    function updateEditor() {
        editor.update(commandExec);
    }

    useEffect(() => {

        editor.registerCommand(
            KEY_ENTER_COMMAND,
            commandExec,
            COMMAND_PRIORITY_LOW
        );

        document.addEventListener("chatReply", setEditable);
        document.addEventListener("commandFinished", setEditable);
        document.addEventListener("sendButtonClicked", updateEditor);

        return () => {
            document.removeEventListener("chatReply", setEditable);
            document.removeEventListener("commandFinished",  setEditable);
            document.removeEventListener("sendButtonClicked", updateEditor);
        }

    }, [editor]);

    return null;
};

export { DispatchChatPlugin };
