import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkNotifications() {
  console.log('🔍 Checking notifications in database...\n');

  try {
    // Count all notifications
    const totalCount = await prisma.notification.count();
    console.log(`📊 Total notifications in database: ${totalCount}`);

    if (totalCount > 0) {
      // Get recent notifications
      const recentNotifications = await prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      console.log('\n📋 Recent notifications:');
      recentNotifications.forEach((n, i) => {
        console.log(`${i + 1}. ID: ${n.id}`);
        console.log(`   Type: ${n.type}`);
        console.log(`   Recipient: ${n.recipientType} (${n.recipientId})`);
        console.log(`   Title: ${n.title}`);
        console.log(`   Status: ${n.deliveryStatus}`);
        console.log(`   Booking ID: ${n.bookingId}`);
        console.log(`   Created: ${n.createdAt.toISOString()}`);
        console.log('');
      });

      // Check by recipient type
      const userNotifications = await prisma.notification.count({
        where: { recipientType: 'USER' },
      });
      const agentNotifications = await prisma.notification.count({
        where: { recipientType: 'AGENT' },
      });

      console.log(`👤 User notifications: ${userNotifications}`);
      console.log(`👨‍💼 Agent notifications: ${agentNotifications}`);

      // Check by status
      const pendingNotifications = await prisma.notification.count({
        where: { deliveryStatus: 'PENDING' },
      });
      const sentNotifications = await prisma.notification.count({
        where: { deliveryStatus: 'SENT' },
      });

      console.log(`⏳ Pending notifications: ${pendingNotifications}`);
      console.log(`✅ Sent notifications: ${sentNotifications}`);
    } else {
      console.log('❌ No notifications found in database');
      console.log('\n💡 Try running: npm run test:notifications:integration');
    }

  } catch (error) {
    console.error('❌ Error checking notifications:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkNotifications();
