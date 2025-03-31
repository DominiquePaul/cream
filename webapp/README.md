This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## WebSocket Server Connection

This application requires a WebSocket server for streaming functionality. By default, it connects to a local WebSocket server running on `ws://localhost:8080`. 

To connect to a deployed WebSocket server:

1. Update the `.env.local` file with your WebSocket server URL:
   ```
   NEXT_PUBLIC_WEBSOCKET_URL=wss://your-websocket-server.onrender.com
   ```
   
   Note: Use `wss://` for secure connections in production, not `ws://`.

2. Restart your Next.js development server for the changes to take effect.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Credits System Setup

The application includes a credit-based system for streaming. Users need credits to stream, with 1 hour of streaming costing 12 credits. Each credit is worth €1, and users start with 12 free credits when they create an account.

### Stripe Integration

To enable credit purchases, you need to set up Stripe:

1. Create a Stripe account at [stripe.com](https://stripe.com)
2. Get your API keys from the Stripe Dashboard
3. Create products and prices for credit packages (12, 30, 60, and 120 credits)
4. Set the following environment variables:

```
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PRICE_12_CREDITS=price_your_12_credits_price_id
STRIPE_PRICE_30_CREDITS=price_your_30_credits_price_id
STRIPE_PRICE_60_CREDITS=price_your_60_credits_price_id
STRIPE_PRICE_120_CREDITS=price_your_120_credits_price_id
NEXT_PUBLIC_BASE_URL=http://localhost:3000 # or your production URL
```

5. Set up a webhook in your Stripe Dashboard to point to `/api/webhook/stripe` with the following events:
   - `checkout.session.completed`

### Database Functions

Run the following SQL functions in your Supabase SQL editor:

```sql
-- Function to deduct credits from a profile
CREATE OR REPLACE FUNCTION deduct_credits(user_id UUID, amount REAL)
RETURNS void AS $$
DECLARE
  current_credits REAL;
BEGIN
  -- Get current credits balance
  SELECT credits INTO current_credits FROM profiles WHERE id = user_id;
  
  -- Update profile with new credits balance
  -- Ensure we don't go below 0
  UPDATE profiles 
  SET 
    credits = GREATEST(0, current_credits - amount),
    updated_at = NOW()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment credits for a profile
CREATE OR REPLACE FUNCTION increment_credits(user_id UUID, amount REAL)
RETURNS REAL AS $$
DECLARE
  current_credits REAL;
  new_credits REAL;
BEGIN
  -- Get current credits balance
  SELECT credits INTO current_credits FROM profiles WHERE id = user_id;
  
  -- Calculate new balance
  new_credits := current_credits + amount;
  
  -- Update profile with new credits balance
  UPDATE profiles 
  SET 
    credits = new_credits,
    updated_at = NOW()
  WHERE id = user_id;
  
  -- Return the new balance
  RETURN new_credits;
END;
$$ LANGUAGE plpgsql;
```
