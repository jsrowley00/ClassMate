import { getStripeClient } from './stripeClient';
import { stripeService } from './stripeService';
import { db } from './db';
import { users, courseEnrollments, courseInvitations } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { storage } from './storage';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required');
    }
    
    const stripe = await getStripeClient();
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret
    );

    console.log(`Processing Stripe webhook event: ${event.type}`);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      
      if (session.mode === 'payment' && session.payment_status === 'paid') {
        const customerId = session.customer as string;
        
        const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, customerId));
        
        if (user) {
          console.log(`Activating student access for user ${user.id} after payment`);
          
          const durationMonths = await stripeService.getDurationFromSession(session.id);
          
          await stripeService.activateStudentAccess(user.id, session.payment_intent as string, durationMonths);
          
          if (user.email) {
            try {
              await db
                .update(courseEnrollments)
                .set({ status: "enrolled" })
                .where(
                  and(
                    eq(courseEnrollments.studentId, user.id),
                    eq(courseEnrollments.status, "pending")
                  )
                );
              console.log(`Updated pending enrollments to enrolled for user ${user.id}`);
              
              await storage.processPendingInvitations(user.id, user.email);
              console.log(`Processed pending invitations for user ${user.id}`);
            } catch (error) {
              console.error(`Error processing pending enrollments/invitations for user ${user.id}:`, error);
            }
          }
        }
      }
    }
  }
}
