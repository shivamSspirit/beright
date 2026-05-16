/**
 * CodeBlock - Syntax-highlighted code display with copy functionality
 *
 * Clean code display with copy button and language badge.
 *
 * @example Basic usage
 * <CodeBlock code="const x = 1;" language="typescript" />
 *
 * @example With title
 * <CodeBlock
 *   code={apiExample}
 *   language="bash"
 *   title="cURL Request"
 *   showLineNumbers
 * />
 */

'use client';

import { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import styles from './CodeBlock.module.css';

export interface CodeBlockProps {
  /** Code content */
  code: string;
  /** Programming language for syntax highlighting */
  language?: string;
  /** Optional title */
  title?: string;
  /** Show line numbers */
  showLineNumbers?: boolean;
  /** Max height with scroll */
  maxHeight?: string | number;
  /** Additional class name */
  className?: string;
  /** Wrap long lines */
  wrapLines?: boolean;
}

// Simple syntax highlighting tokens
const HIGHLIGHT_PATTERNS: Record<string, RegExp[]> = {
  keyword: [
    /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|try|catch|throw|new|this|typeof|instanceof|in|of|default|switch|case|break|continue)\b/g,
  ],
  string: [
    /"[^"\\]*(?:\\.[^"\\]*)*"/g,
    /'[^'\\]*(?:\\.[^'\\]*)*'/g,
    /`[^`\\]*(?:\\.[^`\\]*)*`/g,
  ],
  comment: [
    /\/\/.*$/gm,
    /\/\*[\s\S]*?\*\//g,
    /#.*$/gm,
  ],
  number: [
    /\b\d+\.?\d*\b/g,
  ],
  function: [
    /\b([a-zA-Z_]\w*)\s*(?=\()/g,
  ],
  property: [
    /\.([a-zA-Z_]\w*)/g,
  ],
};

function highlightCode(code: string): string {
  let result = code;

  // Escape HTML first
  result = result
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Apply highlighting (order matters - strings/comments first)
  result = result.replace(
    /"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'|`[^`\\]*(?:\\.[^`\\]*)*`/g,
    '<span class="token-string">$&</span>'
  );

  result = result.replace(
    /\/\/.*$/gm,
    '<span class="token-comment">$&</span>'
  );

  result = result.replace(
    /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|try|catch|throw|new|this|typeof|instanceof|in|of|default|switch|case|break|continue|true|false|null|undefined)\b/g,
    '<span class="token-keyword">$1</span>'
  );

  result = result.replace(
    /\b(\d+\.?\d*)\b/g,
    '<span class="token-number">$1</span>'
  );

  return result;
}

export function CodeBlock({
  code,
  language,
  title,
  showLineNumbers = false,
  maxHeight,
  className,
  wrapLines = false,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [code]);

  const lines = code.split('\n');
  const highlightedCode = highlightCode(code);

  const codeClasses = [
    styles.codeBlock,
    wrapLines && styles.wrapLines,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={codeClasses}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {title && <span className={styles.title}>{title}</span>}
          {language && <span className={styles.language}>{language}</span>}
        </div>
        <button
          type="button"
          className={styles.copyButton}
          onClick={handleCopy}
          aria-label={copied ? 'Copied!' : 'Copy code'}
        >
          {copied ? (
            <>
              <Check size={14} />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code */}
      <div
        className={styles.codeWrapper}
        style={{ maxHeight: maxHeight ? (typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight) : undefined }}
      >
        {showLineNumbers ? (
          <div className={styles.codeWithLines}>
            <div className={styles.lineNumbers}>
              {lines.map((_, i) => (
                <span key={i}>{i + 1}</span>
              ))}
            </div>
            <pre className={styles.pre}>
              <code
                className={styles.code}
                dangerouslySetInnerHTML={{ __html: highlightedCode }}
              />
            </pre>
          </div>
        ) : (
          <pre className={styles.pre}>
            <code
              className={styles.code}
              dangerouslySetInnerHTML={{ __html: highlightedCode }}
            />
          </pre>
        )}
      </div>
    </div>
  );
}

export default CodeBlock;
