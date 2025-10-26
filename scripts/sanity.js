"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('--- Sanity checks starting ---');
    // Get admin seeded user
    const admin = await prisma.user.findUnique({ where: { email: 'admin@local.dev' } });
    if (!admin)
        throw new Error('Admin user not found (seed should have created it).');
    console.log('Admin user id:', admin.id);
    // Upsert a customer user
    const customerEmail = 'user1@example.com';
    const customer = await prisma.user.upsert({
        where: { email: customerEmail },
        update: {},
        create: { email: customerEmail, name: 'User One', role: 'USER' },
    });
    console.log('Customer user id:', customer.id);
    // Upsert an agent user and create Agent profile
    const agentEmail = 'agent1@example.com';
    const agentUser = await prisma.user.upsert({
        where: { email: agentEmail },
        update: {},
        create: { email: agentEmail, name: 'Agent One', role: 'AGENT' },
    });
    const agent = await prisma.agent.upsert({
        where: { userId: agentUser.id },
        update: {},
        create: { userId: agentUser.id },
    });
    console.log('Agent id:', agent.id, 'Agent userId:', agentUser.id);
    // Create a booking for the customer
    const booking = await prisma.booking.create({
        data: {
            bookingType: 'ON_SITE',
            issueType: 'REPAIR',
            serviceDomain: 'COMPUTER',
            status: 'PENDING',
            problemNote: 'Test booking from sanity script',
            userId: customer.id,
        },
    });
    console.log('Booking id:', booking.id);
    // Create an assignment offer to the agent
    const offer = await prisma.assignmentOffer.create({
        data: {
            bookingId: booking.id,
            agentId: agent.id,
            status: 'SENT',
            expiresAt: new Date(Date.now() + 60 * 60 * 1000), // +1h
        },
    });
    console.log('AssignmentOffer id:', offer.id);
    // Notifications: one for USER and one for AGENT
    const nUser = await prisma.notification.create({
        data: {
            recipientType: 'USER',
            recipientId: customer.id,
            type: 'OFFER_ACCEPTED',
            title: 'Offer accepted',
            body: 'Your offer was accepted by an agent',
            bookingId: booking.id,
        },
    });
    const nAgent = await prisma.notification.create({
        data: {
            recipientType: 'AGENT',
            recipientId: agent.id,
            type: 'ETA_CONFIRMED',
            title: 'ETA confirmed',
            body: 'Customer confirmed appointment time',
            bookingId: booking.id,
        },
    });
    console.log('Notifications created:', nUser.id, nAgent.id);
    // DeviceToken for ADMIN
    const deviceToken = await prisma.deviceToken.upsert({
        where: { token: 'admin-web-token-1' },
        update: {},
        create: {
            principalType: 'ADMIN',
            principalId: admin.id,
            platform: 'WEB',
            token: 'admin-web-token-1',
        },
    });
    console.log('DeviceToken id:', deviceToken.id);
    // Query via composite indexes
    const forUser = await prisma.notification.findMany({
        where: { recipientType: 'USER', recipientId: customer.id },
        orderBy: { createdAt: 'desc' },
    });
    const forAgent = await prisma.notification.findMany({
        where: { recipientType: 'AGENT', recipientId: agent.id },
        orderBy: { createdAt: 'desc' },
    });
    console.log('Notifications count (USER):', forUser.length);
    console.log('Notifications count (AGENT):', forAgent.length);
    const offersForBooking = await prisma.assignmentOffer.findMany({
        where: { bookingId: booking.id, status: 'SENT' },
    });
    console.log('AssignmentOffer count (bookingId, status=SENT):', offersForBooking.length);
    console.log('--- Sanity checks completed ---');
}
main()
    .catch((e) => {
    console.error(e);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
