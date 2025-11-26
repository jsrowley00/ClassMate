import { getUncachableStripeClient } from './stripeClient';

async function createStudentAccessProduct() {
  try {
    const stripe = await getUncachableStripeClient();
    
    const existingProducts = await stripe.products.search({ 
      query: "name:'ClassMate Student Access'" 
    });
    
    if (existingProducts.data.length > 0) {
      console.log('Product already exists:', existingProducts.data[0].id);
      const prices = await stripe.prices.list({ product: existingProducts.data[0].id });
      console.log('Existing prices:', prices.data.map(p => ({ id: p.id, amount: p.unit_amount })));
      return;
    }

    const product = await stripe.products.create({
      name: 'ClassMate Student Access',
      description: '4-month access to all ClassMate AI study tools including practice tests, flashcards, and AI tutoring.',
      metadata: {
        type: 'student_access',
        duration_months: '4',
      },
    });
    console.log('Created product:', product.id);

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: 4000,
      currency: 'usd',
      metadata: {
        type: 'one_time_student_access',
      },
    });
    console.log('Created price:', price.id, '($40.00)');

    console.log('\nSuccess! Product and price created.');
    console.log('Product ID:', product.id);
    console.log('Price ID:', price.id);
  } catch (error) {
    console.error('Error creating product:', error);
    process.exit(1);
  }
}

createStudentAccessProduct();
