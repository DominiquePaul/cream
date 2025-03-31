import Stripe from 'stripe';

// Function to initialize Stripe with proper error handling
export function initStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('Missing STRIPE_SECRET_KEY environment variable');
    throw new Error('Missing required Stripe environment variable');
  }

  try {
    return new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia',
      typescript: true,
    });
  } catch (error) {
    console.error('Failed to initialize Stripe client:', error);
    throw new Error('Could not initialize payment provider');
  }
}

// Common error handler for Stripe operations
export async function handleStripeOperation<T>(
  operation: () => Promise<T>,
  errorMessage = 'Payment operation failed'
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const result = await operation();
    return { success: true, data: result };
  } catch (error) {
    const errorDetail = error instanceof Error ? error.message : String(error);
    console.error(`${errorMessage}:`, errorDetail);
    return { success: false, error: errorMessage };
  }
}

// Format price in cents to a readable format (e.g., $5.99)
export function formatPrice(priceInCents: number): string {
  const dollars = priceInCents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(dollars);
}

// Sanitize metadata values for Stripe (ensure all values are strings)
export function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(metadata)) {
    sanitized[key] = String(value);
  }
  
  return sanitized;
} 