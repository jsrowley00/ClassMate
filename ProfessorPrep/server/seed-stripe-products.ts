import { getUncachableStripeClient } from './stripeClient';

export async function ensureStripeProductsExist() {
  console.log('Checking/creating ClassMate student access products in Stripe...');
  
  const stripe = await getUncachableStripeClient();

  const existingProducts = await stripe.products.search({ 
    query: "name:'ClassMate Student Access'" 
  });
  
  let product;
  
  if (existingProducts.data.length > 0) {
    product = existingProducts.data[0];
    console.log('ClassMate Student Access product already exists:', product.id);
  } else {
    product = await stripe.products.create({
      name: 'ClassMate Student Access',
      description: 'Full access to ClassMate AI-powered study tools including practice tests, flashcards, personalized AI tutoring, and access to any class added during your access period.',
      metadata: {
        type: 'student_access',
        features: 'practice_tests,flashcards,ai_tutor,self_study_rooms,all_classes',
      },
    });
    console.log('Created product:', product.id);
  }

  const existingPrices = await stripe.prices.list({ product: product.id, active: true });
  
  const has4MonthPrice = existingPrices.data.some(p => 
    p.unit_amount === 4000 && p.type === 'one_time'
  );
  const hasAnnualPrice = existingPrices.data.some(p => 
    p.unit_amount === 9000 && p.type === 'one_time'
  );

  if (!has4MonthPrice) {
    const semesterPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 4000,
      currency: 'usd',
      metadata: {
        display_name: '4-Month Access',
        duration_months: '4',
        plan_type: 'semester',
      },
    });
    console.log('Created 4-month price:', semesterPrice.id, '- $40');
  } else {
    console.log('4-month price ($40) already exists');
  }

  if (!hasAnnualPrice) {
    const annualPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 9000,
      currency: 'usd',
      metadata: {
        display_name: 'Annual Access',
        duration_months: '12',
        plan_type: 'annual',
      },
    });
    console.log('Created annual price:', annualPrice.id, '- $90');
  } else {
    console.log('Annual price ($90) already exists');
  }

  const allPrices = await stripe.prices.list({ product: product.id, active: true });
  
  const priceInfo = {
    productId: product.id,
    semesterPriceId: allPrices.data.find(p => p.unit_amount === 4000)?.id,
    annualPriceId: allPrices.data.find(p => p.unit_amount === 9000)?.id,
  };
  
  console.log('Stripe products ready:', priceInfo);
  
  return priceInfo;
}

