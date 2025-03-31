"use client"

import React, { useEffect, useState } from 'react';
import ChangelogCards from '@/components/ChangelogCards';

export default function EnvViewPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Simple connection function that runs only once on mount
  useEffect(() => {
    async function ensureRepositoryConnection() {
      console.log("EnvView: Checking repository connection");
      
      try {
        // Check if we already have a stored project ID
        const storedProjectId = localStorage.getItem("projectId");
        
        if (storedProjectId) {
          console.log("EnvView: Already connected with Project ID:", storedProjectId);
          setIsLoading(false);
          return;
        }
        
        // If no project ID, attempt to connect
        console.log("EnvView: No project ID found, connecting...");
        
        const gitlabHost = localStorage.getItem("gitlabHost") || "gitlab.apps.ndia.gov.au";
        const repository = localStorage.getItem("repository") || "ocio/salesforce/pace-sf";
        
        const response = await fetch('/api/getRepository', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gitlabHost, repository }),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to connect: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Store connection info in localStorage
        localStorage.setItem("projectId", data.projectId.toString());
        localStorage.setItem("projectPath", data.projectPath);
        console.log("EnvView: Connected to repository:", data.projectPath);
        
      } catch (error) {
        console.error("EnvView: Connection error:", error);
        setConnectionError(error instanceof Error ? error.message : "Unknown connection error");
      } finally {
        setIsLoading(false);
      }
    }
    
    // Clear any previous session storage that might interfere
    // This ensures we get a fresh start on this page
    sessionStorage.removeItem("envview_auto_connect_attempted");
    sessionStorage.removeItem("changelog_cards_fetch_id");
    sessionStorage.removeItem("changelog_cards_batch_fetched");
    
    // Connect to repository
    ensureRepositoryConnection();
    
    // Clean up when component unmounts
    return () => {
      console.log("EnvView: Component unmounting");
    };
  }, []);
  
  // Show loading state
  if (isLoading) {
    return (
      <main>
        <div className="flex justify-center items-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Connecting to repository...</p>
          </div>
        </div>
      </main>
    );
  }
  
  // Show error state
  if (connectionError) {
    return (
      <main>
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <div className="flex">
            <div>
              <p className="text-red-700 font-medium">Connection Error</p>
              <p className="text-red-700">{connectionError}</p>
              <p className="text-sm text-red-600 mt-2">
                Check your GitLab settings and try again.
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }
  
  // Show connected state with changelog cards
  return (
    <main>
      <ChangelogCards key="envview-cards" />
    </main>
  );
}