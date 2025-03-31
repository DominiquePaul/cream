"use client";

import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminDebug() {
  const { isAdmin, user } = useAuth();
  const [showDebug, setShowDebug] = useState(false);

  if (!isAdmin) return null;

  return (
    <div className="mt-4 mb-4">
      <Button 
        variant="outline" 
        className="mb-2 bg-purple-50 border-purple-200 text-purple-700"
        onClick={() => setShowDebug(!showDebug)}
      >
        {showDebug ? 'Hide' : 'Show'} Admin Debug
      </Button>

      {showDebug && (
        <Card className="border-purple-200">
          <CardHeader className="bg-purple-50">
            <CardTitle className="text-purple-700">Admin Debug Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <h3 className="font-medium">User Information:</h3>
              <pre className="bg-gray-100 p-2 rounded overflow-auto text-xs">
                {JSON.stringify(user, null, 2)}
              </pre>
              
              {/* Add more debug tools as needed */}
              <div className="flex space-x-2 mt-4">
                <Button variant="outline" size="sm" onClick={() => console.log('Current user:', user)}>
                  Log User to Console
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 