'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useBackendStatus } from '@/hooks/useMarkets';
import { searchMarkets, getHotMarkets, ApiMarket } from '@/lib/api';
import { mockApiMarkets } from '@/lib/mockData';
import BottomNav from '@/components/BottomNav';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES & CONFIG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type Category = 'all' | 'crypto' | 'politics' | 'economics' | 'tech' | 'sports';
type Provider = 'all' | 'kalshi' | 'polymarket' | 'manifold' | 'metaculus';
type SortOption = 'trending' | 'newest' | 'volume' | 'ending';

const categories: { id: Category; label: string; icon: string }[] = [
  { id: 'all', label: 'All Categories', icon: '🌐' },
  { id: 'crypto', label: 'Crypto', icon: '₿' },
  { id: 'politics', label: 'Politics', icon: '🏛' },
  { id: 'economics', label: 'Economy', icon: '📊' },
  { id: 'tech', label: 'Tech', icon: '⚡' },
  { id: 'sports', label: 'Sports', icon: '⚽' },
];

const providers: { id: Provider; label: string; color: string }[] = [
  { id: 'all', label: 'All Platforms', color: '#A78BFA' },
  { id: 'kalshi', label: 'Kalshi', color: '#00D4AA' },
  { id: 'polymarket', label: 'Polymarket', color: '#818CF8' },
  { id: 'manifold', label: 'Manifold', color: '#34D399' },
  { id: 'metaculus', label: 'Metaculus', color: '#60A5FA' },
];

const sortOptions: { id: SortOption; label: string; icon: string }[] = [
  { id: 'trending', label: 'Trending', icon: '🔥' },
  { id: 'newest', label: 'Newest', icon: '✨' },
  { id: 'volume', label: 'Highest Volume', icon: '📈' },
  { id: 'ending', label: 'Ending Soon', icon: '⏰' },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CUSTOM DROPDOWN COMPONENT (Portal-based)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface DropdownOption<T> {
  id: T;
  label: string;
  icon?: string;
  color?: string;
}

interface DropdownProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: DropdownOption<T>[];
}

function Dropdown<T extends string>({ value, onChange, options }: DropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.id === value);

  // Client-side only
  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate position when opening
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: Math.max(rect.width, 200)
      });
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const menuContent = isOpen && mounted && menuPosition.width > 0 ? createPortal(
    <div
      ref={menuRef}
      className="portal-dropdown-menu"
      style={{
        position: 'fixed',
        top: menuPosition.top,
        left: menuPosition.left,
        minWidth: menuPosition.width,
        zIndex: 99999,
      }}
    >
      {options.map((option) => (
        <button
          key={option.id}
          className={`portal-dropdown-item ${value === option.id ? 'selected' : ''}`}
          onClick={() => {
            onChange(option.id);
            setIsOpen(false);
          }}
          type="button"
        >
          {option.icon && <span className="item-icon">{option.icon}</span>}
          {option.color && !option.icon && (
            <span className="item-dot" style={{ background: option.color }} />
          )}
          <span className="item-label">{option.label}</span>
          {value === option.id && (
            <svg className="item-check" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <div className={`dropdown ${isOpen ? 'open' : ''}`}>
      <button
        ref={triggerRef}
        className="dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        {selectedOption?.icon && <span className="dropdown-icon">{selectedOption.icon}</span>}
        <span className="dropdown-label">{selectedOption?.label}</span>
        <svg className="dropdown-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {menuContent}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function formatVolume(volume: number): string {
  if (volume >= 1_000_000_000) return `$${(volume / 1_000_000_000).toFixed(1)}B`;
  if (volume >= 1_000_000) return `$${(volume / 1_000_000).toFixed(1)}M`;
  if (volume >= 1_000) return `$${Math.round(volume / 1_000)}K`;
  return `$${volume}`;
}

function formatDate(dateStr: string | null): { text: string; isLive: boolean } {
  if (!dateStr) return { text: 'TBD', isLive: false };

  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 1 && diffDays >= 0) {
    return { text: 'LIVE', isLive: true };
  }

  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate();
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return { text: `${month} ${day} @ ${time}`, isLive: false };
}

function categorizeMarket(title: string): Category {
  const lower = title.toLowerCase();
  if (lower.includes('bitcoin') || lower.includes('btc') || lower.includes('eth') || lower.includes('crypto') || lower.includes('solana')) return 'crypto';
  if (lower.includes('trump') || lower.includes('biden') || lower.includes('election') || lower.includes('president')) return 'politics';
  if (lower.includes('fed') || lower.includes('rate') || lower.includes('inflation') || lower.includes('recession') || lower.includes('tariff')) return 'economics';
  if (lower.includes('ai') || lower.includes('spacex') || lower.includes('tesla') || lower.includes('gpt')) return 'tech';
  if (lower.includes('nba') || lower.includes('nfl') || lower.includes('championship') || lower.includes('super bowl')) return 'sports';
  return 'politics';
}

function getMultiplier(pct: number): string {
  if (pct <= 0) return '—';
  return (100 / pct).toFixed(2) + 'x';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MARKET CARD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function MarketCard({ market }: { market: ApiMarket }) {
  const dateInfo = formatDate(market.endDate);

  return (
    <a
      href={market.url}
      target="_blank"
      rel="noopener noreferrer"
      className="market-card"
    >
      <div className="card-header">
        <h3 className="card-title">{market.question || market.title}</h3>
        <div className={`card-date ${dateInfo.isLive ? 'live' : ''}`}>
          {dateInfo.isLive && <span className="live-dot" />}
          {dateInfo.text}
        </div>
      </div>

      <div className="outcomes">
        <div className="outcome-row">
          <span className="outcome-name">Yes</span>
          <span className="outcome-multiplier">{getMultiplier(market.yesPct)}</span>
          <span className="outcome-pct yes">{market.yesPct}%</span>
        </div>
        <div className="outcome-row">
          <span className="outcome-name">No</span>
          <span className="outcome-multiplier">{getMultiplier(market.noPct)}</span>
          <span className="outcome-pct no">{market.noPct}%</span>
        </div>
      </div>

      <div className="card-footer">
        <span className="volume">{formatVolume(market.volume)} vol</span>
        <span className="platform">{market.platform}</span>
      </div>
    </a>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function MarketsPage() {
  const { isConnected } = useBackendStatus();
  const [markets, setMarkets] = useState<ApiMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>('all');
  const [selectedProvider, setSelectedProvider] = useState<Provider>('all');
  const [selectedSort, setSelectedSort] = useState<SortOption>('trending');

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    try {
      const response = searchQuery
        ? await searchMarkets(searchQuery, { limit: 50 })
        : await getHotMarkets(50);
      setMarkets(response.markets);
    } catch {
      setMarkets(mockApiMarkets as ApiMarket[]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  useEffect(() => {
    const timer = setTimeout(fetchMarkets, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredMarkets = useMemo(() => {
    let filtered = markets;

    if (selectedProvider !== 'all') {
      filtered = filtered.filter(m => m.platform === selectedProvider);
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(m => categorizeMarket(m.title) === selectedCategory);
    }

    return filtered;
  }, [markets, selectedCategory, selectedProvider]);

  return (
    <div className="markets-page">
      {/* Header */}
      <header className="markets-header">
        <div className="header-top">
          <Link href="/" className="back-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="page-title">Browse Markets</h1>
          <div className={`status-badge ${isConnected ? 'live' : ''}`}>
            <span className="status-dot" />
            {isConnected ? 'Live' : 'Demo'}
          </div>
        </div>

        {/* Search */}
        <div className="search-container">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search markets..."
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery('')} type="button">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.5 3.5L3.5 10.5M3.5 3.5l7 7" />
              </svg>
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="filters-container">
          <Dropdown
            value={selectedSort}
            onChange={setSelectedSort}
            options={sortOptions}
          />
          <Dropdown
            value={selectedProvider}
            onChange={setSelectedProvider}
            options={providers}
          />
          <Dropdown
            value={selectedCategory}
            onChange={setSelectedCategory}
            options={categories}
          />
        </div>

        {/* Results count */}
        <div className="results-info">
          <span className="results-count">{filteredMarkets.length} markets</span>
        </div>
      </header>

      {/* Market Grid */}
      <main className="markets-main">
        {loading ? (
          <div className="markets-grid">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="skeleton-card">
                <div className="skeleton-title" />
                <div className="skeleton-date" />
                <div className="skeleton-outcomes">
                  <div className="skeleton-outcome" />
                  <div className="skeleton-outcome" />
                </div>
                <div className="skeleton-footer" />
              </div>
            ))}
          </div>
        ) : filteredMarkets.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🔍</span>
            <p className="empty-title">No markets found</p>
            <p className="empty-hint">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="markets-grid">
            {filteredMarkets.map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </div>
        )}
      </main>

      <BottomNav />

      <style jsx>{`
        .markets-page {
          min-height: 100dvh;
          background: #09090B;
          padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px));
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           HEADER
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .markets-header {
          position: sticky;
          top: 0;
          z-index: 50;
          background: #09090B;
          padding-top: env(safe-area-inset-top, 0px);
        }

        .header-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
        }

        .back-btn {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          color: rgba(255, 255, 255, 0.8);
          transition: all 0.2s;
        }

        .back-btn:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .page-title {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
        }

        .status-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
        }

        .status-badge.live {
          background: rgba(34, 197, 94, 0.12);
          color: #22C55E;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }

        .status-badge.live .status-dot {
          box-shadow: 0 0 8px currentColor;
          animation: glow 2s ease-in-out infinite;
        }

        @keyframes glow {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px currentColor; }
          50% { opacity: 0.6; box-shadow: 0 0 4px currentColor; }
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           SEARCH
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .search-container {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 0 16px 16px;
          padding: 14px 16px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 14px;
          transition: all 0.2s;
        }

        .search-container:focus-within {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(167, 139, 250, 0.4);
        }

        .search-container svg {
          color: rgba(255, 255, 255, 0.35);
          flex-shrink: 0;
        }

        .search-container input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          font-size: 15px;
          color: #fff;
        }

        .search-container input::placeholder {
          color: rgba(255, 255, 255, 0.35);
        }

        .search-clear {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.08);
          border: none;
          border-radius: 8px;
          color: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          transition: all 0.15s;
        }

        .search-clear:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           FILTERS - CUSTOM DROPDOWNS
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .filters-container {
          display: flex;
          gap: 10px;
          padding: 0 16px 14px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }

        .filters-container::-webkit-scrollbar {
          display: none;
        }

        .filters-container :global(.dropdown) {
          position: relative;
          flex-shrink: 0;
        }

        .filters-container :global(.dropdown-trigger) {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.03) 100%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.85);
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .filters-container :global(.dropdown-trigger:hover) {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.05) 100%);
          border-color: rgba(255, 255, 255, 0.12);
        }

        .filters-container :global(.dropdown.open .dropdown-trigger) {
          background: linear-gradient(135deg, rgba(167, 139, 250, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%);
          border-color: rgba(167, 139, 250, 0.4);
          color: #E9D5FF;
        }

        .filters-container :global(.dropdown-icon) {
          font-size: 14px;
        }

        .filters-container :global(.dropdown-label) {
          max-width: 110px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .filters-container :global(.dropdown-arrow) {
          color: rgba(255, 255, 255, 0.4);
          transition: transform 0.2s ease;
          flex-shrink: 0;
        }

        .filters-container :global(.dropdown.open .dropdown-arrow) {
          transform: rotate(180deg);
          color: #C4B5FD;
        }

        .filters-container :global(.dropdown-menu) {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          min-width: 200px;
          padding: 8px;
          background: linear-gradient(180deg, #1C1C22 0%, #18181B 100%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          box-shadow:
            0 20px 50px -12px rgba(0, 0, 0, 0.6),
            0 0 0 1px rgba(255, 255, 255, 0.05),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
          z-index: 100;
          animation: dropdown-enter 0.2s ease-out;
        }

        @keyframes dropdown-enter {
          from {
            opacity: 0;
            transform: translateY(-8px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .filters-container :global(.dropdown-item) {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 12px;
          background: transparent;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.75);
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
        }

        .filters-container :global(.dropdown-item:hover) {
          background: rgba(255, 255, 255, 0.06);
          color: #fff;
        }

        .filters-container :global(.dropdown-item.selected) {
          background: linear-gradient(135deg, rgba(167, 139, 250, 0.15) 0%, rgba(139, 92, 246, 0.08) 100%);
          color: #E9D5FF;
        }

        .filters-container :global(.item-icon) {
          font-size: 16px;
          width: 24px;
          text-align: center;
        }

        .filters-container :global(.item-dot) {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .filters-container :global(.item-label) {
          flex: 1;
        }

        .filters-container :global(.item-check) {
          color: #A78BFA;
          flex-shrink: 0;
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           PORTAL DROPDOWN (Floating on top)
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        :global(.portal-dropdown-menu) {
          padding: 8px;
          background: linear-gradient(180deg, #1C1C22 0%, #18181B 100%);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          box-shadow:
            0 20px 50px -12px rgba(0, 0, 0, 0.7),
            0 0 0 1px rgba(255, 255, 255, 0.05),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
          animation: portalDropdownEnter 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes portalDropdownEnter {
          from {
            opacity: 0;
            transform: translateY(-10px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        :global(.portal-dropdown-item) {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 11px 14px;
          background: transparent;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.75);
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
        }

        :global(.portal-dropdown-item:hover) {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }

        :global(.portal-dropdown-item.selected) {
          background: linear-gradient(135deg, rgba(167, 139, 250, 0.18) 0%, rgba(139, 92, 246, 0.1) 100%);
          color: #E9D5FF;
        }

        :global(.portal-dropdown-item .item-icon) {
          font-size: 16px;
          width: 24px;
          text-align: center;
        }

        :global(.portal-dropdown-item .item-dot) {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        :global(.portal-dropdown-item .item-label) {
          flex: 1;
        }

        :global(.portal-dropdown-item .item-check) {
          color: #A78BFA;
          flex-shrink: 0;
        }

        /* Results info */
        .results-info {
          padding: 0 16px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .results-count {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
          font-family: var(--font-mono);
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           MAIN & GRID
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .markets-main {
          padding: 16px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .markets-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           MARKET CARD
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .markets-grid :global(.market-card) {
          display: flex;
          flex-direction: column;
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          text-decoration: none;
          transition: all 0.2s;
        }

        .markets-grid :global(.market-card:hover) {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.1);
          transform: translateY(-2px);
        }

        .markets-grid :global(.card-header) {
          margin-bottom: 14px;
        }

        .markets-grid :global(.card-title) {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          line-height: 1.45;
          margin-bottom: 6px;
        }

        .markets-grid :global(.card-date) {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .markets-grid :global(.card-date.live) {
          color: #22C55E;
        }

        .markets-grid :global(.live-dot) {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #22C55E;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .markets-grid :global(.outcomes) {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 14px;
        }

        .markets-grid :global(.outcome-row) {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .markets-grid :global(.outcome-name) {
          flex: 1;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.8);
        }

        .markets-grid :global(.outcome-multiplier) {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.35);
          font-family: var(--font-mono);
          min-width: 44px;
          text-align: right;
        }

        .markets-grid :global(.outcome-pct) {
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          font-family: var(--font-mono);
          min-width: 52px;
          text-align: center;
        }

        .markets-grid :global(.outcome-pct.yes) {
          background: rgba(34, 197, 94, 0.12);
          color: #22C55E;
        }

        .markets-grid :global(.outcome-pct.no) {
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.6);
        }

        .markets-grid :global(.card-footer) {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .markets-grid :global(.volume) {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          font-family: var(--font-mono);
        }

        .markets-grid :global(.platform) {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.3);
          text-transform: capitalize;
          padding: 4px 8px;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 6px;
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           SKELETON
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .skeleton-card {
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
        }

        .skeleton-title {
          height: 16px;
          width: 85%;
          background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 6px;
          margin-bottom: 8px;
        }

        .skeleton-date {
          height: 12px;
          width: 35%;
          background: linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 100%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 4px;
          margin-bottom: 14px;
        }

        .skeleton-outcomes {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 14px;
        }

        .skeleton-outcome {
          height: 32px;
          background: linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 100%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 8px;
        }

        .skeleton-footer {
          height: 12px;
          width: 45%;
          background: linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 100%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 4px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           EMPTY STATE
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .empty-title {
          font-size: 16px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 4px;
        }

        .empty-hint {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.4);
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           RESPONSIVE
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        @media (max-width: 374px) {
          .page-title {
            font-size: 16px;
          }

          .back-btn {
            width: 36px;
            height: 36px;
            border-radius: 10px;
          }

          .search-container {
            margin: 0 12px 12px;
            padding: 12px 14px;
            border-radius: 12px;
          }

          .filters-container {
            padding: 0 12px 12px;
            gap: 8px;
          }

          .filters-container :global(.dropdown-trigger) {
            padding: 8px 12px;
            border-radius: 10px;
            font-size: 12px;
            gap: 6px;
          }

          .filters-container :global(.dropdown-label) {
            max-width: 75px;
          }

          .filters-container :global(.dropdown-menu) {
            min-width: 170px;
            border-radius: 14px;
            padding: 6px;
          }

          .filters-container :global(.dropdown-item) {
            padding: 9px 10px;
            font-size: 13px;
            border-radius: 8px;
          }

          .results-info {
            padding: 0 12px 12px;
          }

          .markets-main {
            padding: 12px;
          }

          .markets-grid {
            gap: 10px;
          }

          .markets-grid :global(.market-card) {
            padding: 14px;
            border-radius: 14px;
          }

          .markets-grid :global(.card-title) {
            font-size: 13px;
          }

          .markets-grid :global(.outcome-pct) {
            padding: 5px 10px;
            font-size: 12px;
            min-width: 48px;
          }
        }

        @media (min-width: 480px) {
          .markets-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .filters-container :global(.dropdown-label) {
            max-width: 130px;
          }
        }

        @media (min-width: 768px) {
          .header-top {
            padding: 16px 24px;
          }

          .search-container {
            margin: 0 24px 18px;
          }

          .filters-container {
            padding: 0 24px 16px;
            gap: 12px;
          }

          .filters-container :global(.dropdown-trigger) {
            padding: 11px 16px;
            border-radius: 14px;
          }

          .results-info {
            padding: 0 24px 16px;
          }

          .markets-main {
            padding: 20px 24px;
          }

          .markets-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }

          .markets-grid :global(.market-card) {
            padding: 18px;
          }

          .markets-grid :global(.card-title) {
            font-size: 15px;
          }
        }

        @media (min-width: 1024px) {
          .markets-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 18px;
          }

          .filters-container :global(.dropdown-label) {
            max-width: none;
          }
        }

        @media (min-width: 1280px) {
          .markets-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
          }

          .markets-grid :global(.market-card) {
            padding: 20px;
          }
        }
      `}</style>
    </div>
  );
}
