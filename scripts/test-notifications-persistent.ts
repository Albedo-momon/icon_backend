import { PrismaClient, BookingStatus, EventKind, EventActorRole } from '@prisma/client';
import { createNotificationsForEvent } from '../src/services/notifications/factory';

const prisma = new PrismaClient();

async function testNotificationsPersistent() {
  console.log('🧪 Testing notification mapping and factory (PERSISTENT)...\n');

  try {
    // Create test data
    const user = await prisma.user.create({
      data: {
        email: 'test-user-persistent@example.com',
        name: 'Test User Persistent',
        role: 'USER',
      },
    });

    const agentUser = await prisma.user.create({
      data: {
        email: 'test-agent-persistent@example.com',
        name: 'Test Agent Persistent',
        role: 'AGENT',
      },
    });

    const agent = await prisma.agent.create({
      data: {
        userId: agentUser.id,
        accountStatus: 'ACTIVE',
        onboardingStatus: 'COMPLETED',
        operationalStatus: 'FREE',
        sortOrder: 1,
      },
    });

    const booking = await prisma.booking.create({
      data: {
        bookingType: 'ON_SITE',
        issueType: 'REPAIR',
        serviceDomain: 'COMPUTER',
        status: BookingStatus.PENDING,
        problemNote: 'Test repair needed - PERSISTENT',
        userId: user.id,
        agentId: agent.id,
      },
    });

    console.log('✅ Created test booking:', booking.id);

    // Test 1: ETA_CONFIRMED event
    const etaEvent = await prisma.bookingEvent.create({
      data: {
        bookingId: booking.id,
        toStatus: BookingStatus.ETA_CONFIRMED,
        byRole: EventActorRole.SYSTEM,
        kind: EventKind.STATUS_CHANGED,
        note: 'ETA confirmed by system',
      },
    });

    console.log('📅 Created ETA_CONFIRMED event:', etaEvent.id);

    const etaResult = await createNotificationsForEvent({
      event: etaEvent,
      booking: booking,
    });

    console.log('📬 ETA notifications created:', etaResult.count, 'IDs:', etaResult.ids);

    // Test 2: OFFER_CREATED event (should only notify agent)
    const offerEvent = await prisma.bookingEvent.create({
      data: {
        bookingId: booking.id,
        toStatus: BookingStatus.SENT_TO_AGENT,
        byRole: EventActorRole.SYSTEM,
        kind: EventKind.OFFER_CREATED,
        note: 'Offer sent to agent',
      },
    });

    console.log('📨 Created OFFER_CREATED event:', offerEvent.id);

    const offerResult = await createNotificationsForEvent({
      event: offerEvent,
      booking: booking,
    });

    console.log('📬 Offer notifications created:', offerResult.count, 'IDs:', offerResult.ids);

    // Test 3: Test with no agent assigned
    const bookingNoAgent = await prisma.booking.create({
      data: {
        bookingType: 'IN_SHOP',
        issueType: 'REPAIR',
        serviceDomain: 'LAPTOP',
        status: BookingStatus.PENDING,
        problemNote: 'Test repair without agent - PERSISTENT',
        userId: user.id,
        agentId: null, // No agent assigned
      },
    });

    const noAgentEvent = await prisma.bookingEvent.create({
      data: {
        bookingId: bookingNoAgent.id,
        toStatus: BookingStatus.ETA_CONFIRMED,
        byRole: EventActorRole.SYSTEM,
        kind: EventKind.STATUS_CHANGED,
        note: 'ETA confirmed but no agent',
      },
    });

    const noAgentResult = await createNotificationsForEvent({
      event: noAgentEvent,
      booking: bookingNoAgent,
    });

    console.log('📬 No-agent notifications created:', noAgentResult.count, 'IDs:', noAgentResult.ids);

    // Verify notifications in database
    const allNotifications = await prisma.notification.findMany({
      where: {
        bookingId: {
          in: [booking.id, bookingNoAgent.id],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log('\n📋 All created notifications:');
    allNotifications.forEach((n, i) => {
      console.log(`${i + 1}. ${n.type} → ${n.recipientType} (${n.recipientId})`);
      console.log(`   Title: ${n.title}`);
      console.log(`   Body: ${n.body}`);
      console.log(`   Status: ${n.deliveryStatus}`);
      console.log('');
    });

    console.log('✅ Notification mapping and factory test completed successfully!');
    console.log('\n💡 Data is PERSISTENT - check your database!');
    console.log('   Run: npx ts-node scripts/check-notifications.ts');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testNotificationsPersistent();
