import {styled} from "styled-components";

export const PoweredBy = styled.a`
    font-size: 9px;
    color: #9a9999;
    display: flex;
    margin-top: 5px;
    margin-bottom: -8px;
    justify-content: center;
    text-align: left;
    text-decoration: none;
    width: fit-content;

    &:hover {
        filter: grayscale(0);
        opacity: 1;
        color: ${props => props.$color || "var(--grey-1)"};
        text-decoration: underline;
    }
`;

const PoweredByLogo = styled.svg`
    width: 10px;
    height: 10px;
    margin-top: 1px;
`;

export default function PoweredByAura() {

  return (
    <div style={{display: "flex", justifyContent: "center"}}>
      <PoweredBy
        target={"_blank"}
        href={"https://www.yorku.ca/uit/faculty-and-staff-services/AI/"}
      >Created Using YU AURA
        <PoweredByLogo
          fill={"#9a9999"}
          width="800px"
          height="800px"
          viewBox="0 0 32 32"
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
        >
          <title>lightning-bolt</title>
          <path d="M23.5 13.187h-7.5v-12.187l-7.5 17.813h7.5v12.187l7.5-17.813z"></path>
        </PoweredByLogo>
      </PoweredBy>
    </div>
  )
}