"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatDate, formatDuration } from '@/utils/formatters';
import { Clock, User, Calendar, ChevronRight, PlayCircle, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface StreamSession {
  id: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  cost_credits: number | null;
  max_viewers: number;
  status: string;
}

export default function StreamHistory() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<StreamSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    const fetchStreamSessions = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('stream_sessions')
          .select('*')
          .eq('profile_id', user.id)
          .order('start_time', { ascending: false })
          .limit(showMore ? 10 : 5);
        
        if (error) throw error;
        
        setSessions(data || []);
      } catch (err) {
        console.error('Error fetching stream sessions:', err);
        setError('Failed to load stream history');
      } finally {
        setLoading(false);
      }
    };
    
    fetchStreamSessions();
  }, [user, showMore]);

  // Check if there are likely more sessions
  const hasMoreSessions = sessions.length === (showMore ? 10 : 5);

  return (
    <div className="space-y-4">
      {loading ? (
        // Skeleton loading state
        Array(3).fill(0).map((_, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-3">
            <div className="flex justify-between">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-16" />
            </div>
            <div className="flex space-x-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        ))
      ) : sessions.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-muted rounded-lg bg-muted/10">
          <PlayCircle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">You haven&apos;t streamed yet</p>
          <Link href="/stream">
            <Button className="mt-4">
              Start your first stream <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      ) : error ? (
        <div className="text-center py-6 bg-red-50 rounded-lg border border-red-200">
          <p className="text-red-600">{error}</p>
          <Button 
            variant="outline"
            className="mt-2" 
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {sessions.map((session) => (
              <div 
                key={session.id} 
                className="border rounded-lg p-4 bg-card hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">
                        {formatDate(session.start_time)}
                        {" "}
                        <span className="text-xs text-muted-foreground">
                          {new Date(session.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <div className="flex items-center">
                        <Clock className="h-3.5 w-3.5 mr-1" />
                        {session.duration_minutes ? (
                          <span>{formatDuration(session.duration_minutes)}</span>
                        ) : (
                          <span>In progress</span>
                        )}
                      </div>
                      
                      <div className="flex items-center">
                        <User className="h-3.5 w-3.5 mr-1" />
                        <span>{session.max_viewers} viewer{session.max_viewers !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      session.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {session.status === 'active' ? 'Live' : 'Completed'}
                    </span>
                    
                    {session.cost_credits !== null && (
                      <p className="text-xs mt-1.5">
                        <span className="text-muted-foreground">Cost:</span>{' '}
                        <span className="font-medium">{session.cost_credits.toFixed(2)} credits</span>
                      </p>
                    )}
                  </div>
                </div>
                
                {session.status === 'active' && (
                  <div className="mt-3 pt-3 border-t flex justify-end">
                    <Link href={`/watch/${session.id}`}>
                      <Button size="sm" variant="secondary" className="text-xs">
                        Watch Stream <ChevronRight className="ml-1 h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {hasMoreSessions && (
            <div className="flex justify-center mt-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowMore(!showMore)}
                className="text-xs"
              >
                {showMore ? "Show Less" : "Show More"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
} 