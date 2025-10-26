import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: 'admin@local.dev' } });
  const len = admin?.passwordHash ? admin.passwordHash.length : 0;
  console.log('admin.passwordHash length:', len);
  console.log('admin.passwordHash sample:', admin?.passwordHash ? admin.passwordHash.slice(0, 15) + '...' : null);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });