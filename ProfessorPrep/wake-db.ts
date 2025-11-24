import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function wakeDatabase() {
  console.log('🔄 Attempting to wake up Neon database...\n');
  
  const maxAttempts = 10;
  const delayMs = 2000;
  
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      console.log(`Attempt ${i}/${maxAttempts}...`);
      
      // Try a simple query to wake the database
      const result = await db.execute(sql`SELECT 1 as ping`);
      
      console.log('✅ Database is AWAKE and responding!');
      console.log('Connection successful!\n');
      
      // Try to fetch table list to verify full access
      const tables = await db.execute(sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `);
      
      console.log('📊 Available tables:');
      if (tables.rows.length === 0) {
        console.log('  (No tables found - database is empty)');
      } else {
        tables.rows.forEach((row: any) => {
          console.log(`  - ${row.table_name}`);
        });
      }
      
      console.log('\n🎉 Database successfully woken up!');
      process.exit(0);
      
    } catch (error: any) {
      if (error.message?.includes('endpoint has been disabled')) {
        console.log(`  ⚠️  Endpoint still disabled, waiting ${delayMs/1000}s before retry...`);
      } else if (error.message?.includes('wake_compute')) {
        console.log(`  ⏳ Endpoint is waking up, waiting ${delayMs/1000}s...`);
      } else {
        console.log(`  ❌ Error: ${error.message}`);
      }
      
      if (i < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  console.log('\n❌ Failed to wake database after all attempts.');
  console.log('\nPlease try manually enabling it:');
  console.log('1. Visit: https://console.neon.tech/');
  console.log('2. Find your project (endpoint: ep-summer-surf-agtjb1x5)');
  console.log('3. Click the "Enable" or "Resume" button');
  
  process.exit(1);
}

wakeDatabase();
