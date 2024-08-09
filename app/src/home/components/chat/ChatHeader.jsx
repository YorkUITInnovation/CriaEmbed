import {Component} from "react";
import {styled} from "styled-components";
import {isDarkBasedOnBgColor, pickFontColorFromBg} from "./Chat.jsx";
import PrintDebug from "../PrintDebug.jsx";

const Container = styled.div`
  width: 100%;
  height: 85px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  background: ${props => props.$bgColor}; 
  justify-content: space-between;
  color: ${(props) => pickFontColorFromBg(props.$bgColor)};
  box-shadow: 0 2px 5px 2px rgba(0, 0, 0, 0.15);
  margin-bottom: 8px;
`;

const TextContainer = styled.div`
  margin-left: 20px;
  display: flex;
  flex-direction: column;
`;

const Logo = styled.img`
  pointer-events: none;
  height: 36px;
  margin-bottom: -3px;
  filter: ${(props) => props.$isDarkBg ? 'invert(0.8)' : 'invert(0)'};
`;

const LogoLink = styled.a`
  cursor: pointer;
  margin-left: 20px;
  margin-right: 14px;
  user-select: none;

  &:hover {
    opacity: 0.8;
  }
  
  &:active {
    opacity: 0.6;
  }
  
`;

const Header1 = styled.span`
  font-size: 20px;
  font-weight: bold;
`;

const Header2 = styled.span`
  font-size: 13px;
`;

export function getTheme() {

    const embedTheme = window.Cria.embedTheme;

    if (!embedTheme) {
        return null;
    }

    if (!(/^#[0-9A-F]{6}$/i.test(embedTheme))) {
        return null;
    }

    return embedTheme;

}

export default class ChatHeader extends Component {

    logoId = "cria-logo";
    isJumping = false;
    jumpCount = 0;

    constructor(props) {
        super(props);
        this.embedTheme = getTheme();
    }


    doCriaJump() {
        if (this.isJumping) return;
        this.isJumping = true;
        this.jumpCount++;

        const criaLogo = document.getElementById(this.logoId);
        let animationClass, animationDuration;

        if (this.jumpCount % 10 === 0) {
            new Audio("/sounds/portal.mp3").play().then();
            animationClass = "cria-portal";
            animationDuration = 950;
        } else if (this.jumpCount % 5 === 0) {
            new Audio("/sounds/woosh.mp3").play().then();
            animationClass = "cria-flip";
            animationDuration = 500;
        } else {
            new Audio("/sounds/pop.mp3").play().then();
            animationClass = "cria-jump";
            animationDuration = 500;
        }

        // Reset CSS
        criaLogo.style.animationDuration = `${animationDuration}ms`;
        criaLogo.classList.remove("cria-flip", "cria-jump", "cria-portal");
        criaLogo.classList.add(animationClass);

        // Update when finished
        setTimeout(() => {
            criaLogo.classList.remove(animationClass);
            this.isJumping = false;
        }, animationDuration);

    }

    render() {

        const bgTheme = getTheme();

        let logoEnabled;
        if (window.Cria.watermarkEnabled !== undefined) {
            logoEnabled = window.Cria.watermarkEnabled;
        } else {
            logoEnabled = true;
        }

        let logo;
        if (logoEnabled) {
            logo = (
                <LogoLink
                    id={this.logoId}
                    target="_blank"
                    href={window.Cria.criaSiteUrl}
                    onMouseDown={this.doCriaJump.bind(this)}
                >
                    <Logo
                        $isDarkBg={isDarkBasedOnBgColor(bgTheme)}
                        src={"/icons/cria.png"}
                    />
                </LogoLink>
            )
        }

        return (
            <Container $bgColor={bgTheme || "rgb(192, 38, 38)"}>
                <TextContainer>
                    <Header1>
                        {window.Cria.botName || "Course Assistant"}
                    </Header1>
                    <Header2>
                        {window.Cria.botSubName || "SAMPLE COURSE"}
                    </Header2>
                </TextContainer>
                {logo}
            </Container>
        );
    }
}
