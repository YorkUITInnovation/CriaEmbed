import { Component, isValidElement } from "react";
import { styled } from "styled-components";
import twemoji from "twemoji";
import DOMPurify from "dompurify";
import { getTheme } from "./ChatHeader.jsx";
import SpeechButton from "./buttons/SpeechButton.jsx";
import CopyButton from "./buttons/CopyButton.jsx";
import RelatedPrompts from "./RelatedPrompts.jsx";
import VerifiedResponseTooltip from "./buttons/VerifiedResponseTooltip.jsx";

const FILELIKE_SUFFIX_PATTERN =
  /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt|csv|json|xml|md)$/i;

function isValidInferredHostname(hostname) {
  const host = (hostname || "").toLowerCase();
  if (!host) return false;
  if (host === "localhost") return true;
  if (host.includes("_")) return false;

  const ipv4Match = host.match(/^(\d{1,3})(?:\.(\d{1,3})){3}$/);
  if (ipv4Match) {
    return host.split(".").every((part) => {
      const n = Number(part);
      return Number.isInteger(n) && n >= 0 && n <= 255;
    });
  }

  const labels = host.split(".");
  if (labels.length < 2) return false;

  for (const label of labels) {
    if (!label || label.startsWith("-") || label.endsWith("-")) return false;
    if (!/^[a-z0-9-]+$/i.test(label)) return false;
  }

  const tld = labels[labels.length - 1] || "";
  return /^[a-z]{2,24}$/i.test(tld);
}

function normalizeUrl(rawUrl) {
  if (typeof rawUrl !== "string") return null;

  const compact = rawUrl.trim().replace(/\s+/g, "");
  if (!compact) return null;

  const hasExplicitScheme =
    /^https?:\/\//i.test(compact) || /^mailto:|^tel:/i.test(compact);
  const maybeFileLike =
    !hasExplicitScheme &&
    FILELIKE_SUFFIX_PATTERN.test(compact) &&
    !compact.includes("/") &&
    !compact.includes("?") &&
    !compact.includes("#");

  if (maybeFileLike) return null;

  const candidates = hasExplicitScheme ? [compact] : [`https://${compact}`];

  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate);
      if (!["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol)) {
        continue;
      }
      if (
        ["http:", "https:"].includes(parsed.protocol) &&
        !isValidInferredHostname(parsed.hostname)
      ) {
        continue;
      }
      return parsed.toString();
    } catch (_error) {
      // Try the next candidate.
    }
  }

  return null;
}

function friendlyUrlLabel(urlString) {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol === "mailto:" || parsed.protocol === "tel:") {
      return urlString;
    }

    const host = parsed.hostname.replace(/^www\./i, "");
    const path = parsed.pathname
      .replace(/\/$/, "")
      .split("/")
      .filter(Boolean)
      .slice(0, 2)
      .join(" / ");

    return path ? `${host} | ${path}` : host;
  } catch (_error) {
    return urlString;
  }
}

function splitTrailingPunctuation(value) {
  const match = value.match(/[),.;!?]+$/);
  if (!match) {
    return { core: value, trailing: "" };
  }
  const trailing = match[0];
  const core = value.slice(0, -trailing.length);
  return { core, trailing };
}

function linkifyPlainTextUrls(rootNode) {
  const doc = rootNode.ownerDocument || document;
  const walker = doc.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
  const textNodes = [];

  let current = walker.nextNode();
  while (current) {
    textNodes.push(current);
    current = walker.nextNode();
  }

  const urlPattern = /((?:https?:\/\/|www\.)[^\s<]+)/gi;

  for (const textNode of textNodes) {
    const parent = textNode.parentElement;
    if (!parent || parent.closest("a, code, pre, script, style")) {
      continue;
    }

    const originalText = textNode.textContent || "";
    urlPattern.lastIndex = 0;
    if (!urlPattern.test(originalText)) {
      continue;
    }

    const fragment = doc.createDocumentFragment();
    let lastIndex = 0;
    urlPattern.lastIndex = 0;

    for (const match of originalText.matchAll(urlPattern)) {
      const fullMatch = match[0];
      const start = match.index ?? 0;

      if (start > lastIndex) {
        fragment.appendChild(
          doc.createTextNode(originalText.slice(lastIndex, start))
        );
      }

      const { core, trailing } = splitTrailingPunctuation(fullMatch);
      const normalized = normalizeUrl(core);

      if (normalized) {
        const anchor = doc.createElement("a");
        anchor.setAttribute("href", normalized);
        anchor.setAttribute("target", "_blank");
        anchor.setAttribute("rel", "noopener noreferrer");
        anchor.textContent = core;
        fragment.appendChild(anchor);

        if (trailing) {
          fragment.appendChild(doc.createTextNode(trailing));
        }
      } else {
        fragment.appendChild(doc.createTextNode(fullMatch));
      }

      lastIndex = start + fullMatch.length;
    }

    if (lastIndex < originalText.length) {
      fragment.appendChild(doc.createTextNode(originalText.slice(lastIndex)));
    }

    textNode.replaceWith(fragment);
  }
}

function normalizeRenderedReplyHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = html;

  // Convert bare URL text to anchors so links stay clickable even when
  // upstream content is plain text instead of <a href> markup.
  linkifyPlainTextUrls(template.content);

  const anchors = template.content.querySelectorAll("a");
  anchors.forEach((anchor) => {
    const rawHref = anchor.getAttribute("href") || "";
    const textHref = anchor.textContent || "";
    const normalizedHref = normalizeUrl(rawHref) || normalizeUrl(textHref);

    if (!normalizedHref) {
      anchor.removeAttribute("href");
      return;
    }

    anchor.setAttribute("href", normalizedHref);
    anchor.setAttribute("target", "_blank");
    anchor.setAttribute("rel", "noopener noreferrer");

    const currentText = (anchor.textContent || "").trim();
    const shouldReplaceLabel =
      !currentText ||
      currentText === rawHref ||
      currentText === normalizedHref ||
      /^https?:\/\//i.test(currentText);

    if (shouldReplaceLabel) {
      anchor.textContent = friendlyUrlLabel(normalizedHref);
    }
  });

  return template.innerHTML;
}

const BotPicture = styled.img`
  height: 30px;
  width: 30px !important;
  border-radius: 50%;
  margin-right: 10px;
  margin-left: 10px;
  flex-shrink: 0;
`;

export const ChatElementContainer = styled.div`
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  width: 100%;
  animation: fadein 500ms;

  &:first-child {
    margin-top: 18px;
  }

  &:last-child {
    margin-bottom: 10px;
  }
`;

const MessageContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  flex-direction: row;
  width: 100%;
  flex-shrink: 0;
`;

const BotMessage = styled.span`
  font-size: 14px;
  color: #424242;
  padding: 10px 12px;
  background: white;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06),
    0 4px 14px rgba(15, 23, 42, 0.04);
  word-break: break-word;
  display: inline-block;
  max-width: calc(100% - 42px);
  overflow: hidden;
  margin-right: 32px;
  border-radius: 12px 12px 12px 4px;
  border: 1px solid rgba(0, 0, 0, 0.04);

  @media print {
    color: ${(props) => pickFontColorFromBg(props.$bgColor)};
    background-color: ${(props) => props.$bgColor};
  }

  a {
    word-break: break-all;
  }

  iframe {
    width: 100% !important;
  }
`;

export function pickFontColorFromBg(bgColor = getTheme()) {
  return isDarkBasedOnBgColor(bgColor) ? "#333333" : "#f3f3f3";
}

export function isDarkBasedOnBgColor(bgColor) {
  if (typeof bgColor !== "string") {
    return false;
  }

  const raw = bgColor.trim();
  if (!raw) {
    return false;
  }

  // Handle hex form (#RRGGBB or RRGGBB).
  const hexCandidate = raw.startsWith("#") ? raw.substring(1) : raw;
  if (/^[0-9A-Fa-f]{6}$/.test(hexCandidate)) {
    const r = parseInt(hexCandidate.substring(0, 2), 16);
    const g = parseInt(hexCandidate.substring(2, 4), 16);
    const b = parseInt(hexCandidate.substring(4, 6), 16);
    return r * 0.299 + g * 0.587 + b * 0.114 > 186;
  }

  // Handle rgb(...) / rgba(...)
  const rgbMatch = raw.match(/^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    const r = Math.max(0, Math.min(255, parseInt(rgbMatch[1], 10)));
    const g = Math.max(0, Math.min(255, parseInt(rgbMatch[2], 10)));
    const b = Math.max(0, Math.min(255, parseInt(rgbMatch[3], 10)));
    return r * 0.299 + g * 0.587 + b * 0.114 > 186;
  }

  // Unknown format: keep default dark-theme assumptions.
  return false;
}

const UserMessage = styled.span`
  font-size: 14px;
  color: ${(props) => pickFontColorFromBg(props.$bgColor)};
  background-color: ${(props) => props.$bgColor};
  padding: 10px;
  box-shadow: 1px 2px 5px 1px rgba(0, 0, 0, 0.13);
  word-break: break-word;
  display: inline;
  overflow: hidden;
  border-radius: 8px 8px 2px 8px;
  margin-left: 30px;
  margin-right: 15px;
`;

const InteractionButtons = styled.span`
  font-size: 10.5px;
  color: var(--grey-1);
  padding: 3px 6px 6px 6px;
  display: flex;
  align-items: center;
  align-content: center;
`;

const BotMessageContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

const ReplyContent = styled.span`
  align-items: center;

  .emoji {
    height: 18px;
    margin-bottom: -3px;
  }
`;

export function parseHTMLEmojis(html) {
  if (typeof html !== "string") return html;

  const withEmojis = twemoji
    .parse(html, {
      base: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/",
    })
    .replaceAll(/\/> /g, "/>&nbsp;")
    .replaceAll(/ <img/g, "&nbsp;<img");

  // Reply HTML comes from the model/RAG pipeline, so sanitize before it ever
  // reaches dangerouslySetInnerHTML - strips <script>, event handlers and
  // javascript: URLs while keeping normal formatting and the emoji <img> tags.
  const sanitized = DOMPurify.sanitize(withEmojis);
  return normalizeRenderedReplyHtml(sanitized);
}

const CommandContextContainer = styled.div`
  font-size: 12px;
  display: flex;
`;

const CommandPointer = styled.div`
  height: 50%;
  margin-top: 7px;
  border-top: 2px solid var(--grey-1);
  border-left: 2px solid var(--grey-1);
  border-top-left-radius: 5px;
  width: 25px;
`;

const CommandText = styled.div`
  margin-left: 2px;
  color: var(--grey-1);
`;

const COMMAND_CONTEXT_HEIGHT = "22px";

/**
 *
 * @param {string} height
 * @param {Command} command
 * @return {JSX.Element}
 * @constructor
 */
export function CommandContext({ command, height }) {
  return (
    <CommandContextContainer style={{ height: height, marginBottom: "2px" }}>
      <CommandPointer />
      <CommandText>
        Command&nbsp;
        <span style={{ color: getTheme() }}>
          {command.constructor.qualifiedId()}
        </span>
      </CommandText>
    </CommandContextContainer>
  );
}

export default class Chat extends Component {
  static AUTOSCROLL_THRESHOLD = 96;

  constructor(props) {
    super(props);
    this.hasMounted = false;
    this.elementId =
      (props.userMessage ? "user" : "bot") +
      "-" +
      Math.round(Math.random() * 10 ** 5);
    this.messageElementId = "msg-" + this.elementId;
    this.content = parseHTMLEmojis(this.props.content);
  }

  componentDidMount() {
    if (this.hasMounted) return;
    this.hasMounted = true;

    const chatList = document.getElementById("chat-list");
    const chatElement = document.getElementById(this.elementId);
    const previousChat = chatList.childNodes.item(
      chatList.childNodes.length - 2
    );

    if (!(chatList && chatElement)) return;

    const distanceFromBottom =
      chatList.scrollHeight - (chatList.scrollTop + chatList.clientHeight);
    if (distanceFromBottom > Chat.AUTOSCROLL_THRESHOLD) {
      return;
    }

    chatList.scrollTop =
      chatList.scrollHeight -
      chatElement.scrollHeight -
      (this.props.userMessage ? 0 : previousChat?.["scrollHeight"] || 0);
    // - 90
  }

  getReplyContent() {
    // React Element
    if (isValidElement(this.content)) {
      return this.content;
    }

    if (this.props.relatedPrompts) {
      // return <ReplyContent>{this.props.relatedPrompts.toString()}</ReplyContent>;
    }

    // Null or non-string element
    if (!this.content || typeof this.content !== "string") {
      return (
        <span>
          <strong>Error:</strong> Failed to retrieve a response, try refreshing
          the chat with <strong>/restart</strong>.
        </span>
      );
    }

    return (
      <div>
        <ReplyContent dangerouslySetInnerHTML={{ __html: this.content }} />
        {this.props.relatedPrompts && (
          <RelatedPrompts relatedPrompts={this.props.relatedPrompts} />
        )}
      </div>
    );
  }

  render() {
    // User message
    if (this.props.userMessage) {
      return (
        <ChatElementContainer id={this.elementId} data-chat-role="user">
          <MessageContainer>
            <UserMessage
              id={this.messageElementId}
              className={"chatMessage"}
              $bgColor={window.Cria.embedTheme || "#1065c7"}
            >
              {this.getReplyContent()}
            </UserMessage>
          </MessageContainer>
          <InteractionButtons
            style={{ marginRight: "10px", justifyContent: "flex-end" }}
          >
            {this.props?.["allowCopy"] && (
              <CopyButton chatElementId={this.messageElementId} />
            )}
            {this.props.time}
          </InteractionButtons>
        </ChatElementContainer>
      );
    }

    return (
      <ChatElementContainer
        id={this.elementId}
        data-chat-role="bot"
        className={this.props.hideInPrint ? "hideInPrint" : ""}
      >
        <MessageContainer>
          <BotPicture
            src={this.props.pictureURL}
            style={{
              marginTop: this.props.command
                ? COMMAND_CONTEXT_HEIGHT
                : undefined,
            }}
          />
          <BotMessageContainer>
            {this.props.command && (
              <CommandContext
                command={this.props.command}
                height={COMMAND_CONTEXT_HEIGHT}
              />
            )}
            <BotMessage
              $bgColor={window.Cria.embedTheme || "#1065c7"}
              className={"chatMessage"}
              id={this.messageElementId}
            >
              {this.getReplyContent()}
            </BotMessage>
          </BotMessageContainer>
          <div style={{ flexGrow: 1 }}></div>
        </MessageContainer>
        <InteractionButtons style={{ marginLeft: "45px" }}>
          {this.props?.["messageId"] && (
            <SpeechButton
              messageId={this.props.messageId}
              autoPlay={this.props.autoPlay}
              isGreeting={this.props.isGreeting}
            />
          )}
          {this.props?.["allowCopy"] && (
            <CopyButton chatElementId={this.messageElementId} />
          )}
          {this.props?.["verifiedResponse"] && <VerifiedResponseTooltip />}
          <span style={{ marginTop: "-1px" }}>{this.props.time}</span>
        </InteractionButtons>
      </ChatElementContainer>
    );
  }
}
