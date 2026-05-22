import prisma from '../src/config/database.js';

const sql = `CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Prefer camelCase quoted column used by Prisma: "updatedAt"
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = TG_TABLE_NAME AND column_name = 'updatedAt'
  ) THEN
    NEW."updatedAt" = NOW();
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = TG_TABLE_NAME AND column_name = 'updated_at'
  ) THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;`;

async function run() {
  try {
    await prisma.$executeRawUnsafe(sql);
    console.log('Trigger function patched successfully');
  } catch (err) {
    console.error('Error patching trigger:', err.message || err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
