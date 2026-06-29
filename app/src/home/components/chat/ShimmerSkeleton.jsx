import styled, { keyframes } from "styled-components";
import { motion } from "framer-motion";

const shimmer = keyframes`
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
`;

const SkeletonWrap = styled(motion.div)`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px 0 8px;
  width: 100%;
`;

const SkeletonLine = styled.div`
  height: 11px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    rgba(0, 0, 0, 0.05) 0%,
    rgba(0, 0, 0, 0.09) 45%,
    rgba(0, 0, 0, 0.05) 90%
  );
  background-size: 200% 100%;
  animation: ${shimmer} 1.6s ease-in-out infinite;
  will-change: background-position;

  &.w100 {
    width: 100%;
  }
  &.w88 {
    width: 88%;
  }
  &.w72 {
    width: 72%;
  }
  &.w56 {
    width: 56%;
  }
`;

/**
 * Inline agent-style skeleton — lightweight bars inside the message bubble.
 */
export default function ShimmerSkeleton({ compact = false }) {
  const lines = compact
    ? [{ className: "w88" }, { className: "w72" }]
    : [
        { className: "w100" },
        { className: "w88" },
        { className: "w72" },
        { className: "w56" },
      ];

  return (
    <SkeletonWrap
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      aria-hidden="true"
    >
      {lines.map((line, index) => (
        <SkeletonLine
          key={index}
          className={line.className}
          style={{ animationDelay: `${index * 0.12}s` }}
        />
      ))}
    </SkeletonWrap>
  );
}
