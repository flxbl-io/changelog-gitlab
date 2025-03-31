"use client"

import { useEffect, useState } from 'react';
import ChangelogCards from '@/components/ChangelogCards';

export default function Page() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionState, setConnectionState] = useState<"pending" | "connected" | "failed">("pending");
  
  // Ensure we have a connection to the repository
  useEffect(() => {
    // Check for auto-connection flag to prevent refresh loops
    const autoConnectFlag = sessionStorage.getItem("envview_auto_connect_attempted");
    
    // Only run the connection logic once per session
    if (autoConnectFlag === "true") {
      return;
    }
    
    const connectToRepository = async () => {
      setIsConnecting(true);
      sessionStorage.setItem("envview_auto_connect_attempted", "true");
      
      const storedProjectId = localStorage.getItem("projectId");
      
      if (storedProjectId) {
        // We already have a project ID, no need to connect
        setConnectionState("connected");
        setIsConnecting(false);
        return;
      }
      
      const gitlabHost = localStorage.getItem("gitlabHost") || "gitlab.apps.ndia.gov.au";
      const repository = localStorage.getItem("repository") || "ocio/salesforce/pace-sf";
      
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
          
          setConnectionState("connected");
          // Instead of forcing a refresh, we'll let React re-render
        } else {
          setConnectionState("failed");
        }
      } catch (error) {
        console.error("Failed to auto-connect to repository:", error);
        setConnectionState("failed");
      } finally {
        setIsConnecting(false);
      }
    };
    
    connectToRepository();
  }, []);
  
  return (
    <main>
      {isConnecting ? (
        <div className="flex justify-center items-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Connecting to repository...</p>
          </div>
        </div>
      ) : (
        <ChangelogCards key={connectionState} />
      )}
    </main>
  );
}