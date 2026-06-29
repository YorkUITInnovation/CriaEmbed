import React, { useState } from "react";
import styled from "styled-components";
import { AnimatePresence, motion } from "framer-motion";
import { getAccentColor } from "./agentChatTheme.js";

const Wrap = styled(motion.div)`
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
`;

const Label = styled.div`
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #9ca3af;
  margin-bottom: 8px;
`;

const Pills = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const Pill = styled(motion.button)`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: #f9fafb;
  color: #374151;
  font-size: 12px;
  line-height: 1.2;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease,
    transform 0.15s ease;

  &:hover {
    background: #f3f4f6;
    border-color: rgba(0, 0, 0, 0.12);
    transform: translateY(-1px);
  }

  &.web {
    border-color: rgba(37, 99, 235, 0.18);
    background: rgba(37, 99, 235, 0.06);
  }

  &.file {
    border-color: rgba(217, 119, 6, 0.18);
    background: rgba(217, 119, 6, 0.06);
  }

  &.doc {
    border-color: rgba(124, 58, 237, 0.18);
    background: rgba(124, 58, 237, 0.06);
  }
`;

const PillText = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const PopoverOverlay = styled(motion.div)`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
`;

const PopoverCard = styled(motion.div)`
  width: min(420px, 100%);
  max-height: min(360px, 80vh);
  overflow: auto;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.18);
  padding: 16px;
`;

const PopoverTitle = styled.h4`
  margin: 0 0 10px;
  font-size: 14px;
  color: #111827;
`;

const PopoverBody = styled.div`
  font-size: 13px;
  color: #4b5563;
  line-height: 1.55;

  p {
    margin: 0 0 8px;
  }

  a {
    color: ${() => getAccentColor()};
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`;

const CloseButton = styled.button`
  float: right;
  border: none;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;

  &:hover {
    color: #4b5563;
  }
`;

export default function SourceCitations({ sources = [] }) {
  const [selectedSource, setSelectedSource] = useState(null);

  if (!sources?.length) {
    return null;
  }

  const handleClick = (source) => {
    if (source.type === "web" && source.metadata?.url) {
      window.open(source.metadata.url, "_blank", "noopener,noreferrer");
      return;
    }
    setSelectedSource(source);
  };

  return (
    <>
      <Wrap
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Label>Sources</Label>
        <Pills>
          {sources.map((source) => (
            <Pill
              key={source.id}
              className={source.type}
              onClick={() => handleClick(source)}
              title={source.display}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.15 }}
            >
              <span aria-hidden="true">{source.icon}</span>
              <PillText>{source.label}</PillText>
            </Pill>
          ))}
        </Pills>
      </Wrap>

      <AnimatePresence>
        {selectedSource && (
          <PopoverOverlay
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedSource(null)}
          >
            <PopoverCard
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              onClick={(e) => e.stopPropagation()}
            >
              <CloseButton
                type="button"
                aria-label="Close"
                onClick={() => setSelectedSource(null)}
              >
                ✕
              </CloseButton>
              <PopoverTitle>{selectedSource.display}</PopoverTitle>
              <PopoverBody>
                {selectedSource.metadata?.snippet && (
                  <p>{selectedSource.metadata.snippet}</p>
                )}
                {selectedSource.metadata?.url && (
                  <p>
                    <a
                      href={selectedSource.metadata.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open source
                    </a>
                  </p>
                )}
                {selectedSource.metadata?.engine && (
                  <p>
                    <strong>Engine:</strong> {selectedSource.metadata.engine}
                  </p>
                )}
              </PopoverBody>
            </PopoverCard>
          </PopoverOverlay>
        )}
      </AnimatePresence>
    </>
  );
}
