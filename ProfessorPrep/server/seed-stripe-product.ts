import { getUncachableStripeClient } from './stripeClient';

async function createStudentAccessProducts() {
  try {
    const stripe = await getUncachableStripeClient();
    
    // Create 4-month product
    const existing4Month = await stripe.products.search({ 
      query: "name:'ClassMate Student Access - 4 Month'" 
    });
    
    if (existing4Month.data.length === 0) {
      const product4 = await stripe.products.create({
        name: 'ClassMate Student Access - 4 Month',
        description: '4-month access to all ClassMate AI study tools including practice tests, flashcards, and AI tutoring.',
        metadata: {
          type: 'student_access',
          duration_months: '4',
        },
      });
      console.log('Created 4-month product:', product4.id);

      const price4 = await stripe.prices.create({
        product: product4.id,
        unit_amount: 4000,
        currency: 'usd',
        metadata: {
          type: 'one_time_student_access',
          duration_months: '4',
        },
      });
      console.log('Created 4-month price:', price4.id, '($40.00)');
    } else {
      console.log('4-month product already exists:', existing4Month.data[0].id);
    }

    // Create 12-month product
    const existing12Month = await stripe.products.search({ 
      query: "name:'ClassMate Student Access - 12 Month'" 
    });
    
    if (existing12Month.data.length === 0) {
      const product12 = await stripe.products.create({
        name: 'ClassMate Student Access - 12 Month',
        description: '12-month access to all ClassMate AI study tools including practice tests, flashcards, and AI tutoring. Best value!',
        metadata: {
          type: 'student_access',
          duration_months: '12',
        },
      });
      console.log('Created 12-month product:', product12.id);

      const price12 = await stripe.prices.create({
        product: product12.id,
        unit_amount: 9000,
        currency: 'usd',
        metadata: {
          type: 'one_time_student_access',
          duration_months: '12',
        },
      });
      console.log('Created 12-month price:', price12.id, '($90.00)');
    } else {
      console.log('12-month product already exists:', existing12Month.data[0].id);
    }

    console.log('\nSuccess! Products created or verified.');
  } catch (error) {
    console.error('Error creating products:', error);
    process.exit(1);
  }
}

createStudentAccessProducts();
