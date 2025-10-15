import dotenvFlow from 'dotenv-flow';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

// Load layered env for seeding
dotenvFlow.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed for simplified schema...');

  // Seed ADMIN user for native mode only
  if ((process.env.AUTH_MODE || 'clerk') === 'native') {
    const email = 'admin@local.dev';
    const password = 'Admin@123';
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.upsert({
      where: { email },
      update: { passwordHash, role: 'ADMIN' },
      create: {
        email,
        name: 'Admin',
        role: 'ADMIN',
        passwordHash,
      },
    });
    console.log('✅ Seeded ADMIN user admin@local.dev (native mode)');
  } else {
    console.log('ℹ️ Skipped admin seed (AUTH_MODE is clerk)');
  }

  // Seed Hero Banners
  await prisma.heroBanner.createMany({
    data: [
      {
        imageUrl: 'https://via.placeholder.com/1200x400/0066cc/ffffff?text=Welcome+to+Icon+Computers',
        title: 'Welcome to Icon Computers',
        subtitle: 'Trusted tech partner',
        ctaText: 'Explore Services',
        ctaLink: '/services',
        sortOrder: 1,
        status: 'ACTIVE',
      },
      {
        imageUrl: 'https://via.placeholder.com/1200x400/ff6600/ffffff?text=Limited+Time+Offer',
        title: 'Limited Time Offer',
        subtitle: 'Save big on laptops',
        ctaText: 'Shop Laptops',
        ctaLink: '/laptops',
        sortOrder: 2,
        status: 'ACTIVE',
      },
    ],
  });
  console.log('✅ Seeded Hero Banners');

  // Seed Special Offers
  await prisma.specialOffer.createMany({
    data: [
      {
        imageUrl: 'https://via.placeholder.com/400x300/00cc66/ffffff?text=Free+Diagnosis',
        productName: 'Free Computer Diagnosis',
        priceCents: 0,
        discountedCents: 0,
        discountPercent: 100,
        sortOrder: 1,
        status: 'ACTIVE',
      },
      {
        imageUrl: 'https://via.placeholder.com/400x300/0066cc/ffffff?text=Service+Discount',
        productName: 'Laptop Service Discount',
        priceCents: 299900,
        discountedCents: 199900,
        discountPercent: 33,
        sortOrder: 2,
        status: 'ACTIVE',
      },
    ],
  });
  console.log('✅ Seeded Special Offers');

  // Seed Laptop Offers
  await prisma.laptopOffer.createMany({
    data: [
      {
        imageUrl: 'https://via.placeholder.com/400x300/333333/ffffff?text=Gaming+Laptop',
        productName: 'Gaming Laptop - RTX 4060',
        priceCents: 8999900,
        discountedCents: 7999900,
        discountPercent: 11,
        sortOrder: 1,
        status: 'ACTIVE',
      },
      {
        imageUrl: 'https://via.placeholder.com/400x300/666666/ffffff?text=Business+Laptop',
        productName: 'Business Laptop - Intel i7',
        priceCents: 5999900,
        discountedCents: 5499900,
        discountPercent: 8,
        sortOrder: 2,
        status: 'ACTIVE',
      },
    ],
  });
  console.log('✅ Seeded Laptop Offers');

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });