"use client"

import { useEffect } from 'react';
import ChangelogCards from '@/components/ChangelogCards';

export default function Page() {
  // Ensure we have a connection to the repository
  useEffect(() => {
    const connectToRepository = async () => {
      const storedProjectId = localStorage.getItem("projectId");
      const gitlabHost = localStorage.getItem("gitlabHost") || "gitlab.apps.ndia.gov.au";
      const repository = localStorage.getItem("repository") || "ocio/salesforce/pace-sf";
      
      if (!storedProjectId) {
        console.log("No project ID found, trying to connect automatically...");
        try {
          const response = await fetch('/api/getRepository', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gitlabHost, repository }),
          });
          
          if (response.ok) {
            const data = await response.json();
            localStorage.setItem("projectId", data.projectId.toString());
            localStorage.setItem("projectPath", data.projectPath);
            console.log("Auto-connected to repository:", data.projectPath);
            // Force a refresh to ensure the data is loaded
            window.location.reload();
          }
        } catch (error) {
          console.error("Failed to auto-connect to repository:", error);
        }
      }
    };
    
    connectToRepository();
  }, []);
  
  return (
    <main>
      <ChangelogCards />
    </main>
  );
}