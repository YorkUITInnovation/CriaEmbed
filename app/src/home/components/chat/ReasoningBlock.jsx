import React, { useEffect, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import { AnimatePresence, motion } from "framer-motion";
import {
  buildThinkingSummary,
  derivePhases,
  formatStepMessage,
  getAccentColor,
  withAlpha,
} from "./agentChatTheme.js";

const FALLBACK_PROGRESS_STEPS = [
  "Connecting to retrieval engines...",
  "Searching course knowledge base...",
  "Retrieving relevant document chunks...",
  "Synthesizing response draft...",
  "Finalizing answer... almost there.",
];

const FALLBACK_STEP_MS = 2200;

/* Anything purely decorative is disabled for users who ask for less motion. */
const respectReducedMotion = css`
  @media (prefers-reduced-motion: reduce) {
    animation: none !important;
    transition: none !important;
  }
`;

const haloPulse = keyframes`
  0% {
    transform: scale(1);
    opacity: 0.5;
  }
  70%,
  100% {
    transform: scale(2.6);
    opacity: 0;
  }
`;

const corePulse = keyframes`
  0%, 100% {
    transform: scale(0.88);
  }
  50% {
    transform: scale(1);
  }
`;

const textSweep = keyframes`
  0% {
    background-position: 180% 0;
  }
  100% {
    background-position: -80% 0;
  }
`;

const indeterminate = keyframes`
  0% {
    transform: translateX(-105%);
  }
  100% {
    transform: translateX(320%);
  }
`;

const ThinkingShell = styled(motion.div)`
  margin-bottom: 10px;
  width: 100%;
  min-width: 0;
`;

const ThinkingCard = styled(motion.div)`
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
  border: 1px solid
    ${(props) =>
      props.$active
        ? withAlpha(props.$accent, 0.22)
        : "rgba(15, 23, 42, 0.07)"};
  background: ${(props) =>
    props.$active
      ? `linear-gradient(135deg, ${withAlpha(
          props.$accent,
          0.07
        )} 0%, ${withAlpha(
          props.$accent,
          0.02
        )} 55%, rgba(255,255,255,0) 100%), #ffffff`
      : "linear-gradient(180deg, #ffffff 0%, #fbfcfd 100%)"};
  box-shadow: ${(props) =>
    props.$active
      ? `0 1px 2px rgba(15, 23, 42, 0.04), 0 6px 20px ${withAlpha(
          props.$accent,
          0.1
        )}`
      : "0 1px 2px rgba(15, 23, 42, 0.04)"};

  ${respectReducedMotion}
`;

const ThinkingHeader = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
  padding: 11px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font: inherit;
  color: inherit;
  border-radius: 14px;
  transition: background 0.18s ease;

  &:hover {
    background: rgba(15, 23, 42, 0.025);
  }

  &:focus-visible {
    outline: 2px solid ${(props) => withAlpha(props.$accent, 0.5)};
    outline-offset: -2px;
  }

  @media (max-width: 380px) {
    gap: 8px;
    padding: 10px;
  }

  ${respectReducedMotion}
`;

/* Breathing orb while thinking; settles into a solid check once finished. */
const StatusOrb = styled.span`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
`;

const OrbCore = styled.span`
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${(props) => props.$size};
  height: ${(props) => props.$size};
  border-radius: 50%;
  color: #fff;
  background: ${(props) => props.$color};
  animation: ${(props) => (props.$active ? corePulse : "none")} 1.8s ease-in-out
    infinite;

  ${respectReducedMotion}
`;

const OrbHalo = styled.span`
  position: absolute;
  inset: 4.5px;
  border-radius: 50%;
  background: ${(props) => props.$color};
  animation: ${haloPulse} 2s ease-out infinite;
  animation-delay: ${(props) => props.$delay};

  ${respectReducedMotion}
`;

const HeaderText = styled.div`
  flex: 1;
  min-width: 0;
`;

const HeaderTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: #111827;
  line-height: 1.3;
`;

const HeaderSubtitle = styled.div`
  font-size: 12px;
  line-height: 1.4;
  margin-top: 2px;
  min-height: calc(1.4em * 2);
  max-height: calc(1.4em * 2);
  color: #6b7280;
  /* Two lines, then ellipsis - a single nowrap line clipped too much of the
     status text at the 300px minimum widget width. */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;

  /* Light sweeps across the live status text — only where background-clip:text
     is supported, so unsupported browsers keep readable solid text. */
  ${(props) =>
    props.$shimmer &&
    css`
      @supports (background-clip: text) or (-webkit-background-clip: text) {
        background: linear-gradient(
          90deg,
          #6b7280 0%,
          #6b7280 30%,
          ${withAlpha(props.$accent, 0.95)} 50%,
          #6b7280 70%,
          #6b7280 100%
        );
        background-size: 220% 100%;
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        -webkit-text-fill-color: transparent;
        animation: ${textSweep} 2.6s linear infinite;

        @media (prefers-reduced-motion: reduce) {
          animation: none;
        }
      }
    `}
`;

const CountBadge = styled.span`
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: ${(props) => props.$color};
  background: ${(props) => props.$bg};
  border-radius: 999px;
  padding: 2px 7px;
  line-height: 1.5;

  @media (max-width: 340px) {
    display: none;
  }
`;

const Chevron = styled.svg`
  flex-shrink: 0;
  width: 12px;
  height: 12px;
  color: #9ca3af;
  transform: rotate(${(props) => (props.$open ? "180deg" : "0deg")});
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  ${respectReducedMotion}
`;

/* Thin progress rail pinned to the bottom edge of the card. */
const ProgressTrack = styled.div`
  position: relative;
  height: 2px;
  width: 100%;
  overflow: hidden;
  background: rgba(15, 23, 42, 0.05);
`;

const ProgressFill = styled.div`
  height: 100%;
  border-radius: 999px;
  background: ${(props) => props.$color};
  width: ${(props) => props.$percent}%;
  transition: width 0.45s cubic-bezier(0.4, 0, 0.2, 1);

  ${respectReducedMotion}
`;

const ProgressSweep = styled.div`
  height: 100%;
  width: 32%;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    ${(props) => props.$color} 50%,
    transparent 100%
  );
  animation: ${indeterminate} 1.5s ease-in-out infinite;

  ${respectReducedMotion}
`;

const Timeline = styled(motion.div)`
  display: flex;
  flex-direction: column;
  padding: 2px 12px 12px;
  overflow: hidden;

  @media (max-width: 380px) {
    padding: 2px 10px 10px;
  }
`;

const StepRow = styled(motion.div)`
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 5px 8px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.45;
  color: ${(props) => (props.$current ? "#111827" : "#6b7280")};
  font-weight: 500;
  background: ${(props) =>
    props.$current ? withAlpha(props.$accent, 0.06) : "transparent"};
  transition: background 0.25s ease, color 0.25s ease;

  ${respectReducedMotion}
`;

/* Marker column doubles as the timeline rail: each row but the last draws the
   connector down to the next marker. */
const MarkerColumn = styled.span`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 17px;
  flex-shrink: 0;

  ${(props) =>
    !props.$last &&
    css`
      &::after {
        content: "";
        position: absolute;
        top: 15px;
        bottom: -8px;
        left: 50%;
        width: 1.5px;
        transform: translateX(-50%);
        border-radius: 999px;
        background: ${props.$done
          ? withAlpha(props.$accent, 0.28)
          : "rgba(15, 23, 42, 0.08)"};
      }
    `}
`;

const MarkerDot = styled.span`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.25s ease;

  ${(props) =>
    props.$done &&
    css`
      width: 13px;
      height: 13px;
      color: #fff;
      background: ${props.$accent};
    `}

  ${(props) =>
    props.$current &&
    css`
      width: 9px;
      height: 9px;
      background: ${props.$accent};
      box-shadow: 0 0 0 3px ${withAlpha(props.$accent, 0.16)};
    `}

  ${(props) =>
    !props.$done &&
    !props.$current &&
    css`
      width: 8px;
      height: 8px;
      background: #fff;
      border: 1.5px solid rgba(15, 23, 42, 0.16);
    `}

  ${respectReducedMotion}
`;

const StepText = styled.span`
  flex: 1;
  min-width: 0;
  word-break: break-word;
`;

/* The timeline marker now conveys "done", so drop the checkmark the backend
   (via formatStepMessage) prefixes onto completed rows. */
function stepLabel(step) {
  return formatStepMessage(step).replace(/^✓\s*/, "");
}

function CheckIcon() {
  return (
    <svg
      width="8"
      height="8"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2.5 6.2 4.8 8.5 9.5 3.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Agent thinking panel: live status orb, sweeping status line, and a timeline
 * of retrieval stages that fills in as they complete.
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
  // One row per engine, not one per start/done event.
  const phases = derivePhases(steps);
  const doneCount = phases.filter((p) => p.state === "done").length;
  const allDone = phases.length > 0 && doneCount === phases.length;
  const displaySummary =
    summary || buildThinkingSummary({ steps, elapsedMs, sourceCount });
  const shouldUseFallbackProgress = isActive && phases.length === 0;

  // The last not-yet-finished phase is the one currently running.
  const activeIndex = phases.map((p) => p.state).lastIndexOf("start");
  const activePhase = activeIndex >= 0 ? phases[activeIndex] : null;
  const showTimeline = expanded && phases.length > 0;
  const spinning = isActive && !allDone;

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
    ? activePhase
      ? formatStepMessage(activePhase)
      : fallbackMessage
    : displaySummary;

  const orbColor = allDone && !isActive ? "#10b981" : accent;
  const progressPercent = phases.length
    ? Math.round((doneCount / phases.length) * 100)
    : 0;

  return (
    <ThinkingShell
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
    >
      <ThinkingCard layout $active={spinning} $accent={accent}>
        <ThinkingHeader
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={showTimeline}
          $accent={accent}
        >
          <StatusOrb aria-hidden="true">
            {spinning && (
              <>
                <OrbHalo $color={accent} $delay="0s" />
                <OrbHalo $color={accent} $delay="1s" />
              </>
            )}
            <OrbCore
              $color={orbColor}
              $active={spinning}
              $size={spinning ? "9px" : allDone ? "18px" : "10px"}
            >
              {!spinning && allDone && <CheckIcon />}
            </OrbCore>
          </StatusOrb>

          <HeaderText>
            <HeaderTitle>{title}</HeaderTitle>
            <HeaderSubtitle
              $shimmer={spinning}
              $accent={accent}
              role="status"
              aria-live="polite"
            >
              {subtitle}
            </HeaderSubtitle>
          </HeaderText>

          {phases.length > 0 && (
            <>
              <CountBadge
                $color={allDone ? "#059669" : accent}
                $bg={
                  allDone ? "rgba(16, 185, 129, 0.1)" : withAlpha(accent, 0.1)
                }
              >
                {doneCount}/{phases.length}
              </CountBadge>
              <Chevron
                $open={showTimeline}
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M3 4.5 6 7.5 9 4.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Chevron>
            </>
          )}
        </ThinkingHeader>

        <AnimatePresence initial={false}>
          {showTimeline && (
            <Timeline
              key="timeline"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
            >
              {phases.map((phase, index) => {
                const isDone = phase.state === "done";
                const isCurrent = isActive && index === activeIndex && !isDone;

                return (
                  <StepRow
                    key={phase.engine}
                    $current={isCurrent}
                    $accent={accent}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <MarkerColumn
                      $last={index === phases.length - 1}
                      $done={isDone}
                      $accent={accent}
                      aria-hidden="true"
                    >
                      <MarkerDot
                        $done={isDone}
                        $current={isCurrent}
                        $accent={accent}
                      >
                        {isDone && <CheckIcon />}
                      </MarkerDot>
                    </MarkerColumn>
                    <StepText>{stepLabel(phase)}</StepText>
                  </StepRow>
                );
              })}
            </Timeline>
          )}
        </AnimatePresence>

        {spinning && (
          <ProgressTrack>
            {phases.length > 0 ? (
              <ProgressFill $color={accent} $percent={progressPercent} />
            ) : (
              <ProgressSweep $color={accent} />
            )}
          </ProgressTrack>
        )}
      </ThinkingCard>
    </ThinkingShell>
  );
}
