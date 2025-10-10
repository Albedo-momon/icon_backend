import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create Shop
  const shop = await prisma.shop.create({
    data: {
      name: 'Icon Computers',
      addressText: '123 Tech Street, Digital City',
      pincode: '560001',
      phone: '+91-9876543210'
    }
  });
  console.log('✅ Created shop:', shop.name);

  // Create Users
  const adminUser = await prisma.user.create({
    data: {
      role: 'admin',
      name: 'Admin User',
      email: 'admin@iconcomputers.com',
      phone: '+91-9876543211',
      passwordHash: '$2a$10$placeholder.hash.replace.later' // TODO: replace with actual hash
    }
  });

  const regularUser = await prisma.user.create({
    data: {
      role: 'user',
      name: 'John Customer',
      email: 'john@example.com',
      phone: '+91-9876543212',
      passwordHash: '$2a$10$placeholder.hash.replace.later' // TODO: replace with actual hash
    }
  });

  const agentUser = await prisma.user.create({
    data: {
      role: 'agent',
      name: 'Tech Agent',
      email: 'agent@iconcomputers.com',
      phone: '+91-9876543213',
      passwordHash: '$2a$10$placeholder.hash.replace.later' // TODO: replace with actual hash
    }
  });
  console.log('✅ Created users: admin, customer, agent');

  // Create Agent
  const agent = await prisma.agent.create({
    data: {
      userId: agentUser.id,
      shopId: shop.id,
      status: 'active',
      concurrentCapacity: 3,
      skills: {
        hardware: true,
        software: true,
        network: false
      }
    }
  });
  console.log('✅ Created agent linked to shop');

  // Create Banners
  await prisma.banner.createMany({
    data: [
      {
        shopId: shop.id,
        title: 'Welcome to Icon Computers',
        subtitle: 'Your trusted tech partner',
        imageUrl: 'https://via.placeholder.com/800x400/0066cc/ffffff?text=Welcome+Banner',
        targetType: 'page',
        targetUrl: '/services',
        isActive: true,
        sortOrder: 1,
        validFrom: new Date('2024-01-01'),
        validTo: new Date('2024-12-31')
      },
      {
        shopId: shop.id,
        title: 'Special Offer - 20% Off',
        subtitle: 'On all laptop repairs this month',
        imageUrl: 'https://via.placeholder.com/800x400/ff6600/ffffff?text=Special+Offer',
        targetType: 'offer',
        targetUrl: '/offers/laptop-repair',
        isActive: true,
        sortOrder: 2,
        validFrom: new Date(),
        validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      }
    ]
  });
  console.log('✅ Created 2 banners');

  // Create Offers
  await prisma.offer.createMany({
    data: [
      {
        shopId: shop.id,
        title: 'Laptop Repair Special',
        shortDesc: '20% off on all laptop repairs',
        imageUrl: 'https://via.placeholder.com/400x300/0066cc/ffffff?text=Laptop+Repair',
        badgeText: '20% OFF',
        isActive: true,
        sortOrder: 1,
        validFrom: new Date(),
        validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      },
      {
        shopId: shop.id,
        title: 'Free Diagnosis',
        shortDesc: 'Free computer diagnosis with any repair',
        imageUrl: 'https://via.placeholder.com/400x300/00cc66/ffffff?text=Free+Diagnosis',
        badgeText: 'FREE',
        isActive: true,
        sortOrder: 2,
        validFrom: new Date(),
        validTo: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
      }
    ]
  });
  console.log('✅ Created 2 offers');

  // Create Products
  await prisma.product.createMany({
    data: [
      {
        shopId: shop.id,
        name: 'Gaming Laptop - RTX 4060',
        sku: 'LAPTOP-RTX4060',
        imageUrl: 'https://via.placeholder.com/400x300/333333/ffffff?text=Gaming+Laptop',
        mrpCents: 8999900, // ₹89,999
        saleCents: 7999900, // ₹79,999
        shortDesc: 'High-performance gaming laptop with RTX 4060',
        isActive: true,
        inStock: true,
        sortOrder: 1,
        tags: ['gaming', 'laptop', 'rtx', 'high-performance']
      },
      {
        shopId: shop.id,
        name: 'Business Laptop - Intel i7',
        sku: 'LAPTOP-I7-BUS',
        imageUrl: 'https://via.placeholder.com/400x300/666666/ffffff?text=Business+Laptop',
        mrpCents: 5999900, // ₹59,999
        saleCents: 5499900, // ₹54,999
        shortDesc: 'Professional laptop for business use',
        isActive: true,
        inStock: true,
        sortOrder: 2,
        tags: ['business', 'laptop', 'intel', 'professional']
      },
      {
        shopId: shop.id,
        name: 'Wireless Mouse',
        sku: 'MOUSE-WIRELESS',
        imageUrl: 'https://via.placeholder.com/400x300/0099cc/ffffff?text=Wireless+Mouse',
        mrpCents: 149900, // ₹1,499
        saleCents: 99900, // ₹999
        shortDesc: 'Ergonomic wireless mouse with long battery life',
        isActive: true,
        inStock: true,
        sortOrder: 3,
        tags: ['mouse', 'wireless', 'ergonomic', 'accessories']
      },
      {
        shopId: shop.id,
        name: 'Mechanical Keyboard',
        sku: 'KB-MECHANICAL',
        imageUrl: 'https://via.placeholder.com/400x300/cc6600/ffffff?text=Mechanical+Keyboard',
        mrpCents: 399900, // ₹3,999
        saleCents: 349900, // ₹3,499
        shortDesc: 'RGB mechanical keyboard for gaming and typing',
        isActive: true,
        inStock: true,
        sortOrder: 4,
        tags: ['keyboard', 'mechanical', 'rgb', 'gaming']
      }
    ]
  });
  console.log('✅ Created 4 products');

  // Create SectionsConfig
  await prisma.sectionsConfig.create({
    data: {
      shopId: shop.id,
      showBanners: true,
      showOffers: true,
      showProducts: true,
      productsLimit: 8,
      offersLimit: 6
    }
  });
  console.log('✅ Created sections config');

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