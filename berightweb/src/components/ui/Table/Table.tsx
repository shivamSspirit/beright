/**
 * Table - Data table component with sorting and responsive design
 *
 * Chainlift-inspired clean table with subtle hover states.
 *
 * @example Basic usage
 * <Table
 *   columns={[
 *     { key: 'name', header: 'Name' },
 *     { key: 'value', header: 'Value' },
 *   ]}
 *   data={[{ name: 'Item 1', value: 100 }]}
 *   keyField="name"
 * />
 *
 * @example With custom rendering
 * <Table
 *   columns={[
 *     { key: 'platform', header: 'Platform', render: (row) => <Badge>{row.platform}</Badge> },
 *     { key: 'fee', header: 'Fee', align: 'right' },
 *   ]}
 *   data={platforms}
 *   keyField="id"
 * />
 */

'use client';

import { type ReactNode } from 'react';
import styles from './Table.module.css';

export interface TableColumn<T> {
  /** Unique key for the column */
  key: keyof T | string;
  /** Header text */
  header: string;
  /** Column width (CSS value) */
  width?: string;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Custom render function */
  render?: (row: T, index: number) => ReactNode;
  /** Hide on mobile */
  hideOnMobile?: boolean;
}

export interface TableProps<T> {
  /** Column definitions */
  columns: TableColumn<T>[];
  /** Data rows */
  data: T[];
  /** Unique key field for rows */
  keyField: keyof T;
  /** Show striped rows */
  striped?: boolean;
  /** Compact size */
  compact?: boolean;
  /** Show hover effect on rows */
  hoverable?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Loading state */
  loading?: boolean;
  /** Additional class name */
  className?: string;
  /** Row click handler */
  onRowClick?: (row: T, index: number) => void;
}

export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  keyField,
  striped = false,
  compact = false,
  hoverable = true,
  emptyMessage = 'No data available',
  loading = false,
  className,
  onRowClick,
}: TableProps<T>) {
  const tableClasses = [
    styles.tableWrapper,
    compact && styles.compact,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const getCellValue = (row: T, column: TableColumn<T>, index: number): ReactNode => {
    if (column.render) {
      return column.render(row, index);
    }
    const value = row[column.key as keyof T];
    if (value === null || value === undefined) return '—';
    return String(value);
  };

  if (loading) {
    return (
      <div className={tableClasses}>
        <div className={styles.loading}>
          <div className={styles.loadingSpinner} />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={tableClasses}>
      <table className={styles.table}>
        <thead className={styles.thead}>
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className={`${styles.th} ${column.hideOnMobile ? styles.hideOnMobile : ''}`}
                style={{
                  width: column.width,
                  textAlign: column.align || 'left',
                }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={styles.tbody}>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={styles.empty}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr
                key={String(row[keyField])}
                className={`
                  ${styles.tr}
                  ${striped && index % 2 === 1 ? styles.striped : ''}
                  ${hoverable ? styles.hoverable : ''}
                  ${onRowClick ? styles.clickable : ''}
                `}
                onClick={() => onRowClick?.(row, index)}
              >
                {columns.map((column) => (
                  <td
                    key={String(column.key)}
                    className={`${styles.td} ${column.hideOnMobile ? styles.hideOnMobile : ''}`}
                    style={{ textAlign: column.align || 'left' }}
                  >
                    {getCellValue(row, column, index)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
