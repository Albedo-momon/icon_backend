import { BookingStatus, BookingType } from '@prisma/client';

/**
 * Booking status transition graph and helpers.
 *
 * Provides utilities to query allowed next statuses and validate transitions
 * for each booking type (ON_SITE vs IN_SHOP).
 *
 * Usage:
 *
 * ```ts
 * import { validateStatusChange, getAllowedNextStatuses } from '../utils/bookingStatusGraph';
 * 
 * // Example authorization of a transition
 * validateStatusChange({ bookingType: 'ON_SITE', currentStatus: 'AGENT_ACCEPTED', nextStatus: 'ETA_CONFIRMED' });
 * 
 * // Querying allowed next statuses for UI
 * const allowed = getAllowedNextStatuses('IN_SHOP', 'DIAGNOSIS_COMPLETED');
 * // allowed might include: ['REPAIR_IN_PROGRESS', 'BUILD_IN_PROGRESS', 'SCHEDULED_NEXT_VISIT', 'COMPLETED', 'CANCELLED_BY_USER', 'CANCELLED_BY_ADMIN', 'CANCELLED_BY_AGENT']
 * ```
 */

type Status = BookingStatus;
type Type = BookingType;

const TERMINALS: ReadonlySet<Status> = new Set<Status>([
  'COMPLETED',
  'CANCELLED_BY_USER',
  'CANCELLED_BY_ADMIN',
  'CANCELLED_BY_AGENT',
]);

const CANCELLATIONS: readonly Status[] = [
  'CANCELLED_BY_USER',
  'CANCELLED_BY_ADMIN',
  'CANCELLED_BY_AGENT',
];

// Core backbone shared by both types up until acceptance
const CORE_SHARED: Record<Status, Status[]> = {
  PENDING: ['SEARCHING', ...CANCELLATIONS],
  SEARCHING: ['SENT_TO_AGENT', ...CANCELLATIONS],
  SENT_TO_AGENT: ['WAITING_AGENT_APPROVAL', ...CANCELLATIONS],
  WAITING_AGENT_APPROVAL: ['AGENT_ACCEPTED', ...CANCELLATIONS],
  // diverges after AGENT_ACCEPTED depending on booking type
  AGENT_ACCEPTED: [],
  ETA_CONFIRMED: ['DIAGNOSIS_PENDING', ...CANCELLATIONS],
  DIAGNOSIS_PENDING: ['DIAGNOSIS_STARTED', ...CANCELLATIONS],
  DIAGNOSIS_STARTED: ['DIAGNOSIS_COMPLETED', ...CANCELLATIONS],
  DIAGNOSIS_COMPLETED: ['REPAIR_IN_PROGRESS', 'BUILD_IN_PROGRESS', 'SCHEDULED_NEXT_VISIT', 'COMPLETED', ...CANCELLATIONS],
  REPAIR_IN_PROGRESS: ['SCHEDULED_NEXT_VISIT', 'COMPLETED', ...CANCELLATIONS],
  BUILD_IN_PROGRESS: ['BUILD_DONE', ...CANCELLATIONS],
  BUILD_DONE: ['SOFTWARE_INSTALL_IN_PROGRESS', ...CANCELLATIONS],
  SOFTWARE_INSTALL_IN_PROGRESS: ['INSTALLATION_DONE', ...CANCELLATIONS],
  INSTALLATION_DONE: ['TESTING_QA', ...CANCELLATIONS],
  TESTING_QA: ['TESTING_DONE', ...CANCELLATIONS],
  TESTING_DONE: ['COMPLETED', ...CANCELLATIONS],
  SCHEDULED_NEXT_VISIT: ['REPAIR_IN_PROGRESS', 'DIAGNOSIS_STARTED', ...CANCELLATIONS],
  COMPLETED: [],
  CANCELLED_BY_USER: [],
  CANCELLED_BY_ADMIN: [],
  CANCELLED_BY_AGENT: [],
};

// ON_SITE graph: AGENT_ACCEPTED -> ETA_CONFIRMED (requires confirmation before diagnosis)
const GRAPH_ON_SITE: Record<Status, Status[]> = {
  ...CORE_SHARED,
  AGENT_ACCEPTED: ['ETA_CONFIRMED', ...CANCELLATIONS],
};

// IN_SHOP graph: AGENT_ACCEPTED -> DIAGNOSIS_PENDING (walk-in, no ETA phase)
const GRAPH_IN_SHOP: Record<Status, Status[]> = {
  ...CORE_SHARED,
  AGENT_ACCEPTED: ['DIAGNOSIS_PENDING', ...CANCELLATIONS],
  // IN_SHOP does not use ETA_CONFIRMED normally; keep its outgoing edges for completeness, but
  // it should rarely be present. If status is ETA_CONFIRMED for IN_SHOP, treat as shared.
};

const GRAPH: Record<Type, Record<Status, Status[]>> = {
  ON_SITE: GRAPH_ON_SITE,
  IN_SHOP: GRAPH_IN_SHOP,
};

export function isTerminal(status: Status): boolean {
  return TERMINALS.has(status);
}

export function getAllowedNextStatuses(type: Type, from: Status): Status[] {
  const table = GRAPH[type];
  const next = table[from] ?? [];
  return Array.from(next);
}

export function canTransition(type: Type, from: Status, to: Status): boolean {
  const allowed = getAllowedNextStatuses(type, from);
  return allowed.includes(to);
}

export function assertTransition(type: Type, from: Status, to: Status): void {
  if (!canTransition(type, from, to)) {
    const err: any = new Error(`Invalid status transition for ${type}: ${from} -> ${to}`);
    err.code = 'ERR_INVALID_TRANSITION';
    err.type = type;
    err.from = from;
    err.to = to;
    throw err;
  }
}

export function validateStatusChange(args: { bookingType: Type; currentStatus: Status; nextStatus: Status }): void {
  const { bookingType, currentStatus, nextStatus } = args;
  assertTransition(bookingType, currentStatus, nextStatus);
}

export type { Status as BookingStatusT, Type as BookingTypeT };