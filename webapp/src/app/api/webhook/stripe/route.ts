import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { initStripe, handleStripeOperation } from '@/utils/stripe';
import Stripe from 'stripe';

async function incrementCredits(userId: string, creditAmount: number) {
  console.log(`Incrementing ${creditAmount} credits for user ${userId}`);
  
  // Initialize Supabase client
  const supabase = await createClient();
  
  // Get current credit balance
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', userId)
    .single();
  
  if (profileError) {
    console.error('Error fetching user profile:', profileError);
    throw new Error('Failed to fetch user profile');
  }
  
  // Calculate new balance
  const currentCredits = profile?.credits || 0;
  const newCredits = currentCredits + creditAmount;
  
  // Update credits
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ credits: newCredits, updated_at: new Date().toISOString() })
    .eq('id', userId);
  
  if (updateError) {
    console.error('Error updating credits:', updateError);
    throw new Error('Failed to update credits');
  }
  
  // Record the transaction
  const { error: transactionError } = await supabase
    .from('credit_transactions')
    .insert({
      profile_id: userId,
      type: 'purchase',
      amount: creditAmount,
      description: `Purchased ${creditAmount} credits`,
    });
  
  if (transactionError) {
    console.error('Error recording transaction:', transactionError);
    // Don't throw here, as the credits were already added
  }
  
  console.log(`Successfully updated credits for user ${userId} to ${newCredits}`);
  return { newCredits };
}

export async function POST(request: NextRequest) {
  // Get the Stripe signature from the request header
  const signature = request.headers.get('stripe-signature');
  
  if (!signature) {
    console.error('No Stripe signature found in the request');
    return NextResponse.json({ error: 'No signature provided' }, { status: 400 });
  }
  
  try {
    // Get the raw body
    const body = await request.text();
    
    // Initialize Stripe
    const stripe = initStripe();
    
    // Verify the webhook signature
    const { success: verifySuccess, data: event, error: verifyError } = 
      await handleStripeOperation(async () => {
        return stripe.webhooks.constructEvent(
          body,
          signature,
          process.env.STRIPE_WEBHOOK_SECRET || ''
        );
      }, 'Failed to verify webhook signature');
    
    if (!verifySuccess || !event) {
      console.error('Webhook verification failed:', verifyError);
      return NextResponse.json({ error: 'Webhook verification failed' }, { status: 400 });
    }
    
    console.log(`Processing Stripe webhook event: ${event.type}`);
    
    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata;
      
      if (!metadata || !metadata.userId || !metadata.credits) {
        console.error('Missing metadata in session:', session.id);
        return NextResponse.json({ error: 'Invalid session metadata' }, { status: 400 });
      }
      
      // Add credits to the user's account
      const userId = metadata.userId;
      const creditAmount = parseInt(metadata.credits, 10);
      
      if (isNaN(creditAmount) || creditAmount <= 0) {
        console.error('Invalid credit amount in metadata:', metadata.credits);
        return NextResponse.json({ error: 'Invalid credit amount' }, { status: 400 });
      }
      
      const { success, error } = await handleStripeOperation(async () => {
        return await incrementCredits(userId, creditAmount);
      }, 'Failed to add credits to user account');
      
      if (!success) {
        console.error('Failed to add credits:', error);
        return NextResponse.json({ error }, { status: 500 });
      }
      
      console.log(`Successfully added ${creditAmount} credits to user ${userId}`);
      return NextResponse.json({ success: true });
    }
    
    // Handle other webhook events here if needed
    
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Unexpected error in webhook handler:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred processing the webhook' },
      { status: 500 }
    );
  }
} 