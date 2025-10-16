import dotenvFlow from 'dotenv-flow';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

// Load layered env for seeding
dotenvFlow.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed for simplified schema...');

  // Seed ADMIN user for local testing (always upsert row). Include password only for native mode.
  const email = 'admin@local.dev';
  const isNative = ((process.env.AUTH_MODE || '').trim().toLowerCase() || 'clerk') === 'native';
  const password = 'Admin@123';
  const passwordHash = isNative ? await bcrypt.hash(password, 10) : undefined;
  await prisma.user.upsert({
    where: { email },
    update: {
      role: 'ADMIN',
      ...(isNative ? { passwordHash } : {}),
    },
    create: {
      email,
      name: 'Admin',
      role: 'ADMIN',
      ...(isNative ? { passwordHash } : {}),
    },
  });
  console.log(`✅ Seeded ADMIN user ${email} (${isNative ? 'native' : 'clerk'} mode)`);

  // Seed Hero Banners (no duplicates on re-run)
  const heroSeeds = [
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
  ];
  let heroInserted = 0;
  for (const h of heroSeeds) {
    const exists = await prisma.heroBanner.findFirst({ where: { imageUrl: h.imageUrl } });
    if (!exists) {
      await prisma.heroBanner.create({ data: h });
      heroInserted++;
    }
  }
  console.log(`✅ Seeded Hero Banners (inserted: ${heroInserted})`);

  // Seed Special Offers (no duplicates on re-run)
  const specialSeeds = [
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
  ];
  let specialsInserted = 0;
  for (const s of specialSeeds) {
    const exists = await prisma.specialOffer.findFirst({ where: { imageUrl: s.imageUrl, productName: s.productName } });
    if (!exists) {
      await prisma.specialOffer.create({ data: s });
      specialsInserted++;
    }
  }
  console.log(`✅ Seeded Special Offers (inserted: ${specialsInserted})`);

  // Seed Laptop Offers (no duplicates on re-run)
  const laptopSeeds = [
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
  ];
  let laptopsInserted = 0;
  for (const l of laptopSeeds) {
    const exists = await prisma.laptopOffer.findFirst({ where: { imageUrl: l.imageUrl, productName: l.productName } });
    if (!exists) {
      await prisma.laptopOffer.create({ data: l });
      laptopsInserted++;
    }
  }
  console.log(`✅ Seeded Laptop Offers (inserted: ${laptopsInserted})`);

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