import { BookingStatus, EventKind, NotificationType } from '@prisma/client';
import { mapEventToNotificationTypes } from '../services/notifications/mapping';

function makeEvent(partial: Partial<any> = {}) {
  return {
    id: 'e1',
    bookingId: 'b1',
    fromStatus: null,
    toStatus: BookingStatus.PENDING,
    byUserId: null,
    byRole: 'SYSTEM',
    kind: EventKind.STATUS_CHANGED,
    note: null,
    createdAt: new Date(),
    ...partial,
  } as any;
}

function makeBooking(partial: Partial<any> = {}) {
  return {
    id: 'b1',
    userId: 'u1',
    agentId: 'a1',
    status: BookingStatus.PENDING,
    bookingType: 'ON_SITE',
    issueType: 'REPAIR',
    serviceDomain: 'COMPUTER',
    problemNote: 'x',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as any;
}

describe('mapEventToNotificationTypes', () => {
  it('maps ETA_CONFIRMED to USER and AGENT', () => {
    const event = makeEvent({ kind: EventKind.STATUS_CHANGED, toStatus: BookingStatus.ETA_CONFIRMED });
    const booking = makeBooking();
    const res = mapEventToNotificationTypes(event, booking);
    expect(res).toEqual([{ type: NotificationType.ETA_CONFIRMED, recipients: ['USER', 'AGENT'] }]);
  });

  it('maps OFFER_CREATED to AGENT only', () => {
    const event = makeEvent({ kind: EventKind.OFFER_CREATED });
    const booking = makeBooking({ agentId: null });
    const res = mapEventToNotificationTypes(event, booking);
    expect(res).toEqual([{ type: NotificationType.OFFER_SENT, recipients: ['AGENT'] }]);
  });

  it('maps OFFER_CHANGED ACCEPTED to USER and AGENT', () => {
    const event = makeEvent({ kind: EventKind.OFFER_CHANGED, toStatus: 'ACCEPTED' });
    const booking = makeBooking();
    const res = mapEventToNotificationTypes(event, booking);
    expect(res).toEqual([{ type: NotificationType.OFFER_ACCEPTED, recipients: ['USER', 'AGENT'] }]);
  });

  it('maps OFFER_CHANGED REJECTED to USER only', () => {
    const event = makeEvent({ kind: EventKind.OFFER_CHANGED, toStatus: 'REJECTED' });
    const booking = makeBooking();
    const res = mapEventToNotificationTypes(event, booking);
    expect(res).toEqual([{ type: NotificationType.OFFER_REJECTED, recipients: ['USER'] }]);
  });

  it('maps DIAGNOSIS/REPAIR/COMPLETED/CANCELLED', () => {
    const booking = makeBooking();
    const statuses = [
      [BookingStatus.DIAGNOSIS_STARTED, NotificationType.DIAGNOSIS_STARTED],
      [BookingStatus.DIAGNOSIS_COMPLETED, NotificationType.DIAGNOSIS_COMPLETED],
      [BookingStatus.REPAIR_IN_PROGRESS, NotificationType.REPAIR_IN_PROGRESS],
      [BookingStatus.COMPLETED, NotificationType.COMPLETED],
    ] as const;
    for (const [toStatus, nType] of statuses) {
      const event = makeEvent({ kind: EventKind.STATUS_CHANGED, toStatus });
      const res = mapEventToNotificationTypes(event, booking);
      expect(res).toEqual([{ type: nType, recipients: ['USER', 'AGENT'] }]);
    }
    const cancelStatuses = ['CANCELLED_BY_USER', 'CANCELLED_BY_ADMIN', 'CANCELLED_BY_AGENT'] as const;
    for (const toStatus of cancelStatuses) {
      const event = makeEvent({ kind: EventKind.STATUS_CHANGED, toStatus });
      const res = mapEventToNotificationTypes(event, booking);
      expect(res).toEqual([{ type: NotificationType.CANCELLED, recipients: ['USER', 'AGENT'] }]);
    }
  });
});
