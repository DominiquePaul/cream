import ProfileForm from '@/components/auth/ProfileForm';
import CreditsDisplay from '@/components/credits/CreditsDisplay';
import StreamHistory from '@/components/stream/StreamHistory';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, History, User, BarChart, Users, Flame, Clock, Video, VideoOff } from 'lucide-react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";

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
      {/* Enhanced Header Section - Removed New Stream button */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-6 border-b">
        <div>
          <h1 className="text-3xl font-bold">Your Profile</h1>
          <p className="text-muted-foreground mt-1">Manage your account and view stream history</p>
        </div>
        
        <div className="flex items-center">
          <div className="flex items-center bg-muted rounded-lg p-3 gap-3">
            <div className="bg-primary/10 p-2 rounded-full">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Available Credits</div>
              <div className="text-2xl font-bold">{Number(profile?.credits || 0).toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Stream Activity Overview */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <BarChart className="h-5 w-5 mr-2 text-muted-foreground" /> 
          Stream Activity Overview
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-primary/5 border-primary/10">
            <CardContent className="pt-6 pb-6">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-full">
                  <History className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Streams</p>
                  <div className="text-2xl font-bold">{totalStreams}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-primary/5 border-primary/10">
            <CardContent className="pt-6 pb-6">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-full">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Time Streamed</p>
                  <div className="text-2xl font-bold">{Math.floor(totalStreamMinutes / 60)}h {totalStreamMinutes % 60}m</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-primary/5 border-primary/10">
            <CardContent className="pt-6 pb-6">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-full">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Viewers</p>
                  <div className="text-2xl font-bold">{totalViewers}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-primary/5 border-primary/10">
            <CardContent className="pt-6 pb-6">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-full">
                  <Flame className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Peak Viewers</p>
                  <div className="text-2xl font-bold">{maxViewers}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Detailed Stats */}
      {totalStreams > 0 && (
        <div className="mb-12 bg-muted/40 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Streaming Insights</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <div className="bg-background rounded-lg p-4 shadow-sm">
              <div className="text-muted-foreground text-sm mb-1">Average Viewers Per Stream</div>
              <div className="text-3xl font-bold">{avgViewersPerStream}</div>
              <div className="mt-3 text-xs text-muted-foreground">
                Based on {totalStreams} streams
              </div>
            </div>
            
            <div className="bg-background rounded-lg p-4 shadow-sm">
              <div className="text-muted-foreground text-sm mb-1">Average Session Length</div>
              <div className="text-3xl font-bold">
                {totalStreams > 0 ? Math.round(totalStreamMinutes / totalStreams) : 0} min
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Per streaming session
              </div>
            </div>
            
            <div className="bg-background rounded-lg p-4 shadow-sm">
              <div className="text-muted-foreground text-sm mb-1">Credits Used</div>
              <div className="text-3xl font-bold">
                {Number(streamStats?.reduce((sum, session) => sum + (session.cost_credits || 0), 0) || 0).toFixed(2)}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Total for all streams
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Content sections stacked vertically instead of tabs */}
      <div className="space-y-10">
        {/* Stream History Section */}
        <div>
          <div className="mb-6 flex items-center">
            <History className="h-5 w-5 mr-2 text-primary" />
            <h2 className="text-xl font-semibold">Stream History</h2>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Your Stream History</CardTitle>
              <CardDescription>
                View details about your previous streams
              </CardDescription>
            </CardHeader>
            <CardContent>
              {totalStreams > 0 ? (
                <StreamHistory />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="bg-muted/40 p-5 rounded-full mb-4">
                    <VideoOff className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-medium mb-2">No streams yet</h3>
                  <p className="text-muted-foreground max-w-md mb-6">
                    You haven&apos;t created any streams yet. Start your first stream to see your history here.
                  </p>
                  <Link href="/stream/create">
                    <Button className="flex items-center gap-2">
                      <Video className="h-4 w-4" />
                      Start Your First Stream
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Profile Settings Section */}
        <div>
          <div className="mb-6 flex items-center">
            <User className="h-5 w-5 mr-2 text-primary" />
            <h2 className="text-xl font-semibold">Profile Settings</h2>
          </div>
          
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
        </div>
        
        {/* Billing Section */}
        <div>
          <div className="mb-6 flex items-center">
            <CreditCard className="h-5 w-5 mr-2 text-primary" />
            <h2 className="text-xl font-semibold">Credits & Billing</h2>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Credits & Billing</CardTitle>
              <CardDescription>
                Manage your credits and billing preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreditsDisplay showTimeRemaining={true} showPurchase={true} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 