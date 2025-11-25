import { getUncachableStripeClient } from './stripeClient';

async function createProducts() {
  console.log('Creating ClassMate subscription product in Stripe...');
  
  const stripe = await getUncachableStripeClient();

  const existingProducts = await stripe.products.search({ 
    query: "name:'ClassMate Student Subscription'" 
  });
  
  if (existingProducts.data.length > 0) {
    console.log('ClassMate Student Subscription already exists');
    const product = existingProducts.data[0];
    
    const prices = await stripe.prices.list({ product: product.id, active: true });
    console.log('Existing product:', product.id);
    console.log('Existing prices:', prices.data.map(p => ({
      id: p.id,
      amount: p.unit_amount,
      interval: p.recurring?.interval
    })));
    return;
  }

  const product = await stripe.products.create({
    name: 'ClassMate Student Subscription',
    description: 'Full access to ClassMate AI-powered study tools including practice tests, flashcards, and personalized AI tutoring.',
    metadata: {
      type: 'student_subscription',
      features: 'practice_tests,flashcards,ai_tutor,self_study_rooms',
    },
  });

  console.log('Created product:', product.id);

  const monthlyPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 1200,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: {
      display_name: 'Monthly',
    },
  });

  console.log('Created monthly price:', monthlyPrice.id, '$12/month');

  console.log('\n--- Summary ---');
  console.log('Product ID:', product.id);
  console.log('Monthly Price ID:', monthlyPrice.id);
  console.log('\nStore these IDs in your environment or code for checkout sessions.');
}

createProducts()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error creating products:', error);
    process.exit(1);
  });
