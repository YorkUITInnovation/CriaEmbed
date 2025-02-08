import {useLexicalComposerContext} from "@lexical/react/LexicalComposerContext.js";
import {
    $createNodeSelection,
    $createRangeSelection,
    $createTextNode,
    $getRoot,
    $getSelection, $isParagraphNode, $isRangeSelection, $isTextNode,
    $nodesOfType, $setSelection,
    COMMAND_PRIORITY_EDITOR,
    ParagraphNode,
    SELECTION_CHANGE_COMMAND,
    TextNode
} from "lexical";
import {useEffect} from "react";
import {dispatchChat, resetEditorToInitialState} from "./DispatchChatPlugin.jsx";
import {$moveCaretBy} from "./command/CommandTabPlugin.jsx";

const hasLoaded = false;


export const OverrideContentsPlugin = () => {

    const [editor] = useLexicalComposerContext();

    function simulateTyping(textToType) {
        editor.update(() => {
            const root = $getRoot();
            const selection = $getSelection();

            if (selection !== null) {
                const textNode = $createTextNode(textToType);
                selection.insertNodes([textNode]);
            } else {
                const textNode = $createTextNode(textToType);
                root.append(textNode);
            }
        });
    }

    function handleAddText(event) {
        simulateTyping(event.detail);
    }

    function handleReplaceText(event) {
        editor.update(() => {
            const root = $getRoot();
            root.clear();
            handleAddText(event);
        });

        editor.update(() => {
            dispatchChat(editor);
        })
    }

    useEffect(() => {
        document.addEventListener("replaceEditorText", handleReplaceText);
        document.addEventListener("addEditorText", handleReplaceText);
        return () => {
            document.removeEventListener("addEditorText", handleReplaceText);
            document.removeEventListener("replaceEditorText", handleReplaceText);
        }
    }, [editor]);

    return null;
};

