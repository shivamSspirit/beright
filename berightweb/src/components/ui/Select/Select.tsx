/**
 * Select - Custom dropdown select with search and animations
 *
 * Chainlift-inspired dropdown with smooth animations.
 *
 * @example Basic usage
 * <Select
 *   options={[
 *     { value: 'btc', label: 'Bitcoin' },
 *     { value: 'eth', label: 'Ethereum' },
 *   ]}
 *   value={selected}
 *   onChange={setSelected}
 * />
 *
 * @example With placeholder and search
 * <Select
 *   options={options}
 *   placeholder="Select a token..."
 *   searchable
 *   onChange={handleChange}
 * />
 */

'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { gsap } from 'gsap';
import styles from './Select.module.css';

export interface SelectOption {
  /** Unique value */
  value: string;
  /** Display label */
  label: string;
  /** Optional icon */
  icon?: ReactNode;
  /** Disable this option */
  disabled?: boolean;
}

export interface SelectProps {
  /** Available options */
  options: SelectOption[];
  /** Currently selected value */
  value?: string;
  /** Placeholder when no value selected */
  placeholder?: string;
  /** Enable search/filter */
  searchable?: boolean;
  /** Disable the select */
  disabled?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Full width */
  fullWidth?: boolean;
  /** Additional class name */
  className?: string;
  /** Change handler */
  onChange?: (value: string, option: SelectOption) => void;
  /** Label for accessibility */
  'aria-label'?: string;
}

export function Select({
  options,
  value,
  placeholder = 'Select...',
  searchable = false,
  disabled = false,
  size = 'md',
  fullWidth = false,
  className,
  onChange,
  'aria-label': ariaLabel,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = searchable && search
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  // Animate dropdown
  useEffect(() => {
    const dropdown = dropdownRef.current;
    if (!dropdown) return;

    if (isOpen) {
      gsap.fromTo(
        dropdown,
        { opacity: 0, y: -8, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.2, ease: 'power2.out' }
      );
      if (searchable) {
        searchInputRef.current?.focus();
      }
    }
  }, [isOpen, searchable]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlighted index when options change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredOptions.length]);

  const handleSelect = useCallback(
    (option: SelectOption) => {
      if (option.disabled) return;
      onChange?.(option.value, option);
      setIsOpen(false);
      setSearch('');
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (disabled) return;

      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (isOpen && filteredOptions[highlightedIndex]) {
            handleSelect(filteredOptions[highlightedIndex]);
          } else {
            setIsOpen(true);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          setSearch('');
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
          } else {
            setHighlightedIndex((prev) =>
              prev < filteredOptions.length - 1 ? prev + 1 : prev
            );
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
      }
    },
    [disabled, isOpen, filteredOptions, highlightedIndex, handleSelect]
  );

  const selectClasses = [
    styles.select,
    styles[size],
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
    isOpen && styles.open,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={containerRef}
      className={selectClasses}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger */}
      <button
        type="button"
        className={styles.trigger}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        {selectedOption ? (
          <span className={styles.value}>
            {selectedOption.icon && (
              <span className={styles.optionIcon}>{selectedOption.icon}</span>
            )}
            {selectedOption.label}
          </span>
        ) : (
          <span className={styles.placeholder}>{placeholder}</span>
        )}
        <ChevronDown className={styles.chevron} size={18} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div ref={dropdownRef} className={styles.dropdown} role="listbox">
          {/* Search */}
          {searchable && (
            <div className={styles.searchWrapper}>
              <Search size={16} className={styles.searchIcon} />
              <input
                ref={searchInputRef}
                type="text"
                className={styles.searchInput}
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}

          {/* Options */}
          <div className={styles.options}>
            {filteredOptions.length === 0 ? (
              <div className={styles.noResults}>No results found</div>
            ) : (
              filteredOptions.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  className={`
                    ${styles.option}
                    ${option.value === value ? styles.selected : ''}
                    ${option.disabled ? styles.optionDisabled : ''}
                    ${index === highlightedIndex ? styles.highlighted : ''}
                  `}
                  onClick={() => handleSelect(option)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  role="option"
                  aria-selected={option.value === value}
                  disabled={option.disabled}
                >
                  {option.icon && (
                    <span className={styles.optionIcon}>{option.icon}</span>
                  )}
                  <span className={styles.optionLabel}>{option.label}</span>
                  {option.value === value && (
                    <Check size={16} className={styles.checkIcon} />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Select;
