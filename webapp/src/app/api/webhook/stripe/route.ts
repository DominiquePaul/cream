import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';

// Initialize Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-02-24.acacia', // Use the latest supported API version
});

export async function POST(request: NextRequest) {
  try {
    // Get the request body as text
    const payload = await request.text();
    
    // Get the signature from the headers
    const headersList = await headers();
    const signature = headersList.get('stripe-signature') || '';
    
    // Verify the signature
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    let event: Stripe.Event;
    
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }
    
    // Handle the event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Skip if payment status is not 'paid'
      if (session.payment_status !== 'paid') {
        console.log(`Skipping non-paid session: ${session.id}`);
        return NextResponse.json({ received: true });
      }
      
      // Extract user ID and credits from metadata
      const userId = session.metadata?.user_id;
      const credits = session.metadata?.credits ? parseFloat(session.metadata.credits) : 0;
      
      if (!userId || !credits) {
        console.error('Missing user ID or credits in metadata:', session.metadata);
        return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
      }
      
      const supabase = await createClient();
      
      // Add credits to user's account
      // Instead of using RPC, directly update the profile
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', userId)
        .single();
        
      if (fetchError) {
        console.error('Error fetching user credits:', fetchError);
        return NextResponse.json({ error: 'Error fetching user credits' }, { status: 500 });
      }
      
      // Calculate new credit balance
      const newCredits = (profile.credits || 0) + credits;
      
      // Update the profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          credits: newCredits,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
      
      if (updateError) {
        console.error('Error updating user credits:', updateError);
        return NextResponse.json({ error: 'Error updating credits' }, { status: 500 });
      }
      
      // Record the transaction
      const { error: transactionError } = await supabase
        .from('credit_transactions')
        .insert({
          profile_id: userId,
          amount: credits,
          type: 'purchase',
          payment_id: session.payment_intent as string,
          description: `Purchase of ${credits} credits`
        });
      
      if (transactionError) {
        console.error('Error recording transaction:', transactionError);
      }
      
      console.log(`Added ${credits} credits to user ${userId}`);
    }
    
    // Return a 200 response
    return NextResponse.json({ received: true });
    
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
} 