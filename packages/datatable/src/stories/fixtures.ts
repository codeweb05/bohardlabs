/**
 * Shared fixture for the stories. Deliberately small and boring: the stories are about
 * the table's behaviour, and invented data that is interesting in itself makes them
 * harder to read, not easier.
 */

export interface Order {
  readonly id: string;
  readonly reference: string;
  readonly customer: string;
  readonly status: 'pending' | 'in_progress' | 'delivered' | 'cancelled';
  readonly items: number;
  readonly total: number;
  readonly placedAt: string;
  readonly note: string;
  readonly [key: string]: unknown;
}

const CUSTOMERS = [
  'Amara Okafor',
  'Ben Lindqvist',
  'Chidi Nwosu',
  'Dana Whitfield',
  'Elif Demir',
  'Farhan Qureshi',
  'Greta Nowak',
  'Hana Kobayashi',
  'Ivan Petrov',
  'Julia Ferreira',
];

const STATUSES = ['pending', 'in_progress', 'delivered', 'cancelled'] as const;

/**
 * Deterministic, so a story renders the same rows on every reload and an interaction
 * assertion can name a specific cell.
 */
export function makeOrders(count: number): Order[] {
  return Array.from({length: count}, (_, index) => {
    const day = (index % 28) + 1;
    return {
      id: `order-${index + 1}`,
      reference: `SW-${String(1000 + index)}`,
      customer: CUSTOMERS[index % CUSTOMERS.length] ?? 'Unknown',
      status: STATUSES[index % STATUSES.length] ?? 'pending',
      items: (index % 7) + 1,
      total: Math.round((index * 13.75 + 9.5) * 100) / 100,
      placedAt: `2026-03-${String(day).padStart(2, '0')}`,
      note: index % 3 === 0 ? 'Left with the concierge, buzzer 4B, do not ring after 9pm' : '',
    };
  });
}

export const ORDERS: Order[] = makeOrders(12);

export const STATUS_OPTIONS = [
  {label: 'Pending', value: 'pending'},
  {label: 'In progress', value: 'in_progress'},
  {label: 'Delivered', value: 'delivered'},
  {label: 'Cancelled', value: 'cancelled'},
];
