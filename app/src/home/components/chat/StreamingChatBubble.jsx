import React from "react";
import styled from "styled-components";
import { AnimatePresence, motion } from "framer-motion";
import ReasoningBlock from "./ReasoningBlock.jsx";
import ShimmerSkeleton from "./ShimmerSkeleton.jsx";
import SourceCitations from "./SourceCitations.jsx";
import { parseHTMLEmojis } from "./Chat.jsx";
import { buildThinkingSummary, getAccentColor } from "./agentChatTheme.js";

const AgentShell = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
`;

const MessageText = styled(motion.div)`
  font-size: 14px;
  color: #1f2937;
  line-height: 1.65;
  word-break: break-word;

  .emoji {
    height: 18px;
    margin-bottom: -3px;
  }

  p {
    margin: 0 0 0.75em;
  }

  p:last-child {
    margin-bottom: 0;
  }
`;

const StreamingCursor = styled.span`
  display: inline-block;
  width: 2px;
  height: 1.05em;
  margin-left: 2px;
  background: ${() => getAccentColor()};
  vertical-align: text-bottom;
  animation: blink 1s step-end infinite;

  @keyframes blink {
    50% {
      opacity: 0;
    }
  }
`;

const ErrorCard = styled.div`
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(239, 68, 68, 0.18);
  background: rgba(254, 242, 242, 0.9);
  color: #991b1b;
  font-size: 13px;
  line-height: 1.5;
`;

const ErrorTitle = styled.div`
  font-weight: 600;
  margin-bottom: 4px;
`;

const ContentStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

/**
 * Unified agent response surface: thinking status, skeleton, streamed answer, sources.
 */
export default function StreamingChatBubble({
  steps = [],
  message = "",
  citations = [],
  showShimmer = true,
  isLive = false,
  isComplete = false,
  elapsedMs = null,
  hasError = false,
  errorMessage = null,
}) {
  const sourceCount = citations.length;
  const summary = buildThinkingSummary({
    steps,
    elapsedMs,
    sourceCount,
  });

  const isThinking = isLive && !message;
  const showThinkingBlock =
    isThinking || steps.length > 0 || (isComplete && steps.length > 0);
  const showSkeleton = showShimmer && isLive && !message && steps.length === 0;

  if (hasError) {
    return (
      <AgentShell>
        <ErrorCard role="alert">
          <ErrorTitle>Couldn&apos;t complete this response</ErrorTitle>
          {errorMessage || "Please try again in a moment."}
        </ErrorCard>
      </AgentShell>
    );
  }

  const parsedMessage = message && !isLive ? parseHTMLEmojis(message) : message;

  return (
    <AgentShell>
      <ContentStack>
        {showThinkingBlock && (
          <ReasoningBlock
            steps={steps}
            isCollapsed={isComplete || Boolean(message)}
            isActive={isLive && !isComplete && !message}
            summary={summary}
            sourceCount={sourceCount}
            elapsedMs={elapsedMs}
          />
        )}

        <AnimatePresence mode="wait">
          {showSkeleton && (
            <motion.div
              key="full-skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <ShimmerSkeleton />
            </motion.div>
          )}
        </AnimatePresence>

        {message && (
          <MessageText
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {isLive ? (
              <>
                {message}
                <StreamingCursor aria-hidden="true" />
              </>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: parsedMessage }} />
            )}
          </MessageText>
        )}

        {citations.length > 0 && <SourceCitations sources={citations} />}
      </ContentStack>
    </AgentShell>
  );
}
