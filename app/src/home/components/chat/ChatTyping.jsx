import {styled} from "styled-components";

const TypingDot = styled.div`

  @keyframes bounce {
    0%,
    60%,
    100% {
      transform: translateY(0);
    }
    30% {
      transform: translateY(-4px);
    }
  }
  
  width: 4px;
  height: 4px;
  margin-right: 4px;
  background-color: #57585a;
  border-radius: 50%;
  animation-name: bounce;
  animation-duration: 1.3s;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  
  &:first-of-type {
    margin: 0 4px;
  }
  
  &:nth-of-type(2) {
    animation-delay: 0.15s;
  }
  
  &:nth-of-type(3) {
    animation-delay: 0.3s;
  }
`;

const DotContainer = styled.div`
  display: flex;
  margin-top: 7px;
  margin-bottom: 4px;
`

export default function ChatTyping() {
    return (
        <DotContainer>
            <TypingDot key={"dot1"}/>
            <TypingDot key={"dot2"}/>
            <TypingDot key={"dot3"}/>
        </DotContainer>
    )
}

