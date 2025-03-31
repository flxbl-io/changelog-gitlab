"use client"

import { useEffect } from 'react';
import EnvironmentTimeline from '@/components/EnvironmentTimeline';

export default function Page() {
  // Clear envview-specific session storage when navigating to timeline
  useEffect(() => {
    // Clear the auto-connect flag when navigating to a different page
    if (sessionStorage.getItem("envview_auto_connect_attempted")) {
      console.log("Timeline page: Clearing envview connection flags");
      sessionStorage.removeItem("envview_auto_connect_attempted");
      sessionStorage.removeItem("envview_connect_timestamp");
    }
  }, []);
  
  return (
    <main>
      <EnvironmentTimeline />
    </main>
  );
}