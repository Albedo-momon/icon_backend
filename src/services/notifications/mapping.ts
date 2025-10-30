import { Booking, BookingEvent, BookingStatus, EventKind, NotificationType } from '@prisma/client';

export type Recipient = 'USER' | 'AGENT';

export interface NotificationMapping {
  type: NotificationType;
  recipients: Recipient[];
}

// Pure mapping from event + booking to NotificationType and recipients
export function mapEventToNotificationTypes(event: BookingEvent, booking: Booking): NotificationMapping[] {
  const mappings: NotificationMapping[] = [];

  switch (event.kind) {
    case EventKind.OFFER_CREATED: {
      // Notify the offered agent (handled by factory via booking.agentId if present).
      mappings.push({ type: NotificationType.OFFER_SENT, recipients: ['AGENT'] });
      break;
    }

    case EventKind.OFFER_CHANGED: {
      if (event.toStatus === ("ACCEPTED" as unknown as BookingStatus)) {
        mappings.push({ type: NotificationType.OFFER_ACCEPTED, recipients: ['USER', 'AGENT'] });
      } else if (event.toStatus === ("REJECTED" as unknown as BookingStatus)) {
        // Keep customers informed that assignment is still pending
        mappings.push({ type: NotificationType.OFFER_REJECTED, recipients: ['USER'] });
      } else if (event.toStatus === ("TIMEOUT" as unknown as BookingStatus)) {
        mappings.push({ type: NotificationType.OFFER_TIMEOUT, recipients: ['USER'] });
      }
      break;
    }

    case EventKind.STATUS_CHANGED: {
      if (event.toStatus === BookingStatus.ETA_CONFIRMED) {
        mappings.push({ type: NotificationType.ETA_CONFIRMED, recipients: ['USER', 'AGENT'] });
      } else if (event.toStatus === BookingStatus.DIAGNOSIS_STARTED) {
        mappings.push({ type: NotificationType.DIAGNOSIS_STARTED, recipients: ['USER', 'AGENT'] });
      } else if (event.toStatus === BookingStatus.DIAGNOSIS_COMPLETED) {
        mappings.push({ type: NotificationType.DIAGNOSIS_COMPLETED, recipients: ['USER', 'AGENT'] });
      } else if (event.toStatus === BookingStatus.REPAIR_IN_PROGRESS) {
        mappings.push({ type: NotificationType.REPAIR_IN_PROGRESS, recipients: ['USER', 'AGENT'] });
      } else if (event.toStatus === BookingStatus.COMPLETED) {
        mappings.push({ type: NotificationType.COMPLETED, recipients: ['USER', 'AGENT'] });
      } else if (
        event.toStatus === BookingStatus.CANCELLED_BY_USER ||
        event.toStatus === BookingStatus.CANCELLED_BY_ADMIN ||
        event.toStatus === BookingStatus.CANCELLED_BY_AGENT
      ) {
        mappings.push({ type: NotificationType.CANCELLED, recipients: ['USER', 'AGENT'] });
      }
      break;
    }

    case EventKind.NOTE_ADDED: {
      mappings.push({ type: NotificationType.NOTE_ADDED, recipients: ['USER', 'AGENT'] });
      break;
    }

    default:
      break;
  }

  return mappings;
}

export function titleForNotification(type: NotificationType): string {
  switch (type) {
    case NotificationType.OFFER_SENT:
      return 'New job offer';
    case NotificationType.OFFER_ACCEPTED:
      return 'Offer accepted';
    case NotificationType.OFFER_REJECTED:
      return 'Offer declined';
    case NotificationType.OFFER_TIMEOUT:
      return 'Offer timed out';
    case NotificationType.ETA_CONFIRMED:
      return 'ETA confirmed';
    case NotificationType.DIAGNOSIS_STARTED:
      return 'Diagnosis started';
    case NotificationType.DIAGNOSIS_COMPLETED:
      return 'Diagnosis completed';
    case NotificationType.REPAIR_IN_PROGRESS:
      return 'Repair in progress';
    case NotificationType.BUILD_PHASE_CHANGED:
      return 'Build phase updated';
    case NotificationType.COMPLETED:
      return 'Job completed';
    case NotificationType.CANCELLED:
      return 'Job cancelled';
    case NotificationType.NOTE_ADDED:
      return 'New note added';
    case NotificationType.BOOKING_CREATED:
      return 'Booking created';
    default:
      return 'Update';
  }
}

export function bodyForNotification(type: NotificationType): string {
  switch (type) {
    case NotificationType.OFFER_SENT:
      return 'You have a new job offer.';
    case NotificationType.OFFER_ACCEPTED:
      return 'An offer was accepted for your booking.';
    case NotificationType.OFFER_REJECTED:
      return 'An offer was declined; we are searching again.';
    case NotificationType.OFFER_TIMEOUT:
      return 'An offer expired without response; we are searching again.';
    case NotificationType.ETA_CONFIRMED:
      return 'Appointment time has been confirmed.';
    case NotificationType.DIAGNOSIS_STARTED:
      return 'Diagnosis has started.';
    case NotificationType.DIAGNOSIS_COMPLETED:
      return 'Diagnosis has completed.';
    case NotificationType.REPAIR_IN_PROGRESS:
      return 'Repair is now in progress.';
    case NotificationType.BUILD_PHASE_CHANGED:
      return 'Build phase has been updated.';
    case NotificationType.COMPLETED:
      return 'Work is completed. Please review.';
    case NotificationType.CANCELLED:
      return 'The job was cancelled.';
    case NotificationType.NOTE_ADDED:
      return 'A new note was added to your booking.';
    case NotificationType.BOOKING_CREATED:
      return 'Your booking has been created.';
    default:
      return '';
  }
}


