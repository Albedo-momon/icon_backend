import { BookingStatus, BookingType } from '@prisma/client';
import { getAllowedNextStatuses, canTransition, assertTransition, validateStatusChange, isTerminal } from '../utils/bookingStatusGraph';

describe('bookingStatusGraph', () => {
  describe('terminals', () => {
    const terminals: BookingStatus[] = ['COMPLETED', 'CANCELLED_BY_USER', 'CANCELLED_BY_ADMIN', 'CANCELLED_BY_AGENT'];
    test('terminal detection', () => {
      for (const t of terminals) {
        expect(isTerminal(t)).toBe(true);
        expect(getAllowedNextStatuses('ON_SITE', t)).toEqual([]);
        expect(getAllowedNextStatuses('IN_SHOP', t)).toEqual([]);
      }
    });
  });

  describe('core backbone', () => {
    test('PENDING -> SEARCHING allowed', () => {
      expect(canTransition('ON_SITE', 'PENDING', 'SEARCHING')).toBe(true);
      expect(canTransition('IN_SHOP', 'PENDING', 'SEARCHING')).toBe(true);
    });

    test('SEARCHING -> SENT_TO_AGENT allowed', () => {
      expect(canTransition('ON_SITE', 'SEARCHING', 'SENT_TO_AGENT')).toBe(true);
      expect(canTransition('IN_SHOP', 'SEARCHING', 'SENT_TO_AGENT')).toBe(true);
    });

    test('WAITING_AGENT_APPROVAL -> AGENT_ACCEPTED allowed', () => {
      expect(canTransition('ON_SITE', 'WAITING_AGENT_APPROVAL', 'AGENT_ACCEPTED')).toBe(true);
      expect(canTransition('IN_SHOP', 'WAITING_AGENT_APPROVAL', 'AGENT_ACCEPTED')).toBe(true);
    });
  });

  describe('divergence by type', () => {
    test('ON_SITE requires ETA_CONFIRMED before diagnosis', () => {
      expect(canTransition('ON_SITE', 'AGENT_ACCEPTED', 'ETA_CONFIRMED')).toBe(true);
      expect(canTransition('ON_SITE', 'AGENT_ACCEPTED', 'DIAGNOSIS_PENDING')).toBe(false);
      expect(getAllowedNextStatuses('ON_SITE', 'AGENT_ACCEPTED')).toContain('ETA_CONFIRMED');
    });

    test('IN_SHOP skips ETA and goes to DIAGNOSIS_PENDING', () => {
      expect(canTransition('IN_SHOP', 'AGENT_ACCEPTED', 'DIAGNOSIS_PENDING')).toBe(true);
      expect(canTransition('IN_SHOP', 'AGENT_ACCEPTED', 'ETA_CONFIRMED')).toBe(false);
      expect(getAllowedNextStatuses('IN_SHOP', 'AGENT_ACCEPTED')).toContain('DIAGNOSIS_PENDING');
    });
  });

  describe('cancellations', () => {
    const cancels: BookingStatus[] = ['CANCELLED_BY_USER', 'CANCELLED_BY_ADMIN', 'CANCELLED_BY_AGENT'];

    test('cancellations allowed from non-terminals', () => {
      for (const c of cancels) {
        expect(canTransition('ON_SITE', 'PENDING', c)).toBe(true);
        expect(canTransition('IN_SHOP', 'DIAGNOSIS_STARTED', c)).toBe(true);
      }
    });

    test('cancellations not allowed from terminals', () => {
      for (const c of cancels) {
        expect(canTransition('ON_SITE', 'COMPLETED', c)).toBe(false);
        expect(canTransition('IN_SHOP', 'CANCELLED_BY_USER', c)).toBe(false);
      }
    });
  });

  describe('advanced phases', () => {
    test('repair path', () => {
      expect(canTransition('ON_SITE', 'DIAGNOSIS_COMPLETED', 'REPAIR_IN_PROGRESS')).toBe(true);
      expect(canTransition('ON_SITE', 'REPAIR_IN_PROGRESS', 'COMPLETED')).toBe(true);
    });

    test('build path', () => {
      expect(canTransition('IN_SHOP', 'DIAGNOSIS_COMPLETED', 'BUILD_IN_PROGRESS')).toBe(true);
      expect(canTransition('IN_SHOP', 'BUILD_IN_PROGRESS', 'BUILD_DONE')).toBe(true);
      expect(canTransition('IN_SHOP', 'BUILD_DONE', 'SOFTWARE_INSTALL_IN_PROGRESS')).toBe(true);
      expect(canTransition('IN_SHOP', 'SOFTWARE_INSTALL_IN_PROGRESS', 'INSTALLATION_DONE')).toBe(true);
      expect(canTransition('IN_SHOP', 'INSTALLATION_DONE', 'TESTING_QA')).toBe(true);
      expect(canTransition('IN_SHOP', 'TESTING_QA', 'TESTING_DONE')).toBe(true);
      expect(canTransition('IN_SHOP', 'TESTING_DONE', 'COMPLETED')).toBe(true);
    });
  });

  describe('scheduled next visit', () => {
    test('can return to active work', () => {
      expect(canTransition('ON_SITE', 'SCHEDULED_NEXT_VISIT', 'REPAIR_IN_PROGRESS')).toBe(true);
      expect(canTransition('ON_SITE', 'SCHEDULED_NEXT_VISIT', 'DIAGNOSIS_STARTED')).toBe(true);
    });
  });

  describe('invalid edges', () => {
    test('PENDING -> AGENT_ACCEPTED throws', () => {
      expect(() => assertTransition('ON_SITE', 'PENDING', 'AGENT_ACCEPTED')).toThrow(/Invalid status transition/);
      try {
        assertTransition('ON_SITE', 'PENDING', 'AGENT_ACCEPTED');
      } catch (e: any) {
        expect(e.code).toBe('ERR_INVALID_TRANSITION');
        expect(e.type).toBe('ON_SITE');
        expect(e.from).toBe('PENDING');
        expect(e.to).toBe('AGENT_ACCEPTED');
      }
    });

    test('IN_SHOP does not allow ETA_CONFIRMED from AGENT_ACCEPTED', () => {
      expect(() => validateStatusChange({ bookingType: 'IN_SHOP', currentStatus: 'AGENT_ACCEPTED', nextStatus: 'ETA_CONFIRMED' })).toThrow();
    });
  });
});