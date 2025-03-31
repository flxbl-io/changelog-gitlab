"use client"

import { useEffect } from 'react';
import ChangelogForm from '../../components/ChangelogForm';

export default function ChangelogPage() {
  // Clear any session storage flags that might interfere with navigation
  useEffect(() => {
    // Remove all session flags that could cause issues
    sessionStorage.removeItem("envview_auto_connect_attempted");
    sessionStorage.removeItem("envview_connect_timestamp");
    sessionStorage.removeItem("navigated_from_envview");
    sessionStorage.removeItem("changelog_cards_fetch_id");
    sessionStorage.removeItem("changelog_cards_batch_fetched");
    sessionStorage.removeItem("changelog_cards_last_fetch_time");
  }, []);
  
  return (
    <main>
      <ChangelogForm />
    </main>
  );
}