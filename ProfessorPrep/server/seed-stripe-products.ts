import { getUncachableStripeClient } from './stripeClient';

async function createProducts() {
  console.log('Creating ClassMate student access product in Stripe...');
  
  const stripe = await getUncachableStripeClient();

  const existingProducts = await stripe.products.search({ 
    query: "name:'ClassMate Student Access'" 
  });
  
  if (existingProducts.data.length > 0) {
    console.log('ClassMate Student Access already exists');
    const product = existingProducts.data[0];
    
    const prices = await stripe.prices.list({ product: product.id, active: true });
    console.log('Existing product:', product.id);
    console.log('Existing prices:', prices.data.map(p => ({
      id: p.id,
      amount: p.unit_amount,
      type: p.type
    })));
    return;
  }

  const product = await stripe.products.create({
    name: 'ClassMate Student Access',
    description: '4 months of full access to ClassMate AI-powered study tools including practice tests, flashcards, personalized AI tutoring, and access to any class added during your access period.',
    metadata: {
      type: 'student_access',
      duration_months: '4',
      features: 'practice_tests,flashcards,ai_tutor,self_study_rooms,all_classes',
    },
  });

  console.log('Created product:', product.id);

  const oneTimePrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 4000,
    currency: 'usd',
    metadata: {
      display_name: '4-Month Access',
      duration_months: '4',
    },
  });

  console.log('Created one-time price:', oneTimePrice.id, '$40 for 4 months');

  console.log('\n--- Summary ---');
  console.log('Product ID:', product.id);
  console.log('One-Time Price ID:', oneTimePrice.id);
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
