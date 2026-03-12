'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import styles from '../beright.module.css';

interface CLIInputProps {
  onCommand: (command: string) => void;
  isProcessing?: boolean;
  placeholder?: string;
}

/**
 * CLIInput - Bottom terminal command input
 *
 * Green prompt with command history support.
 */
export default function CLIInput({
  onCommand,
  isProcessing = false,
  placeholder = 'Enter command (e.g., /hot, /research bitcoin, /arb) or type /help',
}: CLIInputProps) {
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && value.trim() && !isProcessing) {
      const cmd = value.trim();
      onCommand(cmd);
      setHistory(prev => [cmd, ...prev.slice(0, 49)]);
      setValue('');
      setHistoryIndex(-1);
    }

    // Command history navigation
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setValue(history[newIndex]);
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setValue(history[newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setValue('');
      }
    }

    // Quick command shortcuts
    if (e.key === 'Escape') {
      setValue('');
      setHistoryIndex(-1);
    }
  };

  return (
    <footer className={styles.cliWrapper}>
      <span className={styles.cliPrompt}>beright_trader@sys:~$</span>
      <input
        ref={inputRef}
        type="text"
        className={styles.cliInput}
        placeholder={isProcessing ? 'Processing...' : placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isProcessing}
        autoFocus
        autoComplete="off"
        spellCheck={false}
      />
    </footer>
  );
}
