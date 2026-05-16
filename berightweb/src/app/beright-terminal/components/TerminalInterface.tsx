'use client';

import { useState, useEffect, useRef } from 'react';
import { TerminalLine } from './types';
import styles from '../terminal.module.css';

interface TerminalInterfaceProps {
  lines: TerminalLine[];
  onCommand: (cmd: string) => void;
  isProcessing: boolean;
}

const COMMANDS = [
  { cmd: '/help', desc: 'All commands' },
  { cmd: '/hot', desc: 'Hot markets' },
  { cmd: '/alpha', desc: 'Alpha plays' },
  { cmd: '/arb', desc: 'Arbitrage' },
  { cmd: '/research', desc: 'Research' },
  { cmd: '/intelligence', desc: 'AI analysis' },
  { cmd: '/whale', desc: 'Whales' },
  { cmd: '/intel', desc: 'News' },
  { cmd: '/brief', desc: 'Briefing' },
  { cmd: '/me', desc: 'My stats' },
  { cmd: '/predict', desc: 'Predict' },
  { cmd: '/signals', desc: 'Signals' },
  { cmd: '/portfolio', desc: 'Portfolio' },
  { cmd: '/risk', desc: 'Risk' },
];

/**
 * TerminalInterface - Command line interface
 *
 * Full-featured terminal with command history and output rendering.
 */
export default function TerminalInterface({
  lines,
  onCommand,
  isProcessing
}: TerminalInterfaceProps) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalRef.current?.scrollTo({ top: terminalRef.current.scrollHeight, behavior: 'smooth' });
  }, [lines]);

  const handleSubmit = () => {
    if (!input.trim() || isProcessing) return;
    setHistory(prev => [...prev, input]);
    setHistoryIndex(-1);
    onCommand(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex] || '');
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  const getLineTypeClass = (type: TerminalLine['type']) => {
    switch (type) {
      case 'input': return styles.lineInput;
      case 'output': return styles.lineOutput;
      case 'system': return styles.lineSystem;
      case 'error': return styles.lineError;
      case 'success': return styles.lineSuccess;
      case 'data': return styles.lineData;
      case 'link': return styles.marketLink;
      default: return '';
    }
  };

  const getPromptClass = (type: TerminalLine['type']) => {
    switch (type) {
      case 'system': return styles.promptSys;
      case 'error': return styles.promptErr;
      case 'success': return styles.promptOk;
      case 'data': return styles.promptData;
      case 'link': return styles.promptLink;
      default: return '';
    }
  };

  const getPromptChar = (type: TerminalLine['type']) => {
    switch (type) {
      case 'input': return '❯';
      case 'system': return '◈';
      case 'error': return '✗';
      case 'success': return '✓';
      case 'data': return '▸';
      case 'link': return '↗';
      default: return '▸';
    }
  };

  return (
    <div className={styles.terminalInterface}>
      <div className={styles.terminalHeader}>
        <div className={styles.terminalControls}>
          <span className={`${styles.control} ${styles.controlRed}`} />
          <span className={`${styles.control} ${styles.controlYellow}`} />
          <span className={`${styles.control} ${styles.controlGreen}`} />
        </div>
        <span className={styles.terminalTitle}>BERIGHT://TERMINAL</span>
        <span className={styles.terminalVersion}>v2.0.0</span>
      </div>

      <div className={styles.terminalBody} ref={terminalRef}>
        {lines.map(line => (
          <div key={line.id} className={styles.terminalLine}>
            <span className={`${styles.prompt} ${getPromptClass(line.type)}`}>
              {getPromptChar(line.type)}
            </span>
            {line.type === 'link' ? (
              <a
                href={line.content.replace('→ Trade: ', '').replace('→ ', '')}
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.lineContent} ${styles.marketLink}`}
              >
                {line.content}
              </a>
            ) : (
              <span className={`${styles.lineContent} ${getLineTypeClass(line.type)}`}>
                {line.content}
              </span>
            )}
          </div>
        ))}
        {isProcessing && (
          <div className={styles.terminalLine}>
            <span className={`${styles.prompt} ${styles.promptSys}`}>◈</span>
            <span className={styles.processingText}>Processing<span className={styles.bootCursor}>_</span></span>
          </div>
        )}
      </div>

      <div className={styles.terminalInputArea}>
        <div className={styles.commandHints}>
          {COMMANDS.map(c => (
            <button
              key={c.cmd}
              className={styles.hintChip}
              onClick={() => setInput(c.cmd)}
            >
              {c.cmd}
            </button>
          ))}
        </div>
        <div className={styles.inputRow}>
          <span className={styles.inputPrompt}>❯</span>
          <input
            ref={inputRef}
            type="text"
            className={styles.terminalInput}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter command or ask anything..."
            disabled={isProcessing}
            autoFocus
          />
          <button
            className={`${styles.sendBtn} ${input.trim() && !isProcessing ? styles.sendBtnActive : ''}`}
            onClick={handleSubmit}
            disabled={!input.trim() || isProcessing}
          >
            <span className={styles.sendIcon}>⏎</span>
          </button>
        </div>
      </div>
    </div>
  );
}
