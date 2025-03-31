import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import Stripe from 'stripe';

// Initialize Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-02-24.acacia', // Latest supported API version
});

// Products and prices
const CREDIT_PRICES = {
  "12": process.env.STRIPE_PRICE_12_CREDITS || '',   // 12 credits for €12
  "30": process.env.STRIPE_PRICE_30_CREDITS || '',   // 30 credits for €30
  "60": process.env.STRIPE_PRICE_60_CREDITS || '',   // 60 credits for €60
  "120": process.env.STRIPE_PRICE_120_CREDITS || '', // 120 credits for €120
};

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const creditAmount = searchParams.get('amount') || '12'; // Default to 12 credits
    const customAmount = searchParams.get('custom');
    
    // Validate the amount
    if (!customAmount && !CREDIT_PRICES[creditAmount as keyof typeof CREDIT_PRICES]) {
      return NextResponse.json({ error: 'Invalid credit amount' }, { status: 400 });
    }
    
    // Get the authenticated user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get user profile for metadata
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, email')
      .eq('id', user.id)
      .single();
    
    // Define metadata - make sure it contains only string values
    const metadata: Record<string, string> = {
      user_id: user.id,
      credits: customAmount || creditAmount,
    };
    
    // Only add these if they're not undefined
    if (user.email) metadata.user_email = user.email;
    if (profile?.username) metadata.username = profile.username;
    
    let session;
    
    if (customAmount) {
      // Handle custom amount
      const numericAmount = parseInt(customAmount, 10);
      
      // Validate custom amount (minimum 5 credits)
      if (isNaN(numericAmount) || numericAmount < 5) {
        return NextResponse.json({ error: 'Custom amount must be at least 5 credits' }, { status: 400 });
      }
      
      // Create a custom checkout session with the line item directly
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'eur',
              product_data: {
                name: `${numericAmount} DreamStream Credits`,
                description: `${numericAmount} credits for streaming on DreamStream`,
              },
              unit_amount: numericAmount * 100, // In cents (1 credit = €1 = 100 cents)
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        metadata: metadata,
        success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/profile?payment=success`,
        cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/profile?payment=cancelled`,
      });
    } else {
      // Use predefined product/price
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: CREDIT_PRICES[creditAmount as keyof typeof CREDIT_PRICES],
            quantity: 1,
          },
        ],
        mode: 'payment',
        metadata: metadata,
        success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/profile?payment=success`,
        cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/profile?payment=cancelled`,
      });
    }
    
    // Redirect to Stripe checkout
    return NextResponse.redirect(session.url as string, { status: 303 });
    
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
} 