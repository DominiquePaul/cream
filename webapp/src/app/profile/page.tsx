import ProfileForm from '@/components/auth/ProfileForm';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export default async function ProfilePage() {
  const supabase = createClient();

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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 py-12">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold mb-8 text-center">Your Profile</h1>
        {/* Pass fetched data as props to the client component */}
        <ProfileForm user={user} profile={profile} />
      </div>
    </div>
  );
} 