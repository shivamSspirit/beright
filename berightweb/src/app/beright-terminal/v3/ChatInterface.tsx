'use client';

import { useRef, useEffect } from 'react';
import styles from './ChatInterface.module.css';

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  agent?: 'SCOUT' | 'ANALYST' | 'TRADER' | 'BUILDER' | 'SYSTEM';
  content: string;
  timestamp: Date;
  mood?: string;
}

interface ChatInterfaceProps {
  messages: ChatMessage[];
  isProcessing?: boolean;
}

/**
 * ChatInterface - Telegram-style chat between user and AI agents
 *
 * Center panel showing conversation history with:
 * - User commands on the right (cyan)
 * - Agent responses on the left (colored by agent type)
 * - Typing indicator when processing
 */
export default function ChatInterface({ messages, isProcessing = false }: ChatInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  // Agent colors using CSS variables for brand consistency
  const getAgentColor = (agent?: string) => {
    switch (agent) {
      case 'SCOUT': return 'var(--color-accent, #00C2FF)';     // Cyan
      case 'ANALYST': return 'var(--color-ai, #A78BFA)';       // Purple
      case 'TRADER': return 'var(--color-primary, #10B981)';   // Brand Green
      case 'BUILDER': return 'var(--color-amber, #FF9500)';    // Amber
      case 'SYSTEM': return 'var(--color-text-muted, #64748B)'; // Gray
      default: return 'var(--color-primary, #10B981)';
    }
  };

  const getAgentEmoji = (agent?: string) => {
    switch (agent) {
      case 'SCOUT': return '🔍';
      case 'ANALYST': return '📊';
      case 'TRADER': return '💹';
      case 'BUILDER': return '🔧';
      case 'SYSTEM': return '⚙️';
      default: return '🤖';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format message content with line breaks and links
  const formatContent = (content: string) => {
    // Split by newlines and render each line
    const lines = content.split('\n');
    return lines.map((line, i) => {
      // Check for URLs and make them clickable
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const parts = line.split(urlRegex);

      return (
        <span key={i}>
          {parts.map((part, j) => {
            if (urlRegex.test(part)) {
              return (
                <a
                  key={j}
                  href={part}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.link}
                >
                  {part}
                </a>
              );
            }
            return part;
          })}
          {i < lines.length - 1 && <br />}
        </span>
      );
    });
  };

  return (
    <div className={styles.chatContainer}>
      {/* Chat Header */}
      <div className={styles.chatHeader}>
        <span className={styles.chatTitle}>AGENT TERMINAL</span>
        <span className={styles.chatStatus}>
          {isProcessing ? (
            <>
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
              <span style={{ marginLeft: '8px' }}>Processing...</span>
            </>
          ) : (
            <>
              <span className={styles.onlineDot} />
              Ready
            </>
          )}
        </span>
      </div>

      {/* Messages Area */}
      <div className={styles.messagesArea}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>💬</div>
            <div className={styles.emptyTitle}>Welcome to BeRight Terminal</div>
            <div className={styles.emptyText}>
              Type a command below to start chatting with our AI agents.
            </div>
            <div className={styles.emptyHints}>
              <span className={styles.hint}>/hot</span>
              <span className={styles.hint}>/research bitcoin</span>
              <span className={styles.hint}>/arb</span>
              <span className={styles.hint}>/help</span>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`${styles.messageRow} ${
                  msg.role === 'user' ? styles.messageRowUser : styles.messageRowAgent
                }`}
              >
                {/* Agent Avatar (left side for agent messages) */}
                {msg.role === 'agent' && (
                  <div
                    className={styles.avatar}
                    style={{ borderColor: getAgentColor(msg.agent) }}
                  >
                    <span>{getAgentEmoji(msg.agent)}</span>
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={`${styles.messageBubble} ${
                    msg.role === 'user' ? styles.bubbleUser : styles.bubbleAgent
                  }`}
                  style={
                    msg.role === 'agent'
                      ? { borderLeftColor: getAgentColor(msg.agent) }
                      : undefined
                  }
                >
                  {/* Agent Name Header */}
                  {msg.role === 'agent' && msg.agent && (
                    <div
                      className={styles.agentHeader}
                      style={{ color: getAgentColor(msg.agent) }}
                    >
                      {msg.agent}
                      {msg.mood && (
                        <span className={styles.mood}>• {msg.mood}</span>
                      )}
                    </div>
                  )}

                  {/* Message Content */}
                  <div className={styles.messageContent}>
                    {formatContent(msg.content)}
                  </div>

                  {/* Timestamp */}
                  <div className={styles.timestamp}>
                    {formatTime(msg.timestamp)}
                  </div>
                </div>

                {/* User Avatar (right side for user messages) */}
                {msg.role === 'user' && (
                  <div className={`${styles.avatar} ${styles.avatarUser}`}>
                    <span>👤</span>
                  </div>
                )}
              </div>
            ))}

            {/* Typing Indicator */}
            {isProcessing && (
              <div className={`${styles.messageRow} ${styles.messageRowAgent}`}>
                <div className={styles.avatar} style={{ borderColor: 'var(--color-primary, #10B981)' }}>
                  <span>🤖</span>
                </div>
                <div className={styles.typingBubble}>
                  <span className={styles.typingDot} />
                  <span className={styles.typingDot} />
                  <span className={styles.typingDot} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>
    </div>
  );
}
