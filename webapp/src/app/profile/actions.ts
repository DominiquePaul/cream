'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

interface ProfileUpdate {
  id: string;
  full_name?: string;
  username?: string;
  referral_source?: string;
  updated_at: string;
}

export async function updateProfile(formData: FormData) {
  try {
    const supabase = await createClient();
    
    // Verify the user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: 'Not authenticated', success: false };
    }
    
    // Get form values
    const full_name = formData.get('full_name') as string;
    const username = formData.get('username') as string;
    const referral_source = formData.get('referral_source') as string;
    
    // Validate username
    if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
      return { 
        error: 'Username can only contain letters, numbers, and underscores',
        success: false 
      };
    }
    
    // Check if username is taken by another user
    if (username) {
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .not('id', 'eq', user.id)
        .maybeSingle();
        
      if (checkError) {
        return { error: `Database error: ${checkError.message}`, success: false };
      }
      
      if (existingUser) {
        return { error: 'Username is already taken', success: false };
      }
    }
    
    // Prepare update data
    const updates: ProfileUpdate = {
      id: user.id,
      full_name,
      username,
      updated_at: new Date().toISOString(),
    };
    
    // Add referral_source only if provided from form data
    // (This should come from existing profile data, not user input on profile page)
    if (referral_source) {
      updates.referral_source = referral_source;
    }
    
    // Update the profile
    const { error: updateError } = await supabase
      .from('profiles')
      .upsert(updates)
      .eq('id', user.id);
      
    if (updateError) {
      return { error: `Failed to update profile: ${updateError.message}`, success: false };
    }
    
    // Revalidate the profile page to show updated data
    revalidatePath('/profile');
    
    return { message: 'Profile updated successfully', success: true };
    
  } catch (error) {
    console.error('Error updating profile:', error);
    return { 
      error: `An unexpected error occurred: ${error instanceof Error ? error.message : String(error)}`,
      success: false 
    };
  }
} 