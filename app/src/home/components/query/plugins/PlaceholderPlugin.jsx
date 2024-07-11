import {useEffect} from "react";
import {useLexicalComposerContext} from "@lexical/react/LexicalComposerContext.js";
import {$getSelection, $nodesOfType, COMMAND_PRIORITY_HIGH, createCommand, ParagraphNode, RootNode} from "lexical";

import "./PlaceholderPlugin.scss";

const PLACEHOLDER_TRANSLATIONS = {
    "en-US": "Type /help for a list of commands...",
    "fr-FR": "Tapez /help pour obtenir une liste des commandes..."
}

export const htmlAttribute = "placeholder";

export function AddPlaceholder(editor, paragraph) {
    const placeholder = PLACEHOLDER_TRANSLATIONS[Cria.botLocale] || PLACEHOLDER_TRANSLATIONS["en-US"];
    editor.getElementByKey(paragraph.getKey())?.setAttribute(htmlAttribute, placeholder);
}

export const CHANGE_COMMAND = createCommand();

export default function PlaceholderPlugin() {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        const updateListener = (_) => {

            const sel = $getSelection();
            if (!sel) return;
            const paragraphNodes = $nodesOfType(ParagraphNode);
            const firstNode = paragraphNodes[0];
            const selectedNode = sel.getNodes()[0].getParent();

            for (const node of paragraphNodes) {
                const el = editor.getElementByKey(node.getKey());
                el?.removeAttribute(htmlAttribute);
            }

            if (paragraphNodes.length > 1) {
                return false;
            }

            if (selectedNode.getType() === RootNode.getType()) {
                AddPlaceholder(editor, firstNode);
            }
        };


        editor.registerCommand(CHANGE_COMMAND, updateListener, COMMAND_PRIORITY_HIGH);
        return editor.registerUpdateListener((e) => {
            editor.dispatchCommand(CHANGE_COMMAND, e);
        });

    }, [editor]);

    return null;
}
