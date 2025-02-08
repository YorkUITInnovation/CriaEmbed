import React, {useEffect, useState} from "react";
import {styled} from "styled-components";
import {getTheme} from "./ChatHeader.jsx";
import {hslToRgb, rgbToHsl} from "@/utils.js";

function getDarker() {
  const theme = getTheme();
  let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(theme);

  if (!result) return "rgb(25, 25, 25)"; // Return original if invalid

  let r = parseInt(result[1], 16);
  let g = parseInt(result[2], 16);
  let b = parseInt(result[3], 16);

  // Convert RGB to HSL
  let {h, s, l} = rgbToHsl(r, g, b);

  // Reduce saturation and lightness
  s *= 0.15; // Reduce saturation
  l *= 0.2; // Darken

  // Convert back to RGB
  let {r: newR, g: newG, b: newB} = hslToRgb(h, s, l);
  return {r: newR, g: newG, b: newB};
}


const VoiceModeContainer = styled.div`
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    background: ${(p) => p.$bg};
    animation: fade-in 150ms;

    @keyframes fade-in {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
`;


const VoiceModeTray = styled.div`
`;

const VoiceCircle = styled.div`
    background: white;
    aspect-ratio: 1 / 1;
    border-radius: 50%;
    margin: 0 auto;
    margin-top: 10px;
    width: 30%;
    max-width: 100px;
`

const VoiceModeButtons = styled.div`
    display: flex;
    justify-content: center;
    column-gap: 10%;
`

const VoiceModeButton = styled.button`
    background: rgb(250, 250, 250);
    width: 20%;
    max-width: 75px;
    aspect-ratio: 1/1;
    border-radius: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    border: none;
    cursor: pointer;

    &:hover {
        background: rgb(200, 200, 200);
        opacity: 0.9;
    }

`;

const VoiceModeMicSVG = styled.svg`
    cursor: pointer;
`;

const Instruction = styled.span`
    color: rgb(201, 198, 198);
    font-size: 12px;
    display: flex;
    width: 100%;
    justify-content: center;
    margin-bottom: 20px;
`;

export function MicButton({darker}) {

  const [isListening, setIsListening] = useState(false);

  return (
    <VoiceModeButton
      style={{background: isListening ? "rgba(138,70,70,0.53)" : undefined}}
      onClick={() => setIsListening(!isListening)}
    >
      <VoiceModeMicSVG
        style={
          {width: "50%", height: "50%", color: isListening ? "rgb(210,75,75)" : darker}
        }
        aria-hidden="true" viewBox="0 0 384 512" xmlns="http://www.w3.org/2000/svg">
        <path fill={"currentColor"}
              d="M192 0C139 0 96 43 96 96V256c0 53 43 96 96 96s96-43 96-96V96c0-53-43-96-96-96zM64 216c0-13.3-10.7-24-24-24s-24 10.7-24 24v40c0 89.1 66.2 162.7 152 174.4V464H120c-13.3 0-24 10.7-24 24s10.7 24 24 24h72 72c13.3 0 24-10.7 24-24s-10.7-24-24-24H216V430.4c85.8-11.7 152-85.3 152-174.4V216c0-13.3-10.7-24-24-24s-24 10.7-24 24v40c0 70.7-57.3 128-128 128s-128-57.3-128-128V216z"></path>
      </VoiceModeMicSVG>
    </VoiceModeButton>
  )
}

export function ToggleButton({darker}) {

  return (
    <VoiceModeButton
      onClick={() => document.dispatchEvent(new CustomEvent('voiceModeEnabled', {detail: false}))}
    >
      <VoiceModeMicSVG
        style={
          {width: "55%", height: "55%", color: darker}
        }
        aria-hidden="true" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path fill={"currentColor"}
              d="M4.70718 2.58574C4.31666 2.19522 3.68349 2.19522 3.29297 2.58574L2.58586 3.29285C2.19534 3.68337 2.19534 4.31654 2.58586 4.70706L9.87877 12L2.5859 19.2928C2.19537 19.6834 2.19537 20.3165 2.5859 20.7071L3.293 21.4142C3.68353 21.8047 4.31669 21.8047 4.70722 21.4142L12.0001 14.1213L19.293 21.4142C19.6835 21.8047 20.3167 21.8047 20.7072 21.4142L21.4143 20.7071C21.8048 20.3165 21.8048 19.6834 21.4143 19.2928L14.1214 12L21.4143 4.70706C21.8048 4.31654 21.8048 3.68337 21.4143 3.29285L20.7072 2.58574C20.3167 2.19522 19.6835 2.19522 19.293 2.58574L12.0001 9.87865L4.70718 2.58574Z"
        />
      </VoiceModeMicSVG>
    </VoiceModeButton>
  )
}

const PLACEHOLDER_TRANSLATIONS = {
  "en-US": "Click the microphone to speak to AURA",
  "fr-FR": "Cliquez sur le microphone pour parler à AURA"
}

export default function VoiceMode() {
  const [isHidden, setIsHidden] = useState(true);
  const onVoiceModeEnabled = (event) => setIsHidden(!event.detail);

  useEffect(() => {
    document.addEventListener("voiceModeEnabled", onVoiceModeEnabled);
    return () => document.removeEventListener("voiceModeEnabled", onVoiceModeEnabled);
  }, []);

  const darkerRgb = getDarker();
  const darker = `rgb(${darkerRgb.r}, ${darkerRgb.g}, ${darkerRgb.b})`;

  return (
    <VoiceModeContainer $bg={darker} style={{display: isHidden ? 'none' : undefined}}>
      <VoiceCircle/>
      <VoiceModeTray>
        <Instruction>{PLACEHOLDER_TRANSLATIONS[Cria.botLocale] || PLACEHOLDER_TRANSLATIONS["en-US"]}</Instruction>
        <VoiceModeButtons>
          <MicButton darker={darker}/>
          <ToggleButton darker={darker}/>
        </VoiceModeButtons>
      </VoiceModeTray>
    </VoiceModeContainer>
  )
}