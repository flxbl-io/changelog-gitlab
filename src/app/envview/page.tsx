"use client"

import React, { useEffect, useState, useRef } from 'react';
import ChangelogCards from '@/components/ChangelogCards';

export default function Page() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionState, setConnectionState] = useState<"pending" | "connected" | "failed">("pending");
  
  // Use a ref to track if we've already tried to connect in this component instance
  const hasConnectedRef = useRef(false);
  
  // Ensure we have a connection to the repository
  useEffect(() => {
    // Check for auto-connection flag to prevent refresh loops
    const autoConnectFlag = sessionStorage.getItem("envview_auto_connect_attempted");
    
    // Only run the connection logic once per session AND once per component mount
    if (autoConnectFlag === "true" || hasConnectedRef.current) {
      console.log("Skipping auto-connect, already attempted");
      
      // If we already have a stored project ID, just update the connection state
      const storedProjectId = localStorage.getItem("projectId");
      if (storedProjectId && connectionState !== "connected") {
        setConnectionState("connected");
      }
      
      return;
    }
    
    // Mark that we've tried to connect in this component instance
    hasConnectedRef.current = true;
    
    const connectToRepository = async () => {
      setIsConnecting(true);
      sessionStorage.setItem("envview_auto_connect_attempted", "true");
      sessionStorage.setItem("envview_connect_timestamp", Date.now().toString());
      
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
        <ChangelogCards />
      )}
    </main>
  );
}