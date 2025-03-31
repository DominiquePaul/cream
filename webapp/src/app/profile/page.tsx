import ProfileForm from '@/components/auth/ProfileForm';
import CreditsDisplay from '@/components/credits/CreditsDisplay';
import StreamHistory from '@/components/stream/StreamHistory';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, CreditCard, History, User, BarChart, Clock, Users, Flame } from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/utils/formatters';

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

  const { data: streamCount } = await supabase
    .from('stream_sessions')
    .select('id', { count: 'exact' })
    .eq('profile_id', user.id);
    
  const totalStreams = streamCount?.length || 0;

  // Get stream session stats
  const { data: streamStats } = await supabase
    .from('stream_sessions')
    .select('duration_minutes, max_viewers, cost_credits')
    .eq('profile_id', user.id)
    .order('start_time', { ascending: false });

  // Calculate analytics
  const totalStreamMinutes = streamStats?.reduce((sum, session) => sum + (session.duration_minutes || 0), 0) || 0;
  const totalViewers = streamStats?.reduce((sum, session) => sum + (session.max_viewers || 0), 0) || 0;
  const avgViewersPerStream = totalStreams > 0 ? Math.round(totalViewers / totalStreams) : 0;
  const maxViewers = streamStats?.reduce((max, session) => Math.max(max, session.max_viewers || 0), 0) || 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex flex-col md:flex-row gap-6 mb-8 items-start">
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Your Profile</h1>
          <p className="text-muted-foreground mt-1">Manage your account and view stream history</p>
        </div>
        <Link href="/stream/new" className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
          Start New Stream <ArrowUpRight className="ml-2 h-4 w-4" />
        </Link>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center">
              <CreditCard className="h-4 w-4 mr-2" /> Credits
            </CardTitle>
            <CardDescription>Your streaming balance</CardDescription>
          </CardHeader>
          <CardContent>
            <CreditsDisplay showTimeRemaining={true} />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center">
              <History className="h-4 w-4 mr-2" /> Streams
            </CardTitle>
            <CardDescription>Your streaming activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalStreams}</div>
            <div className="text-sm text-muted-foreground">Total streams created</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center">
              <User className="h-4 w-4 mr-2" /> Account
            </CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              <div className="font-medium">{profile?.full_name || user.email}</div>
              <div className="text-muted-foreground">{profile?.username ? `@${profile.username}` : ''}</div>
              <div className="text-muted-foreground">
                Member since {profile?.created_at 
                  ? formatDate(profile.created_at) 
                  : formatDate(new Date().toISOString())}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {totalStreams > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <BarChart className="h-5 w-5 mr-2 text-muted-foreground" /> 
            Stream Analytics
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Time</p>
                    <div className="text-2xl font-bold">
                      {Math.floor(totalStreamMinutes / 60)}h {totalStreamMinutes % 60}m
                    </div>
                  </div>
                  <Clock className="h-8 w-8 text-muted-foreground/50" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Viewers</p>
                    <div className="text-2xl font-bold">{totalViewers}</div>
                  </div>
                  <Users className="h-8 w-8 text-muted-foreground/50" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Avg. Viewers</p>
                    <div className="text-2xl font-bold">{avgViewersPerStream}</div>
                  </div>
                  <User className="h-8 w-8 text-muted-foreground/50" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Peak Viewers</p>
                    <div className="text-2xl font-bold">{maxViewers}</div>
                  </div>
                  <Flame className="h-8 w-8 text-muted-foreground/50" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      
      <Tabs defaultValue="streams" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="streams">Stream History</TabsTrigger>
          <TabsTrigger value="profile">Profile Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="streams" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Stream History</CardTitle>
              <CardDescription>
                View details about your previous streams
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StreamHistory />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="profile" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Information</CardTitle>
              <CardDescription>
                Update your account details and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileForm user={user} profile={profile} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 