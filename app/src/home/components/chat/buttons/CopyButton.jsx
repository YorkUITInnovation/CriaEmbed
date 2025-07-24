import {Component} from "react";
import {styled} from "styled-components";

const CopySVG = styled.svg`
  &:hover {
    opacity: 0.9;
  }
`;

const CopyContainer = styled.div`
  cursor: pointer;
`;

export function copyToClipboard(text) {
    if (navigator?.clipboard?.writeText) {
        return navigator.clipboard.writeText(text);
    }
    return Promise.reject('The Clipboard API is not available.');
}

export default class CopyButton extends Component {

    state = {inClick: false};
    copyDuration = 700;
    svgStyle = {height: "12px", width: "12px", marginRight: "4px", marginTop: "3px"};

    getChatText() {
        return this.getTextExcludingClass(this.props.chatElementId, 'noCopy')?.trim() || "";
    }

    getTextExcludingClass(elementId, excludeClass) {
        const element = document.getElementById(elementId);
        if (!element) return '';

        // Get all text nodes recursively
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
        let textContent = '';

        // Traverse text nodes
        while (walker.nextNode()) {
            let currentNode = walker.currentNode;

            if (currentNode?.parentNode?.classList?.contains(excludeClass)) {
                continue;
            }

            textContent += currentNode.textContent;
        }

        return textContent;
    }

    getSVG() {
        if (this.state.inClick) {
            return (
                <CopySVG
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    xmlnsXlink="http://www.w3.org/1999/xlink"
                    fill={"currentColor"}
                    x="0px" y="0px"
                    style={this.svgStyle}
                    viewBox="0 0 122.881 122.88"
                    enableBackground="new 0 0 122.881 122.88"
                    xmlSpace="preserve"
                >
                    <g>
                        <path fillRule="evenodd" clipRule="evenodd" d="M61.44,0c33.933,0,61.441,27.507,61.441,61.439 c0,33.933-27.508,61.44-61.441,61.44C27.508,122.88,0,95.372,0,61.439C0,27.507,27.508,0,61.44,0L61.44,0z M34.106,67.678 l-0.015-0.014c-0.785-0.718-1.207-1.685-1.256-2.669c-0.049-0.982,0.275-1.985,0.984-2.777c0.01-0.011,0.019-0.021,0.029-0.031 c0.717-0.784,1.684-1.207,2.668-1.256c0.989-0.049,1.998,0.28,2.792,0.998l12.956,11.748l31.089-32.559v0 c0.74-0.776,1.723-1.18,2.719-1.204c0.992-0.025,1.994,0.329,2.771,1.067v0.001c0.777,0.739,1.18,1.724,1.205,2.718 c0.025,0.993-0.33,1.997-1.068,2.773L55.279,81.769c-0.023,0.024-0.048,0.047-0.073,0.067c-0.715,0.715-1.649,1.095-2.598,1.13 c-0.974,0.037-1.963-0.293-2.744-1L34.118,67.688L34.106,67.678L34.106,67.678L34.106,67.678z"/>
                    </g>
                </CopySVG>
            )
        }

        return (
            <CopySVG
                version="1.1"
                fill={"currentColor"}
                xmlns="http://www.w3.org/2000/svg"
                xmlnsXlink="http://www.w3.org/1999/xlink"
                x="0px" y="0px" viewBox="0 0 115.77 122.88"
                xmlSpace="preserve"
                style={this.svgStyle}
            ><style type="text/css"></style>
                <g>
                    <path className="st0" d="M89.62,13.96v7.73h12.19h0.01v0.02c3.85,0.01,7.34,1.57,9.86,4.1c2.5,2.51,4.06,5.98,4.07,9.82h0.02v0.02 v73.27v0.01h-0.02c-0.01,3.84-1.57,7.33-4.1,9.86c-2.51,2.5-5.98,4.06-9.82,4.07v0.02h-0.02h-61.7H40.1v-0.02 c-3.84-0.01-7.34-1.57-9.86-4.1c-2.5-2.51-4.06-5.98-4.07-9.82h-0.02v-0.02V92.51H13.96h-0.01v-0.02c-3.84-0.01-7.34-1.57-9.86-4.1 c-2.5-2.51-4.06-5.98-4.07-9.82H0v-0.02V13.96v-0.01h0.02c0.01-3.85,1.58-7.34,4.1-9.86c2.51-2.5,5.98-4.06,9.82-4.07V0h0.02h61.7 h0.01v0.02c3.85,0.01,7.34,1.57,9.86,4.1c2.5,2.51,4.06,5.98,4.07,9.82h0.02V13.96L89.62,13.96z M79.04,21.69v-7.73v-0.02h0.02 c0-0.91-0.39-1.75-1.01-2.37c-0.61-0.61-1.46-1-2.37-1v0.02h-0.01h-61.7h-0.02v-0.02c-0.91,0-1.75,0.39-2.37,1.01 c-0.61,0.61-1,1.46-1,2.37h0.02v0.01v64.59v0.02h-0.02c0,0.91,0.39,1.75,1.01,2.37c0.61,0.61,1.46,1,2.37,1v-0.02h0.01h12.19V35.65 v-0.01h0.02c0.01-3.85,1.58-7.34,4.1-9.86c2.51-2.5,5.98-4.06,9.82-4.07v-0.02h0.02H79.04L79.04,21.69z M105.18,108.92V35.65v-0.02 h0.02c0-0.91-0.39-1.75-1.01-2.37c-0.61-0.61-1.46-1-2.37-1v0.02h-0.01h-61.7h-0.02v-0.02c-0.91,0-1.75,0.39-2.37,1.01 c-0.61,0.61-1,1.46-1,2.37h0.02v0.01v73.27v0.02h-0.02c0,0.91,0.39,1.75,1.01,2.37c0.61,0.61,1.46,1,2.37,1v-0.02h0.01h61.7h0.02 v0.02c0.91,0,1.75-0.39,2.37-1.01c0.61-0.61,1-1.46,1-2.37h-0.02V108.92L105.18,108.92z"/>
                </g>
            </CopySVG>
        )
    }

    onMouseDown() {
        if (this.state.inClick) return;
        this.setState({inClick: true});
        copyToClipboard(this.getChatText());
        setTimeout(() => this.setState({inClick: false}), this.copyDuration);
    }

    render() {
        return (
            <CopyContainer onMouseDown={this.onMouseDown.bind(this)}>
                {this.getSVG()}
            </CopyContainer>
        )
    }
}
