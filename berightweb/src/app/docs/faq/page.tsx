'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  PageWrapper,
  Section,
  useStagger,
} from '@/components/ui';
import { FAQ_ITEMS, FAQ_CATEGORIES, CATEGORY_COLORS, type FAQCategory } from '@/content/faq-data';
import styles from './faq.module.css';

// ===========================================================================
// SEO Structured Data
// ===========================================================================

function FAQStructuredData() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer.replace(/\*\*/g, '').replace(/`/g, ''),
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
    />
  );
}

// ===========================================================================
// Copy Link Button
// ===========================================================================

function CopyLinkButton({ questionId }: { questionId: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}#${questionId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [questionId]);

  return (
    <button
      className={styles.copyLinkBtn}
      onClick={handleCopy}
      title="Copy link to this question"
    >
      {copied ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      )}
    </button>
  );
}

// ===========================================================================
// Feedback Component
// ===========================================================================

function FeedbackButtons({ questionId }: { questionId: string }) {
  const [feedback, setFeedback] = useState<'helpful' | 'not-helpful' | null>(null);

  const handleFeedback = useCallback((type: 'helpful' | 'not-helpful') => {
    setFeedback(type);
    console.log(`[FAQ Feedback] ${questionId}: ${type}`);
  }, [questionId]);

  if (feedback) {
    return <div className={styles.feedbackThanks}>Thanks for your feedback!</div>;
  }

  return (
    <div className={styles.feedbackButtons}>
      <span className={styles.feedbackLabel}>Was this helpful?</span>
      <button
        className={styles.feedbackBtn}
        onClick={() => handleFeedback('helpful')}
        title="Yes, this was helpful"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
        </svg>
      </button>
      <button
        className={styles.feedbackBtn}
        onClick={() => handleFeedback('not-helpful')}
        title="No, this wasn't helpful"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
        </svg>
      </button>
    </div>
  );
}

// ===========================================================================
// Main FAQ Page
// ===========================================================================

export default function FAQPage() {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set(['what-is-beright', 'scoring']));
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const faqListRef = useStagger<HTMLDivElement>({ stagger: 0.05 });

  // Handle hash navigation on mount
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      const element = document.getElementById(hash);
      if (element) {
        setOpenItems(new Set([hash]));
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }
  }, []);

  const toggleItem = (id: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Filter by category and search query
  const filteredItems = FAQ_ITEMS.filter((item) => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch =
      searchQuery === '' ||
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Parse markdown-style text
  const renderAnswer = (answer: string) => {
    return answer.split('\n').map((line, i) => {
      if (line.startsWith('```')) return null;

      const parts = line.split(/\*\*(.*?)\*\*/g);
      const processedParts = parts.map((part, j) => {
        if (j % 2 === 1) {
          return <strong key={j}>{part}</strong>;
        }
        const codeParts = part.split(/`([^`]+)`/g);
        return codeParts.map((codePart, k) => {
          if (k % 2 === 1) {
            return (
              <code key={k} className={styles.inlineCode}>
                {codePart}
              </code>
            );
          }
          return codePart;
        });
      });

      return <p key={i}>{processedParts}</p>;
    });
  };

  return (
    <PageWrapper showHeader={true} showFooter={false}>
      <FAQStructuredData />

      {/* Hero */}
      <Section variant="gradient" size="lg" className={styles.hero}>
        <h1 className={styles.heroTitle}>Frequently Asked Questions</h1>
        <p className={styles.heroSubtitle}>Quick answers on markets, scoring, the terminal, API, and more</p>

        {/* Search */}
        <div className={styles.searchWrapper}>
          <svg
            className={styles.searchIcon}
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search questions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className={styles.searchClear} onClick={() => setSearchQuery('')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </Section>

      {/* Category Filter */}
      <Section size="sm">
        <div className={styles.categoryFilter}>
          <button
            className={`${styles.catBtn} ${activeCategory === 'all' ? styles.catBtnActive : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            All
          </button>
          {FAQ_CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`${styles.catBtn} ${activeCategory === cat ? styles.catBtnActive : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </Section>

      {/* FAQ List */}
      <Section>
        <div ref={faqListRef} className={styles.faqList}>
          {filteredItems.length === 0 ? (
            <div className={styles.noResults}>
              <p>No questions found matching &quot;{searchQuery}&quot;</p>
              <button className={styles.noResultsBtn} onClick={() => setSearchQuery('')}>
                Clear search
              </button>
            </div>
          ) : (
            filteredItems.map((item) => {
              const colors = CATEGORY_COLORS[item.category as FAQCategory];
              const isOpen = openItems.has(item.id);
              return (
                <div
                  key={item.id}
                  id={item.id}
                  className={`${styles.faqItem} ${isOpen ? styles.faqItemOpen : ''}`}
                >
                  <button className={styles.faqQuestion} onClick={() => toggleItem(item.id)}>
                    <span
                      className={styles.faqCategoryTag}
                      style={{
                        background: colors.bg,
                        borderColor: colors.border,
                        color: colors.text,
                      }}
                    >
                      {item.category}
                    </span>
                    <span className={styles.faqQText}>{item.question}</span>
                    <div className={styles.faqActions}>
                      <CopyLinkButton questionId={item.id} />
                      <span className={`${styles.faqToggle} ${isOpen ? styles.faqToggleOpen : ''}`}>
                        {isOpen ? '−' : '+'}
                      </span>
                    </div>
                  </button>
                  {isOpen && (
                    <div className={styles.faqAnswer}>
                      {renderAnswer(item.answer)}
                      <FeedbackButtons questionId={item.id} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Section>

      {/* CTA */}
      <Section variant="gradient" className={styles.cta}>
        <h2 className={styles.ctaTitle}>Still have questions?</h2>
        <p className={styles.ctaSubtitle}>Try the terminal or join our community</p>
        <div className={styles.ctaButtons}>
          <Link
            href="/beright-terminal"
            className={`${styles.ctaBtn} ${styles.ctaBtnPrimary}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 17l6-6-6-6M12 19h8" />
            </svg>
            Open Terminal
          </Link>
          <a
            href="https://x.com/AgentBEright"
            className={`${styles.ctaBtn} ${styles.ctaBtnSecondary}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Follow @AgentBEright
          </a>
          <Link href="/docs" className={`${styles.ctaBtn} ${styles.ctaBtnTertiary}`}>
            Back to Docs
          </Link>
        </div>
        <p className={styles.supportEmail}>
          For support inquiries: <a href="mailto:support@beright.io">support@beright.io</a>
        </p>
      </Section>
    </PageWrapper>
  );
}
