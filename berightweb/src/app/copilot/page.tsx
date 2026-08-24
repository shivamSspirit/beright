'use client';

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Bot,
  ChartNoAxesCombined,
  CheckCircle2,
  CircleDollarSign,
  Compass,
  ExternalLink,
  LoaderCircle,
  LockKeyhole,
  MessageSquareText,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Wallet,
  Zap,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getAgentSession, sendToAgent } from '@/lib/api';
import { useMode } from '@/context/ModeContext';
import { useUser } from '@/hooks/useUnifiedUser';
import styles from './copilot.module.css';

type MessageRole = 'user' | 'assistant';

interface CopilotMessage {
  id: string;
  role: MessageRole;
  content: string;
  capability?: string;
  mood?: string;
  suggestedActions?: string[];
  structuredData?: unknown;
}

interface MarketPreview {
  ticker?: string;
  title: string;
  yesPrice?: number;
  noPrice?: number;
  volume24h?: number;
  url?: string;
}

const SESSION_KEY = 'beright-copilot-session';

const STARTER_PROMPTS = [
  {
    icon: Compass,
    label: 'Find opportunity',
    prompt: 'What prediction markets are moving today? Show me the strongest liquidity and explain why they matter.',
  },
  {
    icon: ChartNoAxesCombined,
    label: 'Research a market',
    prompt: 'Research the most active Bitcoin prediction market. Give me the base rate, evidence for both sides, and key risks.',
  },
  {
    icon: BookOpen,
    label: 'Learn the system',
    prompt: 'Teach me how prediction market prices, resolution rules, liquidity, and calibration work.',
  },
  {
    icon: CircleDollarSign,
    label: 'Review capital',
    prompt: 'Explain when a YES or NO position is safe to match for yield, borrow against, hold, or exit.',
  },
];

const QUICK_CALLOUTS = [
  { label: 'Hot markets', prompt: '/hot' },
  { label: 'Fresh signals', prompt: '/signals' },
  { label: 'Find DFlow markets', prompt: '/dflow' },
  { label: 'My calibration', prompt: '/calibration' },
];

function localId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function toFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function marketPreviews(value: unknown): MarketPreview[] {
  const record = asRecord(value);
  const rawMarkets = record?.markets;
  if (!Array.isArray(rawMarkets)) return [];

  return rawMarkets.slice(0, 4).flatMap((raw) => {
    const market = asRecord(raw);
    if (!market) return [];
    const titleValue = market.title || market.question || market.ticker;
    if (typeof titleValue !== 'string') return [];
    return [{
      ticker: typeof market.ticker === 'string' ? market.ticker : undefined,
      title: titleValue,
      yesPrice: toFiniteNumber(market.yesPrice),
      noPrice: toFiniteNumber(market.noPrice),
      volume24h: toFiniteNumber(market.volume24h),
      url: typeof market.url === 'string' ? market.url : undefined,
    }];
  });
}

function probability(value: number | undefined): string {
  if (value === undefined) return '—';
  return `${Math.round((value > 1 ? value / 100 : value) * 100)}%`;
}

function compactUsd(value: number | undefined): string | null {
  if (value === undefined) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function actionLabel(action: string): string {
  if (action.startsWith('/quote')) return 'Check live quote';
  if (action.startsWith('/trade') || action.startsWith('/buy')) return 'Prepare trade review';
  if (action === '/markets') return 'Open markets';
  return action.replace(/^\//, '').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function WelcomeMessage({ onPrompt }: { onPrompt: (prompt: string) => void }) {
  return (
    <section className={styles.welcome} aria-labelledby="copilot-welcome-title">
      <div className={styles.welcomeMark} aria-hidden="true">
        <Sparkles size={22} />
      </div>
      <p className={styles.eyebrow}>Prediction intelligence, one conversation away</p>
      <h1 id="copilot-welcome-title">Ask the market before you trade it.</h1>
      <p className={styles.welcomeCopy}>
        Find active markets, pressure-test your thesis, understand resolution risk, inspect positions,
        and prepare an execution for your wallet to approve.
      </p>
      <div className={styles.starterGrid}>
        {STARTER_PROMPTS.map(({ icon: Icon, label, prompt }) => (
          <button key={label} type="button" className={styles.starterCard} onClick={() => onPrompt(prompt)}>
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}

function MarketCards({ data }: { data: unknown }) {
  const markets = marketPreviews(data);
  if (markets.length === 0) return null;

  return (
    <div className={styles.marketGrid} aria-label="Prediction markets">
      {markets.map((market, index) => {
        const href = market.ticker
          ? `/markets?query=${encodeURIComponent(market.ticker)}`
          : market.url || '/markets';
        return (
          <Link className={styles.marketCard} href={href} key={`${market.ticker || market.title}-${index}`}>
            <div className={styles.marketTitleRow}>
              <span>{market.title}</span>
              <ArrowRight size={15} aria-hidden="true" />
            </div>
            <div className={styles.marketNumbers}>
              <span className={styles.yesPrice}>YES {probability(market.yesPrice)}</span>
              <span className={styles.noPrice}>NO {probability(market.noPrice)}</span>
              {compactUsd(market.volume24h) && <span>Vol {compactUsd(market.volume24h)}</span>}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function CopilotPage() {
  const { isDemo, network } = useMode();
  const { user, walletAddress, isAuthenticated, isLoading: walletLoading, login } = useUser();
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string>();
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedPrompt, setFailedPrompt] = useState<string | null>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const storedSession = window.localStorage.getItem(SESSION_KEY);
    if (!storedSession) return;
    setSessionId(storedSession);

    let active = true;
    void getAgentSession(storedSession).then((response) => {
      if (!active || !response.data.exists) return;
      setMessages(response.data.messages.map((message) => ({
        id: `${message.timestamp}-${message.role}`,
        role: message.role === 'agent' ? 'assistant' : 'user',
        content: message.content,
        capability: message.agent,
      })));
    }).catch(() => {
      // Session memory is opportunistic; an expired server session starts cleanly.
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, isSending]);

  const statusLabel = useMemo(() => {
    if (walletLoading) return 'Checking wallet';
    if (isAuthenticated && walletAddress) return `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`;
    return 'Read-only';
  }, [isAuthenticated, walletAddress, walletLoading]);

  async function submitPrompt(prompt: string): Promise<void> {
    const message = prompt.trim();
    if (!message || isSending) return;

    setMessages((current) => [...current, { id: localId(), role: 'user', content: message }]);
    setInput('');
    setError(null);
    setFailedPrompt(null);
    setIsSending(true);

    try {
      const response = await sendToAgent(message, {
        sessionId,
        userId: user?.id,
      });
      if (!response.success || !response.data?.text) {
        throw new Error(response.error || 'Copilot returned an empty response.');
      }
      if (response.session?.id) {
        setSessionId(response.session.id);
        window.localStorage.setItem(SESSION_KEY, response.session.id);
      }
      setMessages((current) => [...current, {
        id: localId(),
        role: 'assistant',
        content: response.data.text,
        capability: response.data.capability || response.data.agent,
        mood: response.data.mood,
        suggestedActions: response.data.suggestedActions,
        structuredData: response.data.structuredData,
      }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Copilot is temporarily unavailable.');
      setFailedPrompt(message);
    } finally {
      setIsSending(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submitPrompt(input);
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function clearConversation(): void {
    setMessages([]);
    setSessionId(undefined);
    setError(null);
    setFailedPrompt(null);
    window.localStorage.removeItem(SESSION_KEY);
    inputRef.current?.focus();
  }

  return (
    <div className={styles.page}>
      <main className={styles.shell}>
        <section className={styles.chatPanel} aria-label="BeRight Copilot conversation">
          <header className={styles.chatHeader}>
            <div>
              <div className={styles.productLine}>
                <span className={styles.statusDot} aria-hidden="true" />
                <strong>BeRight Copilot</strong>
                <span className={styles.beta}>Preview</span>
              </div>
              <p>Prediction markets only · recommendations are not guarantees</p>
            </div>
            <div className={styles.headerActions}>
              <span className={styles.networkBadge}>{isDemo ? 'Demo' : network || 'Mainnet'}</span>
              <button type="button" className={styles.clearButton} onClick={clearConversation} disabled={messages.length === 0}>
                <RefreshCw size={16} aria-hidden="true" />
                <span>New chat</span>
              </button>
            </div>
          </header>

          <div className={styles.conversation} aria-live="polite">
            {messages.length === 0 ? (
              <WelcomeMessage onPrompt={(prompt) => {
                setInput(prompt);
                inputRef.current?.focus();
              }} />
            ) : (
              messages.map((message) => (
                <article
                  className={`${styles.message} ${message.role === 'user' ? styles.userMessage : styles.assistantMessage}`}
                  key={message.id}
                >
                  <div className={styles.messageAvatar} aria-hidden="true">
                    {message.role === 'assistant' ? <Bot size={18} /> : 'You'}
                  </div>
                  <div className={styles.messageBody}>
                    {message.role === 'assistant' && (
                      <div className={styles.messageMeta}>
                        <span>{message.capability || 'BeRight'}</span>
                        {message.mood && <span>{message.mood.toLowerCase()}</span>}
                      </div>
                    )}
                    <div className={styles.markdown}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                    </div>
                    <MarketCards data={message.structuredData} />
                    {message.suggestedActions && message.suggestedActions.length > 0 && (
                      <div className={styles.messageActions}>
                        {message.suggestedActions.slice(0, 3).map((action) => (
                          action === '/markets' ? (
                            <Link href="/markets" className={styles.actionButton} key={action}>
                              {actionLabel(action)}
                              <ArrowRight size={15} aria-hidden="true" />
                            </Link>
                          ) : (
                            <button
                              type="button"
                              className={styles.actionButton}
                              onClick={() => void submitPrompt(action)}
                              disabled={isSending}
                              key={action}
                            >
                              {actionLabel(action)}
                              <ArrowRight size={15} aria-hidden="true" />
                            </button>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              ))
            )}

            {isSending && (
              <div className={`${styles.message} ${styles.assistantMessage}`} role="status">
                <div className={styles.messageAvatar} aria-hidden="true"><Bot size={18} /></div>
                <div className={styles.thinking}>
                  <LoaderCircle size={17} aria-hidden="true" />
                  Checking markets, liquidity, and resolution risk…
                </div>
              </div>
            )}
            <div ref={conversationEndRef} />
          </div>

          <div className={styles.composerArea}>
            {error && (
              <div className={styles.inlineError} role="alert">
                <span>{error}</span>
                <button type="button" onClick={() => failedPrompt && void submitPrompt(failedPrompt)} disabled={!failedPrompt || isSending}>Retry</button>
              </div>
            )}
            <form className={styles.composer} onSubmit={onSubmit} aria-busy={isSending}>
              <label htmlFor="copilot-message" className={styles.srOnly}>Ask BeRight Copilot</label>
              <textarea
                id="copilot-message"
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Ask about a market, thesis, position, or trade…"
                rows={1}
                maxLength={4_000}
                disabled={isSending}
              />
              <button type="submit" className={styles.sendButton} disabled={!input.trim() || isSending} aria-label="Send message">
                {isSending ? <LoaderCircle size={19} aria-hidden="true" /> : <Send size={19} aria-hidden="true" />}
              </button>
            </form>
            <p className={styles.composerNote}>
              BeRight can make mistakes. Verify market rules, quotes, and settlement conditions before signing.
            </p>
          </div>
        </section>

        <aside className={styles.contextRail} aria-label="Copilot tools and safety">
          <section className={styles.railCard}>
            <div className={styles.railHeading}>
              <Zap size={17} aria-hidden="true" />
              <h2>Callouts</h2>
            </div>
            <p>Pull fresh market signals into this conversation.</p>
            <div className={styles.calloutList}>
              {QUICK_CALLOUTS.map((callout) => (
                <button type="button" onClick={() => void submitPrompt(callout.prompt)} disabled={isSending} key={callout.prompt}>
                  <span>{callout.label}</span>
                  <ArrowRight size={15} aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>

          <section className={styles.railCard}>
            <div className={styles.railHeading}>
              <ShieldCheck size={17} aria-hidden="true" />
              <h2>Execution boundary</h2>
            </div>
            <ul className={styles.safetyList}>
              <li><CheckCircle2 size={15} aria-hidden="true" /> Copilot researches and prepares</li>
              <li><LockKeyhole size={15} aria-hidden="true" /> Your wallet remains the signer</li>
              <li><Wallet size={15} aria-hidden="true" /> No silent trades or withdrawals</li>
            </ul>
            <div className={styles.walletRow}>
              <div>
                <span>Wallet</span>
                <strong>{statusLabel}</strong>
              </div>
              {!isAuthenticated && (
                <button type="button" onClick={() => void login()} disabled={walletLoading}>Connect</button>
              )}
            </div>
          </section>

          <section className={styles.railCard}>
            <div className={styles.railHeading}>
              <MessageSquareText size={17} aria-hidden="true" />
              <h2>Knowledge guide</h2>
            </div>
            <nav className={styles.guideLinks}>
              <button type="button" onClick={() => void submitPrompt('Explain prediction market resolution risk with examples.')}>
                Resolution rules <ArrowRight size={15} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => void submitPrompt('Teach me liquidity, spread, slippage, and executable prices in prediction markets.')}>
                Liquidity &amp; slippage <ArrowRight size={15} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => void submitPrompt('Explain Brier score and how to become a calibrated forecaster.')}>
                Calibration <ArrowRight size={15} aria-hidden="true" />
              </button>
              <Link href="/docs">
                Full documentation <ExternalLink size={15} aria-hidden="true" />
              </Link>
            </nav>
          </section>
        </aside>
      </main>
    </div>
  );
}

export default CopilotPage;
