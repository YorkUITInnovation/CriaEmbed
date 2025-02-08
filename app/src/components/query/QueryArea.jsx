import {Component} from "react";
import {AutoFocusPlugin} from "@lexical/react/LexicalAutoFocusPlugin.js";
import {LexicalComposer} from "@lexical/react/LexicalComposer.js";
import {ContentEditable} from "@lexical/react/LexicalContentEditable.js";
import {PlainTextPlugin} from "@lexical/react/LexicalPlainTextPlugin.js";
import {CommandNode} from "./plugins/command/nodes/CommandNodes.jsx";
import {DispatchChatPlugin} from "./plugins/DispatchChatPlugin.jsx";
import CommandPlugin from "./plugins/command/CommandPlugin.jsx";
import PlaceholderPlugin from "./plugins/PlaceholderPlugin.jsx";
import CommandTabPlugin from "./plugins/command/CommandTabPlugin.jsx";
import {OverrideContentsPlugin} from "./plugins/OverrideContentsPlugin.jsx";


const InitialConfig = {
    namespace: "CriaInput",
    theme: {},
    nodes: [CommandNode]
}

export default class QueryArea extends Component {

    static ElementId = "query-text-area";

    constructor(props) {
        super(props);
        this.initialConfig = {...InitialConfig, onError: this.onError.bind(this)}

    }

    elementId = QueryArea.ElementId;
    state = {editor: null, html: ""}

    onError(error) {
        console.error(error);
    }

    render() {
        return (
             <LexicalComposer
                 initialConfig={{...this.initialConfig}}
                 id={this.elementId}
                 data-gramm_editor="false"
             >
                 <PlainTextPlugin
                     contentEditable={
                     <ContentEditable id={this.elementId} className={"queryTextArea"}/>
                 }
                     ErrorBoundary={this.onError.bind(this)}
                     placeholder={null}/>
                 <DispatchChatPlugin />
                 <PlaceholderPlugin />
                 <CommandPlugin />
                 <CommandTabPlugin />
                 <AutoFocusPlugin />
                 <OverrideContentsPlugin />
             </LexicalComposer>
        );

    }
}
