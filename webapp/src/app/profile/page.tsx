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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pb-5 border-b border-gray-200 mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-medium leading-tight text-gray-900">Your Profile</h1>
          <p className="mt-1 md:mt-2 text-sm text-gray-500">
            Manage your account settings and preferences for your DreamStream experience.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {/* Profile sidebar - hide on mobile and show at top on tablet+ */}
          <div className="hidden md:block md:col-span-1">
            <div className="sticky top-8 space-y-6">
              <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <div className="flex items-center space-x-4">
                  <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xl font-medium overflow-hidden">
                    {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg font-medium text-gray-900 truncate">
                      {profile?.full_name || 'Your Name'}
                    </h2>
                    <p className="text-sm text-gray-500 truncate">
                      {user.email}
                    </p>
                  </div>
                </div>
                
                <div className="mt-6 border-t border-gray-100 pt-4">
                  <div className="text-sm text-gray-500">
                    <span className="font-medium text-gray-900">Username: </span>
                    {profile?.username || 'Not set'}
                  </div>
                  {profile?.is_admin && (
                    <div className="mt-2 flex items-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        Admin
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Mobile-only compact profile header */}
          <div className="md:hidden col-span-1 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-sm font-medium overflow-hidden">
                  {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-medium text-gray-900 truncate">
                    {profile?.full_name || 'Your Name'}
                  </h2>
                  <p className="text-xs text-gray-500 truncate">
                    {user.email}
                  </p>
                  {profile?.username && (
                    <p className="text-xs text-gray-500">
                      <span className="font-medium">@{profile.username}</span>
                    </p>
                  )}
                </div>
                {profile?.is_admin && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    Admin
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <main className="col-span-1 md:col-span-2">
            <ProfileForm user={user} profile={profile} />
          </main>
        </div>
      </div>
    </div>
  );
} 