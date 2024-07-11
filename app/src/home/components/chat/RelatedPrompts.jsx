import {Component} from "react";
import {styled} from "styled-components";
import {getTheme} from "./ChatHeader.jsx";
import {pickFontColorFromBg} from "./Chat.jsx";

const RelatedPromptContainer = styled.div`
    margin-top: 10px;
    margin-bottom: 5px;
    display: block;
`;

const RelatedPromptButton = styled.button`
    font-size: 0.9em;
    display: block;
    border: 1.5px solid ${(props) => props.$bgColor};
    color: ${(props) => props.$bgColor};
    padding: 8px 15px;
    border-radius: 5px;
    max-width: 80%;
    background: none;
    box-shadow: 0 2px 3px 2px rgba(0, 0, 0, 0.025);
    text-align: left;
    cursor: pointer;
    
    &:not(:last-child) {
        margin-bottom: 8px;
    }
    
    &:hover {
        opacity: 0.8;
    }
    
    &:active {
        opacity: 0.6;
    }
    
    
`;

export default class RelatedPrompts extends Component {

  constructor(props) {
    super(props);
  }


  getPromptButtons() {
    const entries = []

    for (let relatedPrompt of this.props.relatedPrompts) {
      entries.push(
        <RelatedPromptButton
          className={"noCopy"}
          $bgColor={getTheme()}
          $fontColor={pickFontColorFromBg()}
          key={Math.random().toString()}
          onClick={() => {
            document.dispatchEvent(
              new CustomEvent("addEditorText", {detail: relatedPrompt.prompt})
            )
          }}
        >
          {relatedPrompt.label}
        </RelatedPromptButton>
      )
    }

    return entries;

  }

  render() {
    return (
      <RelatedPromptContainer>
        {this.getPromptButtons()}
      </RelatedPromptContainer>
    )
  }

}