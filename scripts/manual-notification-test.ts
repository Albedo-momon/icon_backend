import { PrismaClient, BookingStatus, EventKind, EventActorRole } from '@prisma/client';
import { mapEventToNotificationTypes } from '../src/services/notifications/mapping';
import { createNotificationsForEvent } from '../src/services/notifications/factory';

const prisma = new PrismaClient();

async function manualTest() {
  console.log('🔍 Manual notification test - checking mapping logic...\n');

  // Test the mapping function directly
  const mockEvent = {
    id: 'test-event-1',
    bookingId: 'test-booking-1',
    fromStatus: null,
    toStatus: BookingStatus.ETA_CONFIRMED,
    byUserId: null,
    byRole: EventActorRole.SYSTEM,
    kind: EventKind.STATUS_CHANGED,
    note: 'Test ETA confirmation',
    createdAt: new Date(),
  };

  const mockBooking = {
    id: 'test-booking-1',
    userId: 'user-123',
    agentId: 'agent-456',
    status: BookingStatus.ETA_CONFIRMED,
    bookingType: 'ON_SITE' as const,
    issueType: 'REPAIR' as const,
    serviceDomain: 'COMPUTER' as const,
    problemNote: 'Test problem',
    scheduledFor: null,
    expectedCompletionDate: null,
    etaMinutes: null,
    addressLine1: null,
    city: null,
    pincode: null,
    contactPhone: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  console.log('📋 Testing mapping function:');
  console.log('Event:', mockEvent.kind, '→', mockEvent.toStatus);
  console.log('Booking has agent:', !!mockBooking.agentId);

  const mappings = mapEventToNotificationTypes(mockEvent, mockBooking);
  console.log('Mappings result:', mappings);

  // Test different event types
  const testCases = [
    { kind: EventKind.OFFER_CREATED, toStatus: BookingStatus.PENDING },
    { kind: EventKind.OFFER_CHANGED, toStatus: 'ACCEPTED' as any },
    { kind: EventKind.OFFER_CHANGED, toStatus: 'REJECTED' as any },
    { kind: EventKind.STATUS_CHANGED, toStatus: BookingStatus.DIAGNOSIS_STARTED },
    { kind: EventKind.STATUS_CHANGED, toStatus: BookingStatus.COMPLETED },
    { kind: EventKind.NOTE_ADDED, toStatus: BookingStatus.PENDING },
  ];

  console.log('\n📊 Testing all event mappings:');
  testCases.forEach((testCase, i) => {
    const event = { ...mockEvent, kind: testCase.kind, toStatus: testCase.toStatus };
    const mappings = mapEventToNotificationTypes(event, mockBooking);
    console.log(`${i + 1}. ${testCase.kind} → ${testCase.toStatus || 'N/A'}`);
    console.log(`   Mappings: ${mappings.length} notification(s)`);
    mappings.forEach(m => console.log(`   - ${m.type} → [${m.recipients.join(', ')}]`));
    console.log('');
  });

  // Test with no agent
  console.log('🚫 Testing with no agent assigned:');
  const bookingNoAgent = { ...mockBooking, agentId: null };
  const mappingsNoAgent = mapEventToNotificationTypes(mockEvent, bookingNoAgent);
  console.log('Mappings (no agent):', mappingsNoAgent);

  console.log('\n✅ Manual test completed!');
  console.log('\n💡 To test with real database:');
  console.log('   npm run test:notifications');
  console.log('   or');
  console.log('   npx ts-node scripts/test-notifications.ts');
}

manualTest().catch(console.error);
