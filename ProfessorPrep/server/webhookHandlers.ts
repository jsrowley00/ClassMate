import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { stripeService } from './stripeService';
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string, uuid: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature, uuid);
    
    const stripe = await getUncachableStripeClient();
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      
      if (session.mode === 'payment' && session.payment_status === 'paid') {
        const customerId = session.customer as string;
        
        const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, customerId));
        
        if (user) {
          console.log(`Activating student access for user ${user.id} after payment`);
          await stripeService.activateStudentAccess(user.id, session.payment_intent as string);
        }
      }
    }
  }
}
