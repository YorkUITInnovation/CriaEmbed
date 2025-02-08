import ReactHowler from 'react-howler';
import {useRef, useState} from "react";
import {styled} from "styled-components";


const SpeechContainer = styled.div`
  cursor: pointer;
`;

const SpeechSVG = styled.svg`
  user-select: none;
  &:hover {
    opacity: 0.9;
  }
`;

const PauseSVG = (
    <SpeechSVG
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        style={{height: "19px", width: "19px", marginRight: "1px", marginTop: "3px"}}
        viewBox="-12 -12 73 73"
        fill={"currentColor"}
    >
        <g id="Layer_2" data-name="Layer 2">
            <g id="invisible_box" data-name="invisible box">
                <rect fill="none"/>
            </g>
            <g id="icons_Q2" data-name="icons Q2">
                <path d="M24,2A22,22,0,1,0,46,24,21.9,21.9,0,0,0,24,2Zm8,29a1.1,1.1,0,0,1-1,1H17a1.1,1.1,0,0,1-1-1V17a1.1,1.1,0,0,1,1-1H31a1.1,1.1,0,0,1,1,1Z"/>
            </g>
        </g>
    </SpeechSVG>
);

const PlaySVG = (
    <SpeechSVG
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        strokeWidth="3.5"
        stroke="currentColor"
        x="0px" y="0px"
        style={{height: "19px", width: "19px", marginRight: "1px", marginTop: "3px"}}
        viewBox="0 0 64 64"
        xmlSpace="preserve"
    >
        <path xmlns="http://www.w3.org/2000/svg" d="M34.12,49.2,20.41,39.32H12V24h7.54l14.58-9.2a.39.39,0,0,1,.59.33V48.88A.39.39,0,0,1,34.12,49.2Z" strokeLinecap="square"/>
        <path xmlns="http://www.w3.org/2000/svg" d="M39.63,24.29a8,8,0,0,1,.16,15.37"/>
        <path xmlns="http://www.w3.org/2000/svg" d="M42.23,18.91A13.66,13.66,0,0,1,42.5,45"/>
    </SpeechSVG>
);





export default function ({messageId, autoPlay = false, isGreeting}) {

    const chatId = isGreeting ? Cria.originalChatId || Cria.chatId : Cria.chatId;
    const url = Cria.chatApiUrl + "/embed/" + chatId + "/speech?messageId=" + messageId + "&language=" + Cria.botLocale;

    const [playing, setPlaying] = useState(autoPlay);
    const ref = useRef(null);

    /*
    Preload MUST be false to avoid pre-rendering Azure speech (which is expensive!!!)
     */
    return (
        <div>
            <ReactHowler
                src={url}
                playing={playing}
                onEnd={() => setPlaying(false)}
                format={["webm"]}
                ref={(_ref) => ref.current = _ref}
                preload={false}
            />
            <SpeechContainer
                onClick={() => {
                    setPlaying(!playing);
                    ref.current.stop();
                }}
            >
                {playing ? PauseSVG : PlaySVG}
            </SpeechContainer>
        </div>
    );
}
