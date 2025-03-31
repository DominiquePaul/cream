import ProfileForm from '@/components/auth/ProfileForm';
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
    <div className="min-h-screen bg-white py-6 md:py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl md:text-3xl font-medium text-gray-900">Account Settings</h1>
          <p className="mt-2 text-sm text-gray-500">
            Manage your DreamStream profile and preferences
          </p>
        </div>
        
        {/* Unified account header with avatar */}
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-6 mb-8 text-center">
          <div className="mx-auto h-24 w-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-medium overflow-hidden shadow-md mb-4">
            {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
          </div>
          
          <h2 className="text-xl font-medium text-gray-900 flex items-center justify-center gap-2">
            {profile?.full_name || 'Set your name'}
            {profile?.is_admin && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Admin
              </span>
            )}
          </h2>
          
          <p className="text-sm text-gray-500 mt-1">
            {user.email}
          </p>
          
          {profile?.username && (
            <p className="text-sm text-gray-600 mt-1">
              @{profile.username}
            </p>
          )}
        </div>
        
        {/* Profile form in a single column */}
        <ProfileForm user={user} profile={profile} />
      </div>
    </div>
  );
} 