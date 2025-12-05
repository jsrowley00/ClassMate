import { getUncachableStripeClient } from './stripeClient';
import { db } from './db';
import { users } from '@shared/schema';
import { eq, ilike } from 'drizzle-orm';

async function syncStripeData() {
  console.log('=== Syncing Stripe Data ===\n');
  
  const stripe = await getUncachableStripeClient();
  
  // Fetch all users from database first
  console.log('Fetching all users from database...');
  const allUsers = await db.select().from(users);
  console.log(`Found ${allUsers.length} users in database:\n`);
  for (const user of allUsers) {
    console.log(`  - ${user.email} (${user.firstName} ${user.lastName}) - ${user.role || 'no role'}`);
    console.log(`    Subscription: ${user.subscriptionStatus || 'none'}, Expires: ${user.subscriptionExpiresAt || 'n/a'}`);
  }
  
  // Fetch all successful payments from Stripe
  console.log('\n--- Fetching Stripe Payments ---');
  const charges = await stripe.charges.list({ limit: 100 });
  const successfulCharges = charges.data.filter(c => c.status === 'succeeded');
  console.log(`Found ${successfulCharges.length} successful charges in Stripe\n`);
  
  // Track which charges we've synced
  const syncedPayments: Array<{email: string; amount: number; date: Date; synced: boolean; userId?: string}> = [];
  
  for (const charge of successfulCharges) {
    const chargeEmail = charge.billing_details?.email || charge.receipt_email;
    const chargeDate = new Date(charge.created * 1000);
    const amount = charge.amount;
    
    console.log(`\nProcessing charge: $${(amount / 100).toFixed(2)} from ${chargeEmail} on ${chargeDate.toISOString()}`);
    
    if (!chargeEmail) {
      console.log('  -> No email found, skipping');
      syncedPayments.push({ email: 'unknown', amount, date: chargeDate, synced: false });
      continue;
    }
    
    // Try to find matching user by email
    const matchingUsers = await db.select().from(users).where(eq(users.email, chargeEmail));
    
    if (matchingUsers.length > 0) {
      const user = matchingUsers[0];
      console.log(`  -> Matched to user: ${user.firstName} ${user.lastName} (${user.id})`);
      
      // Determine duration based on amount
      let durationMonths = 4; // $40 = 4 months
      if (amount >= 9000) {
        durationMonths = 12; // $90 = 12 months annual
      }
      
      const expiresAt = new Date(chargeDate);
      expiresAt.setMonth(expiresAt.getMonth() + durationMonths);
      
      // Check if this is a newer payment than existing
      if (!user.subscriptionExpiresAt || expiresAt > user.subscriptionExpiresAt) {
        // Update user subscription
        await db.update(users)
          .set({
            stripeCustomerId: charge.customer as string || null,
            stripePaymentId: charge.payment_intent as string || null,
            subscriptionStatus: 'active',
            subscriptionExpiresAt: expiresAt,
          })
          .where(eq(users.id, user.id));
        
        console.log(`  -> Updated subscription: active until ${expiresAt.toISOString()}`);
        syncedPayments.push({ email: chargeEmail, amount, date: chargeDate, synced: true, userId: user.id });
      } else {
        console.log(`  -> Existing subscription is newer, skipping`);
        syncedPayments.push({ email: chargeEmail, amount, date: chargeDate, synced: false, userId: user.id });
      }
    } else {
      console.log(`  -> No matching user found for email: ${chargeEmail}`);
      syncedPayments.push({ email: chargeEmail, amount, date: chargeDate, synced: false });
    }
  }
  
  // Summary
  console.log('\n\n=== SYNC SUMMARY ===');
  console.log(`Total charges processed: ${syncedPayments.length}`);
  console.log(`Successfully synced: ${syncedPayments.filter(p => p.synced).length}`);
  console.log(`Not synced (no matching user): ${syncedPayments.filter(p => !p.synced && !p.userId).length}`);
  
  console.log('\nPayments without matching users:');
  for (const payment of syncedPayments.filter(p => !p.synced && !p.userId)) {
    console.log(`  - ${payment.email}: $${(payment.amount / 100).toFixed(2)} on ${payment.date.toISOString()}`);
  }
  
  // Check final user states
  console.log('\n--- Final User Subscription States ---');
  const updatedUsers = await db.select().from(users);
  for (const user of updatedUsers) {
    const status = user.subscriptionStatus || 'none';
    const expires = user.subscriptionExpiresAt ? user.subscriptionExpiresAt.toISOString() : 'n/a';
    console.log(`${user.email}: ${status} (expires: ${expires})`);
  }
  
  console.log('\n=== Sync Complete ===');
}

syncStripeData().catch(console.error);
