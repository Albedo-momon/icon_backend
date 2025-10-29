import { BookingStatus, EventKind } from '@prisma/client';
import { createNotificationsForEvent } from '../services/notifications/factory';

jest.mock('../db/prisma', () => {
  return {
    prisma: {
      notification: {
        create: jest.fn().mockResolvedValue({ id: Math.random().toString(36).slice(2) }),
      },
    },
  };
});

const { prisma } = require('../db/prisma');

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

describe('createNotificationsForEvent', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates two rows for ETA_CONFIRMED (USER and AGENT)', async () => {
    const event = makeEvent({ kind: EventKind.STATUS_CHANGED, toStatus: BookingStatus.ETA_CONFIRMED });
    const booking = makeBooking();
    const res = await createNotificationsForEvent({ event, booking });
    expect(res.count).toBe(2);
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
  });

  it('skips AGENT when no agent assigned', async () => {
    const event = makeEvent({ kind: EventKind.STATUS_CHANGED, toStatus: BookingStatus.ETA_CONFIRMED });
    const booking = makeBooking({ agentId: null });
    const res = await createNotificationsForEvent({ event, booking });
    expect(res.count).toBe(1);
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    const call = (prisma.notification.create as jest.Mock).mock.calls[0][0];
    expect(call.data.recipientType).toBe('USER');
  });

  it('handles OFFER_CREATED mapping with no agent by creating 0 rows', async () => {
    const event = makeEvent({ kind: EventKind.OFFER_CREATED });
    const booking = makeBooking({ agentId: null });
    const res = await createNotificationsForEvent({ event, booking });
    expect(res.count).toBe(0);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});
