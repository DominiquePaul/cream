-- Function to deduct credits from a profile
-- This function ensures credits don't go below 0 and handles all the transaction atomically
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
-- Returns the new credit balance
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