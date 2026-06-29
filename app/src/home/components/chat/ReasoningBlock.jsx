import React, { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";
import { AnimatePresence, motion } from "framer-motion";
import {
  buildThinkingSummary,
  formatStepMessage,
  getAccentColor,
  getActiveStep,
  getStepKey,
} from "./agentChatTheme.js";

const FALLBACK_PROGRESS_STEPS = [
  "Connecting to retrieval engines...",
  "Searching course knowledge base...",
  "Retrieving relevant document chunks...",
  "Synthesizing response draft...",
  "Finalizing answer... almost there.",
];

const FALLBACK_STEP_MS = 2200;

const pulse = keyframes`
  0%, 100% {
    opacity: 0.45;
    transform: scale(0.92);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
`;

const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

const ThinkingShell = styled(motion.div)`
  margin-bottom: 10px;
`;

const ThinkingCard = styled.div`
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.98) 0%,
    rgba(248, 250, 252, 0.98) 100%
  );
  overflow: hidden;
`;

const ThinkingHeader = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;

  &:hover {
    background: rgba(0, 0, 0, 0.02);
  }
`;

const StatusRing = styled.span`
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(0, 0, 0, 0.08);
  border-top-color: ${(props) => props.$color};
  animation: ${spin} 0.9s linear infinite;
  flex-shrink: 0;
`;

const StatusDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${(props) => props.$color};
`;

const HeaderText = styled.div`
  flex: 1;
  min-width: 0;
`;

const HeaderTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
`;

const HeaderSubtitle = styled.div`
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
`;

const Chevron = styled.span`
  color: #9ca3af;
  font-size: 12px;
  transform: rotate(${(props) => (props.$open ? "180deg" : "0deg")});
  transition: transform 0.2s ease;
`;

const CurrentStage = styled(motion.div)`
  margin: 0 12px 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: ${(props) => `${props.$accent}10`};
  border: 1px solid ${(props) => `${props.$accent}22`};
`;

const CurrentStageLabel = styled.div`
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${(props) => props.$accent};
  margin-bottom: 4px;
`;

const CurrentStageText = styled.div`
  font-size: 13px;
  color: #1f2937;
  line-height: 1.45;
`;

const StepsPanel = styled.div`
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const StepItem = styled(motion.div)`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12px;
  line-height: 1.45;
  color: ${(props) => (props.$current ? "#1f2937" : "#6b7280")};
  padding: 6px 8px;
  border-radius: 8px;
  background: ${(props) =>
    props.$current ? "rgba(0, 0, 0, 0.03)" : "transparent"};
  font-weight: ${(props) => (props.$current ? "500" : "400")};
`;

const StepMarker = styled.span`
  width: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
  font-size: ${(props) => (props.$done ? "11px" : "14px")};
  color: ${(props) =>
    props.$done ? "#059669" : props.$current ? props.$accent : "#9ca3af"};
  animation: ${(props) => (props.$current ? pulse : "none")} 1.2s ease-in-out
    infinite;
`;

const StepText = styled.span`
  flex: 1;
  min-width: 0;
`;

/**
 * Agent thinking panel with live stage feed while waiting for the answer.
 */
export default function ReasoningBlock({
  steps = [],
  isCollapsed = false,
  isActive = false,
  summary = null,
  sourceCount = 0,
  elapsedMs = null,
}) {
  const [expanded, setExpanded] = useState(true);
  const [fallbackStepIndex, setFallbackStepIndex] = useState(0);
  const accent = getAccentColor();
  const activeStep = getActiveStep(steps);
  const doneCount = steps.filter((s) => s.state === "done").length;
  const allDone = steps.length > 0 && doneCount === steps.length;
  const displaySummary =
    summary || buildThinkingSummary({ steps, elapsedMs, sourceCount });
  const shouldUseFallbackProgress = isActive && steps.length === 0;

  const showLiveFeed = isActive || expanded;
  const activeStepKey = activeStep
    ? getStepKey(activeStep, steps.length)
    : null;

  useEffect(() => {
    if (isActive) {
      setExpanded(true);
    } else if (isCollapsed) {
      setExpanded(false);
    }
  }, [isActive, isCollapsed]);

  useEffect(() => {
    if (!shouldUseFallbackProgress) {
      setFallbackStepIndex(0);
      return;
    }

    const intervalId = setInterval(() => {
      setFallbackStepIndex((current) =>
        Math.min(current + 1, FALLBACK_PROGRESS_STEPS.length - 1)
      );
    }, FALLBACK_STEP_MS);

    return () => clearInterval(intervalId);
  }, [shouldUseFallbackProgress]);

  if (!steps.length && !isActive) {
    return null;
  }

  const fallbackMessage = FALLBACK_PROGRESS_STEPS[fallbackStepIndex];
  const title = isActive
    ? "Thinking"
    : allDone
    ? "Finished processing"
    : "Processing";

  const subtitle = isActive
    ? activeStep
      ? "Working through retrieval stages"
      : fallbackMessage
    : displaySummary;

  return (
    <ThinkingShell
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      <ThinkingCard>
        <ThinkingHeader
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={showLiveFeed}
        >
          {isActive && !allDone ? (
            <StatusRing $color={accent} aria-hidden="true" />
          ) : (
            <StatusDot $color={allDone ? "#10b981" : accent} />
          )}
          <HeaderText>
            <HeaderTitle>{title}</HeaderTitle>
            <HeaderSubtitle>{subtitle}</HeaderSubtitle>
          </HeaderText>
          {steps.length > 0 && (
            <Chevron $open={showLiveFeed} aria-hidden="true">
              ▾
            </Chevron>
          )}
        </ThinkingHeader>

        <AnimatePresence initial={false}>
          {isActive && activeStep && (
            <CurrentStage
              key="current-stage"
              $accent={accent}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              <CurrentStageLabel $accent={accent}>
                Current stage
              </CurrentStageLabel>
              <CurrentStageText>
                {formatStepMessage(activeStep)}
              </CurrentStageText>
            </CurrentStage>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {showLiveFeed && steps.length > 0 && (
            <StepsPanel
              as={motion.div}
              key="steps-panel"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              {steps.map((step, index) => {
                const stepKey = getStepKey(step, index);
                const isCurrent = isActive && stepKey === activeStepKey;
                const isDone = step.state === "done";

                return (
                  <StepItem
                    key={stepKey}
                    $current={isCurrent}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.16 }}
                  >
                    <StepMarker
                      $done={isDone}
                      $current={isCurrent && !isDone}
                      $accent={accent}
                      aria-hidden="true"
                    >
                      {isDone ? "✓" : "·"}
                    </StepMarker>
                    <StepText>{formatStepMessage(step)}</StepText>
                  </StepItem>
                );
              })}
            </StepsPanel>
          )}
        </AnimatePresence>

        {isActive && steps.length === 0 && (
          <StepsPanel>
            <StepItem $current={true}>
              <StepMarker $current={true} $accent={accent}>
                ·
              </StepMarker>
              <StepText>{fallbackMessage}</StepText>
            </StepItem>
          </StepsPanel>
        )}
      </ThinkingCard>
    </ThinkingShell>
  );
}
