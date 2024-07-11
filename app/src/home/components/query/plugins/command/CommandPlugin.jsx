import {useEffect} from "react";
import {useLexicalComposerContext} from "@lexical/react/LexicalComposerContext";
import {
    $getRoot,
    $getSelection,
    $nodesOfType,
    COMMAND_PRIORITY_HIGH,
    createCommand,
    ParagraphNode,
    TextNode
} from "lexical";
import {COMMAND_PREFIX} from "./CommandManager.jsx";
import {$createCommandNode, CommandNode} from "./nodes/CommandNodes.jsx";
import RestartChatCommand from "./commands/RestartChatCommand.js";
import {dispatchCommand} from "../DispatchChatPlugin.jsx";
import ExportCommand from "./commands/ExportCommand.js";

export const COMMAND_COMMAND = createCommand();

/**
 *
 * @type {CommandNode} commandNode
 * @returns {boolean}
 */
function findCommand(_) {
    const selection = $getSelection();

    const paragraphs = $nodesOfType(TextNode);
    // Must be first node & must be selected
    if (paragraphs.length !== 1 || selection.getNodes()[0] !== paragraphs[0]) {
        return false;
    }

    // Detect commands
    const selectedNode = selection.getNodes()[0];
    if (!selectedNode.getTextContent().startsWith(COMMAND_PREFIX)) {
        return false;
    }

    selectedNode.replace($createCommandNode(selectedNode.getTextContent()));
    return false;
}

function commandNodeExists() {
    let exists = false;
    const root = $getRoot();
    root.getChildren().forEach((node) => {
        if (node instanceof ParagraphNode) {
            for (let child of node.getChildren()) {
                if (child instanceof CommandNode) {
                    exists = true;
                }
            }
        }
    });
    return exists;
}

function removeNotCommand() {
    const root = $getRoot();
    root.getChildren().forEach((node) => {
        if (node instanceof ParagraphNode) {
            for (let child of node.getChildren()) {
                if (!(child instanceof CommandNode)) {
                    child.remove();
                }
            }
        }
    });
}


export default function CommandPlugin() {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        editor.registerCommand(
            COMMAND_COMMAND,
            () => {

                if (commandNodeExists()) {
                    removeNotCommand();
                } else {
                    findCommand(editor);
                }

            },
            COMMAND_PRIORITY_HIGH
        )

        const removeUpdateListener = editor.registerUpdateListener(() => {
            editor.dispatchCommand(COMMAND_COMMAND, {/* payload if needed */});
        });

        function commandButtonClicked(event) {
            editor.update(async () => {
                dispatchCommand(editor, event.detail.command, event.detail.command.qualifiedId());
            });
        }

        document.addEventListener("commandButtonClicked",  commandButtonClicked);

        return () => {
            removeUpdateListener();
            document.removeEventListener("commandButtonClicked",  commandButtonClicked);

        };
    }, [editor]);


    return null;
};


