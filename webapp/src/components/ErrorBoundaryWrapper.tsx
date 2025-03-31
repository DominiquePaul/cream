'use client';

import dynamic from 'next/dynamic';
import React from 'react';

const ErrorBoundary = dynamic(() => import('@/components/ErrorBoundary'), {
  ssr: false,
});

export default function ErrorBoundaryWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
} 