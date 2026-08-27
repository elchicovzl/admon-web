import { PrismaClient, UserRole, AdministradoraType } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { seedControlCatalogs } from './seeds/control'

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

  // Seed Administradoras (PILA codes)
  console.log('\n🏥 Seeding administradoras...')

  const administradoras = [
    // AFP
    { name: 'CAXDAC', code: '25-2', type: AdministradoraType.AFP },
    { name: 'COLFONDOS', code: '231001', type: AdministradoraType.AFP },
    { name: 'COLPENSIONES', code: '25-14', type: AdministradoraType.AFP },
    { name: 'FONPRECON', code: '25-3', type: AdministradoraType.AFP },
    { name: 'OLD MUTUAL', code: '230901', type: AdministradoraType.AFP },
    { name: 'OLD MUTUAL ALTERNATIVO', code: '230904', type: AdministradoraType.AFP },
    { name: 'PORVENIR', code: '230301', type: AdministradoraType.AFP },
    { name: 'PROTECCION', code: '230201', type: AdministradoraType.AFP },
    // ARL
    { name: 'COLMENA', code: '14-25', type: AdministradoraType.ARL },
    { name: 'COLPATRIA', code: '14-4', type: AdministradoraType.ARL },
    { name: 'LA EQUIDAD SEGUROS', code: '14-29', type: AdministradoraType.ARL },
    { name: 'LIBERTY SEGUROS', code: '14-18', type: AdministradoraType.ARL },
    { name: 'MAPFRE', code: '14-30', type: AdministradoraType.ARL },
    { name: 'POSITIVA', code: '14-23', type: AdministradoraType.ARL },
    { name: 'SEGUROS ALFA', code: '14-17', type: AdministradoraType.ARL },
    { name: 'SEGUROS AURORA', code: '14-8', type: AdministradoraType.ARL },
    { name: 'SEGUROS BOLIVAR', code: '14-7', type: AdministradoraType.ARL },
    { name: 'SURA', code: '14-11', type: AdministradoraType.ARL },
    // CCF
    { name: 'CAFABA', code: 'CCF38', type: AdministradoraType.CCF },
    { name: 'CAFAM', code: 'CCF21', type: AdministradoraType.CCF },
    { name: 'CAFAMAZ', code: 'CCF65', type: AdministradoraType.CCF },
    { name: 'CAFASUR', code: 'CCF46', type: AdministradoraType.CCF },
    { name: 'CAJACOPI', code: 'CCF05', type: AdministradoraType.CCF },
    { name: 'CAJAMAG', code: 'CCF33', type: AdministradoraType.CCF },
    { name: 'CAJASAI', code: 'CCF64', type: AdministradoraType.CCF },
    { name: 'CAJASAN CCF', code: 'CCF39', type: AdministradoraType.CCF },
    { name: 'CALDAS', code: 'CCF11', type: AdministradoraType.CCF },
    { name: 'CAMACOL', code: 'CCF02', type: AdministradoraType.CCF },
    { name: 'CARTAGENA', code: 'CCF09', type: AdministradoraType.CCF },
    { name: 'CHOCO', code: 'CCF29', type: AdministradoraType.CCF },
    { name: 'COFREM', code: 'CCF34', type: AdministradoraType.CCF },
    { name: 'COLSUBSIDIO', code: 'CCF22', type: AdministradoraType.CCF },
    { name: 'COMBAOY', code: 'CCF10', type: AdministradoraType.CCF },
    { name: 'COMBARRANQUILLA', code: 'CCF06', type: AdministradoraType.CCF },
    { name: 'COMCAJA', code: 'CCF68', type: AdministradoraType.CCF },
    { name: 'COMFACA', code: 'CCF13', type: AdministradoraType.CCF },
    { name: 'COMFACASANARE', code: 'CCF69', type: AdministradoraType.CCF },
    { name: 'COMFACAUCA', code: 'CCF14', type: AdministradoraType.CCF },
    { name: 'COMFACESAR', code: 'CCF15', type: AdministradoraType.CCF },
    { name: 'COMFACOR', code: 'CCF16', type: AdministradoraType.CCF },
    { name: 'COMFACUNDI', code: 'CCF26', type: AdministradoraType.CCF },
    { name: 'COMFAMA', code: 'CCF04', type: AdministradoraType.CCF },
    { name: 'COMFAMILIAR ATLANTICO', code: 'CCF07', type: AdministradoraType.CCF },
    { name: 'COMFAMILIAR HUILA', code: 'CCF32', type: AdministradoraType.CCF },
    { name: 'COMFAMILIAR PUTUMAYO', code: 'CCF63', type: AdministradoraType.CCF },
    { name: 'COMFAMILIAR RISARALDA', code: 'CCF44', type: AdministradoraType.CCF },
    { name: 'COMFANDI', code: 'CCF57', type: AdministradoraType.CCF },
    { name: 'COMFANORTE', code: 'CCF37', type: AdministradoraType.CCF },
    { name: 'COMFAORIENTE', code: 'CCF36', type: AdministradoraType.CCF },
    { name: 'COMFATOLIMA', code: 'CCF48', type: AdministradoraType.CCF },
    { name: 'COMFENALCO ANTIOQUIA', code: 'CCF03', type: AdministradoraType.CCF },
    { name: 'COMFENALCO CARTAGENA', code: 'CCF08', type: AdministradoraType.CCF },
    { name: 'COMFENALCO QUINDIO', code: 'CCF43', type: AdministradoraType.CCF },
    { name: 'COMFENALCO SANTANDER', code: 'CCF40', type: AdministradoraType.CCF },
    { name: 'COMFENALCO TOLIMA', code: 'CCF50', type: AdministradoraType.CCF },
    { name: 'COMFENALCO VALLE', code: 'CCF56', type: AdministradoraType.CCF },
    { name: 'COMFIAR', code: 'CCF67', type: AdministradoraType.CCF },
    { name: 'COMPENSAR', code: 'CCF24', type: AdministradoraType.CCF },
    { name: 'GUAJIRA', code: 'CCF30', type: AdministradoraType.CCF },
    { name: 'NARIÑO', code: 'CCF35', type: AdministradoraType.CCF },
    { name: 'SUCRE', code: 'CCF41', type: AdministradoraType.CCF },
    // EPS
    { name: 'AIC', code: 'EPSIC3', type: AdministradoraType.EPS },
    { name: 'ALIANSALUD', code: 'EPS001', type: AdministradoraType.EPS },
    { name: 'ASMETSALUD', code: 'ESSC62', type: AdministradoraType.EPS },
    { name: 'CAFESALUD', code: 'EPS003', type: AdministradoraType.EPS },
    { name: 'CAPITAL SALUD', code: 'EPSC34', type: AdministradoraType.EPS },
    { name: 'COLPATRIA', code: 'EPS015', type: AdministradoraType.EPS },
    { name: 'COMFAMILIAR HUILA', code: 'CCFC24', type: AdministradoraType.EPS },
    { name: 'COMFENALCO ANTIOQUIA', code: 'EPS009', type: AdministradoraType.EPS },
    { name: 'COMFENALCO VALLE', code: 'EPS012', type: AdministradoraType.EPS },
    { name: 'COMPARTA', code: 'ESSC33', type: AdministradoraType.EPS },
    { name: 'COMPENSAR', code: 'EPS008', type: AdministradoraType.EPS },
    { name: 'CONVIDA', code: 'EPSC22', type: AdministradoraType.EPS },
    { name: 'COOMEVA', code: 'EPS016', type: AdministradoraType.EPS },
    { name: 'COOSALUD', code: 'ESSC24', type: AdministradoraType.EPS },
    { name: 'CRUZ BLANCA', code: 'EPS023', type: AdministradoraType.EPS },
    { name: 'ECOOPSOS', code: 'ESSC91', type: AdministradoraType.EPS },
    { name: 'EMDISALUD', code: 'ESSC02', type: AdministradoraType.EPS },
    { name: 'EMSSANAR', code: 'ESSC18', type: AdministradoraType.EPS },
    { name: 'FAMISANAR', code: 'EPS017', type: AdministradoraType.EPS },
    { name: 'GOLDEN CROSS', code: 'EPS039', type: AdministradoraType.EPS },
    { name: 'HUMANA VIVIR', code: 'EPS014', type: AdministradoraType.EPS },
    { name: 'LA NUEVA EPS', code: 'EPS037', type: AdministradoraType.EPS },
    { name: 'MALLAMAS', code: 'EPSIC5', type: AdministradoraType.EPS },
    { name: 'MEDIMAS', code: 'EPS044', type: AdministradoraType.EPS },
    { name: 'MUTUAL SER', code: 'ESSC07', type: AdministradoraType.EPS },
    { name: 'PIJAOS SALUD', code: 'EPSIC6', type: AdministradoraType.EPS },
    { name: 'SALUD COLOMBIA', code: 'EPS034', type: AdministradoraType.EPS },
    { name: 'SALUD MIA', code: 'EPS047', type: AdministradoraType.EPS },
    { name: 'SALUD MIA (2)', code: 'EPS046', type: AdministradoraType.EPS },
    { name: 'SALUD TOTAL', code: 'EPS002', type: AdministradoraType.EPS },
    { name: 'SALUDCOOP', code: 'EPS013', type: AdministradoraType.EPS },
    { name: 'SALUDVIDA', code: 'EPS033', type: AdministradoraType.EPS },
    { name: 'SANITAS', code: 'EPS005', type: AdministradoraType.EPS },
    { name: 'SAVIA SALUD', code: 'EPS040', type: AdministradoraType.EPS },
    { name: 'SOS', code: 'EPS018', type: AdministradoraType.EPS },
    { name: 'SURA', code: 'EPS010', type: AdministradoraType.EPS },
  ]

  for (const adm of administradoras) {
    await prisma.administradora.upsert({
      where: { code_type: { code: adm.code, type: adm.type } },
      update: { name: adm.name },
      create: adm,
    })
  }

  console.log(`✅ Seeded ${administradoras.length} administradoras`)

  // Catálogos del módulo Control (bolsillos, categorías, tipos de servicio)
  await seedControlCatalogs(prisma, superAdmin.id)

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
