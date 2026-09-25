'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to account page which serves as the settings page
    router.push('/account');
  }, [router]);

  return null;
}
