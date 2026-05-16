/**
 * Accordion - Expandable content panels with GSAP animation
 *
 * Smooth height animations using GSAP for premium feel.
 *
 * @example Basic usage
 * <Accordion
 *   items={[
 *     { id: '1', title: 'Question 1', content: 'Answer 1' },
 *     { id: '2', title: 'Question 2', content: <CustomComponent /> },
 *   ]}
 * />
 *
 * @example Allow multiple open
 * <Accordion items={items} allowMultiple />
 *
 * @example Default open
 * <Accordion items={items} defaultOpen={['1', '2']} />
 */

'use client';

import { useState, useRef, useCallback, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { ChevronDown } from 'lucide-react';
import styles from './Accordion.module.css';

export interface AccordionItem {
  /** Unique identifier */
  id: string;
  /** Title/trigger text */
  title: string;
  /** Content to show when expanded */
  content: ReactNode;
  /** Optional icon */
  icon?: ReactNode;
  /** Disable this item */
  disabled?: boolean;
}

export interface AccordionProps {
  /** Accordion items */
  items: AccordionItem[];
  /** Allow multiple panels open at once */
  allowMultiple?: boolean;
  /** Initially open panel IDs */
  defaultOpen?: string[];
  /** Variant style */
  variant?: 'default' | 'bordered' | 'separated';
  /** Additional class name */
  className?: string;
  /** Callback when item is toggled */
  onToggle?: (id: string, isOpen: boolean) => void;
}

export function Accordion({
  items,
  allowMultiple = false,
  defaultOpen = [],
  variant = 'default',
  className,
  onToggle,
}: AccordionProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(defaultOpen));
  const contentRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const toggle = useCallback((id: string) => {
    const content = contentRefs.current.get(id);
    if (!content) return;

    const isOpen = openIds.has(id);

    if (isOpen) {
      // Close animation
      gsap.to(content, {
        height: 0,
        opacity: 0,
        duration: 0.3,
        ease: 'power2.inOut',
        onComplete: () => {
          setOpenIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          onToggle?.(id, false);
        },
      });
    } else {
      // If not allowMultiple, close others first
      if (!allowMultiple && openIds.size > 0) {
        openIds.forEach((openId) => {
          const otherContent = contentRefs.current.get(openId);
          if (otherContent) {
            gsap.to(otherContent, {
              height: 0,
              opacity: 0,
              duration: 0.3,
              ease: 'power2.inOut',
            });
          }
        });
        setOpenIds(new Set([id]));
      } else {
        setOpenIds((prev) => new Set([...prev, id]));
      }

      // Open animation - first set to auto to get natural height
      gsap.set(content, { height: 'auto', opacity: 1 });
      const autoHeight = content.offsetHeight;
      gsap.set(content, { height: 0, opacity: 0 });

      gsap.to(content, {
        height: autoHeight,
        opacity: 1,
        duration: 0.4,
        ease: 'power2.out',
        onComplete: () => {
          gsap.set(content, { height: 'auto' });
        },
      });

      onToggle?.(id, true);
    }
  }, [openIds, allowMultiple, onToggle]);

  const accordionClasses = [
    styles.accordion,
    styles[variant],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={accordionClasses}>
      {items.map((item) => {
        const isOpen = openIds.has(item.id);

        return (
          <div
            key={item.id}
            className={`${styles.item} ${isOpen ? styles.open : ''} ${item.disabled ? styles.disabled : ''}`}
          >
            <button
              type="button"
              className={styles.trigger}
              onClick={() => !item.disabled && toggle(item.id)}
              aria-expanded={isOpen}
              aria-controls={`accordion-content-${item.id}`}
              disabled={item.disabled}
            >
              {item.icon && <span className={styles.icon}>{item.icon}</span>}
              <span className={styles.title}>{item.title}</span>
              <ChevronDown className={styles.chevron} size={20} />
            </button>

            <div
              id={`accordion-content-${item.id}`}
              ref={(el) => {
                if (el) contentRefs.current.set(item.id, el);
              }}
              className={styles.content}
              style={{
                height: defaultOpen.includes(item.id) ? 'auto' : 0,
                opacity: defaultOpen.includes(item.id) ? 1 : 0,
              }}
            >
              <div className={styles.contentInner}>{item.content}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default Accordion;
