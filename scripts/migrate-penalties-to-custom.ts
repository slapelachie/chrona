import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';

const prisma = new PrismaClient();

async function migratePenaltiesToCustom() {
  console.log('🔄 Starting migration of hardcoded penalties to custom penalty time frames...');

  try {
    // Get all existing pay guides
    const payGuides = await prisma.payGuide.findMany({
      select: {
        id: true,
        name: true,
      }
    });

    console.log(`📋 Found ${payGuides.length} pay guides to migrate`);

    console.log('ℹ️  Migration script is no longer needed - penalty data has already been migrated.');
    console.log('ℹ️  Custom penalty time frames are now the only penalty system in use.');

    console.log('✅ Migration completed successfully!');
    console.log('ℹ️  Note: Public holiday penalties will need to be handled through custom logic or manual application');

  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  migratePenaltiesToCustom()
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { migratePenaltiesToCustom };