import { getPrisma } from './client';
import { hashPassword } from '../../utils/password';

async function main(): Promise<void> {
  const prisma = getPrisma();
  const demoEmail = 'demo@example.com';

  const existingUser = await prisma.user.findUnique({
    where: { email: demoEmail },
  });

  if (!existingUser) {
    await prisma.user.create({
      data: {
        email: demoEmail,
        password: await hashPassword('Demo@123456'),
        name: 'Demo User',
      },
    });
    console.log('Demo user created:', demoEmail);
  } else {
    console.log('Demo user already exists');
  }
}

main()
  .catch((error) => {
    console.error('Seed error:', error);
    process.exit(1);
  })
  .finally(() => {
    void getPrisma().$disconnect();
  });
