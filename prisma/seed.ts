import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create Super Admin user
  const hashedPassword = await bcrypt.hash('admin123', 10)

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@admon.com' },
    update: {},
    create: {
      email: 'admin@admon.com',
      name: 'Super Admin',
      password: hashedPassword,
      role: UserRole.SUPER_ADMIN,
    },
  })

  console.log('✅ Created Super Admin:', superAdmin.email)

  // Create a test manager
  const hashedManagerPassword = await bcrypt.hash('manager123', 10)

  const manager = await prisma.user.upsert({
    where: { email: 'manager@admon.com' },
    update: {},
    create: {
      email: 'manager@admon.com',
      name: 'Test Manager',
      password: hashedManagerPassword,
      role: UserRole.MANAGER,
      createdById: superAdmin.id,
    },
  })

  console.log('✅ Created Test Manager:', manager.email)

  console.log('\n🎉 Seeding completed!')
  console.log('\n📝 Test credentials:')
  console.log('Super Admin:')
  console.log('  Email: admin@admon.com')
  console.log('  Password: admin123')
  console.log('\nManager:')
  console.log('  Email: manager@admon.com')
  console.log('  Password: manager123')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
