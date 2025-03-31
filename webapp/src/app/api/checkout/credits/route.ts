import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { initStripe, sanitizeMetadata, handleStripeOperation } from '@/utils/stripe';

// Credit package options
const CREDIT_PACKAGES = {
  small: { credits: 12, priceInCents: 1200 },
  medium: { credits: 30, priceInCents: 3000 },
  large: { credits: 60, priceInCents: 6000 },
  xlarge: { credits: 120, priceInCents: 12000 },
};

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const requestBody = await request.json();
    const { packageSize, successUrl, cancelUrl } = requestBody;

    // Validate package size
    const creditPackage = CREDIT_PACKAGES[packageSize as keyof typeof CREDIT_PACKAGES];
    if (!creditPackage) {
      return NextResponse.json(
        { error: 'Invalid package size. Choose from: small, medium, large, xlarge' },
        { status: 400 }
      );
    }

    // Get user information from Supabase
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Get user's profile information
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, username')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching user profile:', profileError);
      return NextResponse.json(
        { error: 'Error retrieving user profile information' },
        { status: 500 }
      );
    }

    // Initialize Stripe
    const stripe = initStripe();
    
    console.log('Creating Stripe checkout session for user:', profile.id);

    // Create a Stripe checkout session
    const { success, data: session, error } = await handleStripeOperation(async () => {
      return await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'eur',
              product_data: {
                name: `${creditPackage.credits} Credits`,
                description: `Package of ${creditPackage.credits} DreamStream credits`,
              },
              unit_amount: creditPackage.priceInCents,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: successUrl || `${request.nextUrl.origin}/profile?checkout=success`,
        cancel_url: cancelUrl || `${request.nextUrl.origin}/profile?checkout=canceled`,
        customer_email: user.email || profile.email,
        metadata: sanitizeMetadata({
          userId: profile.id,
          credits: creditPackage.credits,
          packageSize: packageSize,
          username: profile.username || 'user',
        }),
      });
    }, 'Failed to create checkout session');

    if (!success || !session) {
      return NextResponse.json({ error: error }, { status: 500 });
    }

    console.log('Checkout session created successfully:', session.id);
    return NextResponse.json({ checkoutUrl: session.url });
  } catch (error) {
    console.error('Unexpected error in checkout endpoint:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred processing your request' },
      { status: 500 }
    );
  }
} 