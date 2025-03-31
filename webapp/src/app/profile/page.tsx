"use client";

import ProfileForm from "@/components/auth/ProfileForm";

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 py-12">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold mb-8 text-center">Your Profile</h1>
        <ProfileForm />
      </div>
    </div>
  );
} 