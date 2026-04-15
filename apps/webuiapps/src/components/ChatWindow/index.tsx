/**
 * ChatWindow — floating, draggable, resizable wrapper around ChatPanel.
 *
 * Replaces the right-stuck drawer behavior with a real window. All chat
 * wiring (useKayleyChannel, local LLM fallback, tool calls, vibe_action
 * round-trip) continues to live inside ChatPanel — ChatWindow is purely a
 * presentational wrapper that positions, drags, and resizes it.
 *
 * The window stays mounted even when hidden (visibility toggled via `visible`
 * prop / avatar orb) so chat history and the Kayley WebSocket connection are
 * preserved.
 */

import React, { useState, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import ChatPanel from '../ChatPanel';
import styles from './index.module.scss';

export interface ChatWindowProps {
  visible: boolean;
  onClose: () => void;
  zIndex?: number;
  onFocus?: () => void;
}

const DEFAULT_W = 720;
const DEFAULT_H = 560;
const MIN_W = 360;
const MIN_H = 400;
const MARGIN = 24;

function getDefaultPos() {
  if (typeof window === 'undefined') return { x: 100, y: 100 };
  return {
    x: Math.max(MARGIN, window.innerWidth - DEFAULT_W - MARGIN),
    y: Math.max(MARGIN, window.innerHeight - DEFAULT_H - 120),
  };
}

const ChatWindow: React.FC<ChatWindowProps> = ({ visible, onClose, zIndex, onFocus }) => {
  const [pos, setPos] = useState(getDefaultPos);
  const [size, setSize] = useState({ width: DEFAULT_W, height: DEFAULT_H });
  const [maximized, setMaximized] = useState(false);
  const [preMaxState, setPreMaxState] = useState<{
    pos: { x: number; y: number };
    size: { width: number; height: number };
  } | null>(null);

  const toggleMax = useCallback(() => {
    if (maximized) {
      if (preMaxState) {
        setPos(preMaxState.pos);
        setSize(preMaxState.size);
      }
      setMaximized(false);
    } else {
      setPreMaxState({ pos, size });
      setPos({ x: 0, y: 0 });
      setSize({ width: window.innerWidth, height: window.innerHeight });
      setMaximized(true);
    }
  }, [maximized, preMaxState, pos, size]);

  if (!visible) return null;

  return (
    <Rnd
      className={styles.wrapper}
      size={size}
      position={pos}
      minWidth={MIN_W}
      minHeight={MIN_H}
      bounds="window"
      dragHandleClassName={styles.dragHandle}
      onDragStop={(_, d) => setPos({ x: d.x, y: d.y })}
      onResizeStop={(_, __, ref, ___, position) => {
        setSize({ width: ref.offsetWidth, height: ref.offsetHeight });
        setPos(position);
      }}
      style={{ zIndex: zIndex ?? 1000 }}
      data-testid="chat-window"
    >
      {/* Invisible drag strip overlayed across the top so the user can grab
          the window without hitting ChatPanel's own buttons. ChatPanel's
          internal header remains clickable (higher z-index via CSS). */}
      <div className={styles.dragHandle} data-testid="chat-window-drag-handle" />

      {/* Floating max toggle — ChatPanel already has minimize (onClose)
          wired internally; we just surface a maximize affordance. */}
      <button
        className={styles.maxBtn}
        onClick={toggleMax}
        title={maximized ? 'Restore' : 'Maximize'}
        data-testid="chat-window-max"
      >
        {maximized ? '❐' : '▢'}
      </button>

      <ChatPanel
        onClose={onClose}
        visible={true}
        zIndex={undefined}
        onFocus={onFocus}
        windowed
      />
    </Rnd>
  );
};

export default ChatWindow;
