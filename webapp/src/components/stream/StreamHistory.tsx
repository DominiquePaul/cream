"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from '@/lib/supabase';
import { formatDate, formatDuration } from '@/utils/formatters';
import { Clock, User, Calendar } from 'lucide-react';

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
          .limit(5);
        
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
  }, [user]);

  return (
    <Card className="shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Recent Streams</CardTitle>
        <CardDescription>Your recent streaming activity</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-indigo-500 mb-2"></div>
            <p className="text-sm text-gray-500">Loading stream history...</p>
          </div>
        ) : error ? (
          <div className="text-center py-4 text-red-500">{error}</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            <p>You haven't streamed yet.</p>
            <p className="text-sm mt-1">Start a stream to see your history here!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div 
                key={session.id} 
                className="border rounded-md p-3 bg-white shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium">
                      {formatDate(session.start_time)}
                    </p>
                    <div className="flex items-center mt-1 text-xs text-gray-500">
                      <Clock className="h-3 w-3 mr-1" />
                      {session.duration_minutes ? (
                        <span>{formatDuration(session.duration_minutes)}</span>
                      ) : (
                        <span>--</span>
                      )}
                      
                      <User className="h-3 w-3 ml-3 mr-1" />
                      <span>{session.max_viewers} viewer{session.max_viewers !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      session.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {session.status === 'active' ? 'Live' : 'Completed'}
                    </span>
                    
                    {session.cost_credits !== null && (
                      <p className="text-xs mt-1">
                        <span className="text-gray-500">Cost:</span>{' '}
                        <span className="font-medium">{session.cost_credits.toFixed(2)} credits</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 