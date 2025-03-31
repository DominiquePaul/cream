import ProfileForm from '@/components/auth/ProfileForm';
import CreditsDisplay from '@/components/credits/CreditsDisplay';
import StreamHistory from '@/components/stream/StreamHistory';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export default async function ProfilePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // This should technically be handled by middleware,
    // but as a fallback, redirect here
    redirect('/auth/login?next=/profile');
  }

  // Fetch user profile from profiles table
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 means no rows found, which is okay if profile is new
    console.error('Error fetching profile:', error);
    // Handle error appropriately - maybe show an error message
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold mb-6">Your Profile</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <ProfileForm user={user} profile={profile} />
          </div>
          
          <div className="md:col-span-1 space-y-6">
            <CreditsDisplay showTimeRemaining={true} />
            <StreamHistory />
          </div>
        </div>
      </div>
    </div>
  );
} 