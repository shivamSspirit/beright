'use client';

import { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import BrandLogo from '@/components/BrandLogo';
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
 * - Rich markdown rendering for agent responses
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

  // Clean and prepare markdown content
  const prepareMarkdownContent = (content: string) => {
    // Remove markdown code fences if present (```markdown or ```)
    let cleaned = content.replace(/^```markdown\s*/i, '').replace(/```\s*$/, '');

    // Also handle inline code fences
    cleaned = cleaned.replace(/^```\s*/gm, '').replace(/```\s*$/gm, '');

    return cleaned.trim();
  };

  // Format message content with markdown rendering for agent messages
  const formatContent = (content: string, role: 'user' | 'agent') => {
    // User messages: simple text rendering
    if (role === 'user') {
      return <div className={styles.userText}>{content}</div>;
    }

    // Agent messages: rich markdown rendering
    const markdownContent = prepareMarkdownContent(content);

    return (
      <div className={styles.markdown}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
          // Custom table styling
          table: ({ children }) => (
            <div className={styles.tableWrapper}>
              <table className={styles.markdownTable}>{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead>{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr>{children}</tr>,
          th: ({ children }) => <th>{children}</th>,
          td: ({ children }) => <td>{children}</td>,
          // Custom code block styling
          code: ({ inline, className, children, ...props }: any) => {
            return inline ? (
              <code className={styles.inlineCode} {...props}>
                {children}
              </code>
            ) : (
              <pre className={styles.codeBlock}>
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            );
          },
          // Custom link styling
          a: ({ children, href }) => (
            <a
              className={styles.markdownLink}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          // Custom heading styling
          h1: ({ children }) => <h1 className={styles.h1}>{children}</h1>,
          h2: ({ children }) => <h2 className={styles.h2}>{children}</h2>,
          h3: ({ children }) => <h3 className={styles.h3}>{children}</h3>,
          // Custom list styling
          ul: ({ children }) => <ul className={styles.ul}>{children}</ul>,
          ol: ({ children }) => <ol className={styles.ol}>{children}</ol>,
          li: ({ children }) => <li className={styles.li}>{children}</li>,
          // Custom blockquote styling
          blockquote: ({ children }) => (
            <blockquote className={styles.blockquote}>{children}</blockquote>
          ),
          // Custom paragraph styling
          p: ({ children }) => <p className={styles.paragraph}>{children}</p>,
        }}
        >
          {markdownContent}
        </ReactMarkdown>
      </div>
    );
  };

  return (
    <div className={styles.chatContainer}>
      {/* Chat Header */}
      <div className={styles.chatHeader}>
        <span className={styles.chatTitle}>beright AI</span>
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
                {/* Agent Avatar (left side for agent messages) - BeRight silver sphere */}
                {msg.role === 'agent' && (
                  <div
                    className={styles.avatar}
                    style={{ borderColor: getAgentColor(msg.agent) }}
                  >
                    <BrandLogo size={20} />
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
                    {formatContent(msg.content, msg.role)}
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

            {/* Typing Indicator - BeRight AI thinking */}
            {isProcessing && (
              <div className={`${styles.messageRow} ${styles.messageRowAgent}`}>
                <div className={styles.avatar} style={{ borderColor: 'var(--color-primary, #10B981)' }}>
                  <BrandLogo size={20} className={styles.thinkingLogo} />
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
