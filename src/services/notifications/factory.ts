import { NotificationType, PrincipalType } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { mapEventToNotificationTypes, titleForNotification, bodyForNotification, Recipient } from './mapping';

type Event = Parameters<typeof mapEventToNotificationTypes>[0];
type Booking = Parameters<typeof mapEventToNotificationTypes>[1];

export async function createNotificationsForEvent(params: { event: Event; booking: Booking }) {
  const { event, booking } = params;
  const mappings = mapEventToNotificationTypes(event, booking);

  const rowsToCreate: Array<{
    recipientType: PrincipalType;
    recipientId: string | null;
    type: NotificationType;
    title: string;
    body: string;
    bookingId: string | null;
    data?: Record<string, unknown>;
  }> = [];

  const pushRow = (recipient: Recipient, type: NotificationType) => {
    const recipientType = recipient === 'USER' ? PrincipalType.USER : PrincipalType.AGENT;
    const recipientId = recipient === 'USER' ? booking.userId : booking.agentId ?? null;
    if (recipientType === PrincipalType.AGENT && !recipientId) {
      // No assigned agent yet → skip per pitfall rule
      return;
    }
    rowsToCreate.push({
      recipientType,
      recipientId,
      type,
      title: titleForNotification(type),
      body: bodyForNotification(type),
      bookingId: booking.id ?? null,
      data: { eventId: event.id, kind: event.kind, toStatus: event.toStatus },
    });
  };

  for (const m of mappings) {
    for (const r of m.recipients) {
      pushRow(r, m.type);
    }
  }

  const created: string[] = [];
  for (const n of rowsToCreate) {
    const res = await prisma.notification.create({
      data: {
        recipientType: n.recipientType,
        recipientId: n.recipientId ?? null,
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.data as any,
        bookingId: n.bookingId ?? null,
      },
    });
    created.push(res.id);
  }

  return { count: created.length, ids: created };
}


