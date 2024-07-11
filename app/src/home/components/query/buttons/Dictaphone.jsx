import React, {useEffect, useState} from 'react';
import 'regenerator-runtime/runtime';
import SpeechRecognition, {useSpeechRecognition} from 'react-speech-recognition';
import {SendSVG} from "./ResetChat.jsx";

function MicrophoneButton(props) {
    return (
        <SendSVG
            style={{marginRight: "5px"}}
            aria-hidden="true" viewBox="0 0 384 512" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path fill={"currentColor"}
                  d="M192 0C139 0 96 43 96 96V256c0 53 43 96 96 96s96-43 96-96V96c0-53-43-96-96-96zM64 216c0-13.3-10.7-24-24-24s-24 10.7-24 24v40c0 89.1 66.2 162.7 152 174.4V464H120c-13.3 0-24 10.7-24 24s10.7 24 24 24h72 72c13.3 0 24-10.7 24-24s-10.7-24-24-24H216V430.4c85.8-11.7 152-85.3 152-174.4V216c0-13.3-10.7-24-24-24s-24 10.7-24 24v40c0 70.7-57.3 128-128 128s-128-57.3-128-128V216z"></path>
        </SendSVG>
    )
}


const Dictaphone = () => {

    const {
        transcript,
        listening,
        resetTranscript,
        browserSupportsSpeechRecognition
    } = useSpeechRecognition();

    const [prevTranscript, setPrevTranscript] = useState('');
    const [wasListening, setWasListening] = useState(listening);

    if (!browserSupportsSpeechRecognition) {
        return null;
    }

    useEffect(() => {
        const getNewText = (prev, current) => current.substring(prev.length);
        const newText = getNewText(prevTranscript, transcript);

        if (newText) {
            document.dispatchEvent(new CustomEvent("addEditorText", {detail: newText}));
        }

        setPrevTranscript(transcript);

        if (wasListening && !listening) {
            resetTranscript();
            setPrevTranscript("");
        }

        setWasListening(listening);
    })

    return (
        <MicrophoneButton
            className={listening ? "speech-listening" : ""}
            onClick={listening ? SpeechRecognition["stopListening"] : SpeechRecognition["startListening"]}
        />
    );


};
export default Dictaphone;
