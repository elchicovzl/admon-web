import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migratePendingSupport() {
  try {
    console.log('🔍 Verificando sub-procesos con PENDING_SUPPORT...')

    // Check current count
    const count = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM "affiliation_subprocesses"
      WHERE status = 'PENDING_SUPPORT'
    `
    console.log('Sub-procesos encontrados con PENDING_SUPPORT:', count)

    console.log('\n📝 Migrando datos de PENDING_SUPPORT a NOT_STARTED...')

    // Migrate sub-processes
    const subProcessResult = await prisma.$executeRaw`
      UPDATE "affiliation_subprocesses"
      SET status = 'NOT_STARTED'
      WHERE status = 'PENDING_SUPPORT'
    `
    console.log(`✅ ${subProcessResult} sub-procesos migrados`)

    // Migrate status logs (fromStatus)
    const fromStatusResult = await prisma.$executeRaw`
      UPDATE "affiliation_status_logs"
      SET "fromStatus" = 'NOT_STARTED'
      WHERE "fromStatus" = 'PENDING_SUPPORT'
    `
    console.log(`✅ ${fromStatusResult} logs migrados (fromStatus)`)

    // Migrate status logs (toStatus)
    const toStatusResult = await prisma.$executeRaw`
      UPDATE "affiliation_status_logs"
      SET "toStatus" = 'NOT_STARTED'
      WHERE "toStatus" = 'PENDING_SUPPORT'
    `
    console.log(`✅ ${toStatusResult} logs migrados (toStatus)`)

    console.log('\n✨ Migración completada exitosamente!')
  } catch (error) {
    console.error('❌ Error durante la migración:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

migratePendingSupport()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
