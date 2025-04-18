"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GitCommit, GitMerge, Tag, Clock, Ticket, ExternalLink, MoreHorizontal, RefreshCw } from 'lucide-react';
import DeploymentModal from './DeploymentModal';

interface TimelineItem {
  tag: string;
  tickets: string[];
  mrIds: string[];
  commitId?: string;
}

interface Environment {
  id: string;
  display: string;
  name: string;
  jobType: string;
}

interface DeploymentData extends TimelineItem {
  date: Date;
  tag: string;
  // Custom field for commit-aligned view
  __commitId?: string;
  // Don't need to redeclare commitId since it's inherited from TimelineItem
}

// Define a more generic type for the date entries in processed data
interface ProcessedData {
  [dateKey: string]: {
    [key: string]: DeploymentData[] | string[];
  };
}

interface TimelineData {
  [envId: string]: {
    [tag: string]: TimelineItem;
  };
}

interface ModalData extends DeploymentData {
  envDisplay: string;
}

const MAX_VISIBLE_ITEMS = 5;
const CARD_HEIGHT = 'h-60';
const DAYS_TO_SHOW = 15;

const EnvironmentTimeline: React.FC = () => {
  const [timelineData, setTimelineData] = useState<TimelineData>({});
  const [processedData, setProcessedData] = useState<ProcessedData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<ModalData | null>(null);

  // Constants
  const [jiraHost, setJiraHost] = useState("jira.apps.ndis.gov.au");
  const [repository, setRepository] = useState("ocio/salesforce/pace-sf");
  const [gitlabHost, setGitlabHost] = useState("gitlab.apps.ndia.gov.au");
  const [jiraRegex, setJiraRegex] = useState("(PSS-d+)|(P2B-d+)|(SFUAT-d+)|(DIPMO-d+)|(P2CL-d+)|(GPO-d+)|(CS-d+)|(OCM-d+)|(OCM-d+)|(TS-d+)|");
  const [selectedLeader, setSelectedLeader] = useState<string>("sit1");
  const [alignByCommit, setAlignByCommit] = useState<boolean>(true);
  
  // Leader config editing states
  const [isEditing, setIsEditing] = useState(false);
  const [editingLeader, setEditingLeader] = useState<string>('');
  const [selectedEnvironments, setSelectedEnvironments] = useState<string[]>([]);
  
  // New leader creation states
  const [isCreating, setIsCreating] = useState(false);
  const [newLeaderName, setNewLeaderName] = useState('');
  
  // Load settings from localStorage
  useEffect(() => {
    const storedJiraHost = localStorage.getItem("jiraHost");
    const storedRepository = localStorage.getItem("repository");
    const storedGitlabHost = localStorage.getItem("gitlabHost");
    const storedJiraRegex = localStorage.getItem("jiraRegex");
    const storedLeader = localStorage.getItem("selectedLeader");
    const storedAlignByCommit = localStorage.getItem("alignByCommit");
    
    if (storedJiraHost) setJiraHost(storedJiraHost);
    if (storedRepository) setRepository(storedRepository);
    if (storedGitlabHost) setGitlabHost(storedGitlabHost);
    if (storedJiraRegex) setJiraRegex(storedJiraRegex);
    if (storedLeader) setSelectedLeader(storedLeader);
    
    // For alignment settings, only override the default if explicitly set
    if (storedAlignByCommit !== null) {
      setAlignByCommit(storedAlignByCommit === 'true');
    } else {
      // Set default in localStorage for new users
      localStorage.setItem("alignByCommit", "true");
    }
  }, []);

  // Define all environments
  const allEnvironments: Environment[] = [
    { id: 'sit1-val', display: 'SIT1 - VAL', name: 'SIT1', jobType: 'VAL' },
    { id: 'sit1-dep', display: 'SIT1 - DEP', name: 'SIT1', jobType: 'DEP' },
    { id: 'sit2-val', display: 'SIT2 - VAL', name: 'SIT2', jobType: 'VAL' },
    { id: 'sit2-dep', display: 'SIT2 - DEP', name: 'SIT2', jobType: 'DEP' },
    { id: 'staging-dep', display: 'STAGING - DEP', name: 'STAGING', jobType: 'DEP' },
    { id: 'prod-val', display: 'PROD - VAL', name: 'PROD', jobType: 'VAL' },
  ];
  
  // Define leader configurations - made configurable
  const [leaderConfigs, setLeaderConfigs] = useState<Record<string, string[]>>({
    'sit1': ['sit1-val', 'sit1-dep', 'staging-dep', 'prod-val'],
    'sit2': ['sit2-val', 'sit2-dep']
  });
  
  // Load leader configurations from localStorage
  useEffect(() => {
    const storedLeaderConfigs = localStorage.getItem("leaderConfigs");
    if (storedLeaderConfigs) {
      try {
        const parsedConfigs = JSON.parse(storedLeaderConfigs);
        setLeaderConfigs(parsedConfigs);
        console.log("Loaded leader configurations:", parsedConfigs);
      } catch (e) {
        console.error("Failed to parse stored leader configurations:", e);
      }
    }
  }, []);
  
  // Filter environments based on selected leader
  const environments = allEnvironments.filter(env => 
    leaderConfigs[selectedLeader as keyof typeof leaderConfigs].includes(env.id)
  );
  
  // Handle leader selection change - completely rewritten for reliability
  const handleLeaderChange = (leader: string) => {
    if (loading || isRefreshing || isLeaderChanging) {
      console.log("Ignoring leader change while loading");
      return; // Don't allow changes while loading
    }
    
    console.log(`Switching leader to: ${leader}`);
    
    // Set loading state for leader change
    setIsLeaderChanging(true);
    
    // Save to local storage
    localStorage.setItem("selectedLeader", leader);
    
    // Cache the current selection to use in the data fetch
    const newLeader = leader;
    
    // Update the state using the callback pattern to ensure we get the latest state
    setSelectedLeader(prevLeader => {
      if (prevLeader === newLeader) {
        console.log("Leader didn't actually change, aborting");
        setIsLeaderChanging(false);
        return prevLeader;
      }
      
      // Clear session storage cache for the previous leader
      sessionStorage.removeItem("timeline_data_cache");
      
      // We need to fetch new data for this leader
      // This will be properly triggered by the useEffect with selectedLeader dependency
      
      return newLeader;
    });
  };
  
  // Handle alignment toggle - completely rewritten for reliability
  const handleAlignToggle = () => {
    if (loading || isRefreshing || isLeaderChanging) {
      console.log("Ignoring alignment toggle while loading");
      return; // Don't allow changes while loading
    }
    
    console.log("Toggling alignment mode");
    
    // Show loading state temporarily while we reprocess
    setIsLeaderChanging(true);
    
    // Calculate new value - do this before the state update
    const newValue = !alignByCommit;
    console.log(`Switching alignment mode to: ${newValue ? 'Commit View' : 'Date View'}`);
    
    // Update local storage first
    localStorage.setItem("alignByCommit", String(newValue));
    
    // Use this approach to ensure the new state is available immediately
    setAlignByCommit(prevMode => {
      // Use the callback to get latest state
      const updatedMode = !prevMode;
      
      // Schedule processing after state update is applied
      setTimeout(() => {
        if (timelineData && Object.keys(timelineData).length > 0) {
          console.log("Re-processing existing data with new view mode");
          // Here we use the updatedMode directly rather than the state variable
          // to avoid closure issues
          processTimelineData(timelineData, updatedMode);
        } else {
          console.log("No data available to reprocess");
        }
        
        // Clear loading state after processing
        setIsLeaderChanging(false);
      }, 50);
      
      return updatedMode;
    });
  };

  // Date parser for SIT1_DEP_DDMMYYYY-HHMMSS format
  const parseDate = (tag: string): Date => {
    try {
      const tagParts = tag.split('_');
      if (tagParts.length < 3) {
        throw new Error(`Invalid tag format: ${tag}`);
      }
      
      const datePart = tagParts[2];
      if (!datePart) {
        throw new Error(`Missing date part in tag: ${tag}`);
      }
      
      // Format should be DDMMYYYY-HHMMSS
      const dateTimeParts = datePart.split('-');
      if (dateTimeParts.length !== 2) {
        throw new Error(`Invalid date-time format in tag: ${tag}, expected format ENV_TYPE_DDMMYYYY-HHMMSS`);
      }
      
      const [datePortion, timePortion] = dateTimeParts;
      
      if (datePortion.length !== 8) {
        throw new Error(`Invalid date length in tag: ${tag}, expected 8 digits in DDMMYYYY format`);
      }
      
      if (timePortion.length !== 6) {
        throw new Error(`Invalid time length in tag: ${tag}, expected 6 digits in HHMMSS format`);
      }
      
      // Parse DDMMYYYY format
      const day = parseInt(datePortion.substring(0, 2));
      const month = parseInt(datePortion.substring(2, 4)) - 1;  // JS months are 0-indexed
      const year = parseInt(datePortion.substring(4, 8));
      
      // Parse HHMMSS format
      const hour = parseInt(timePortion.substring(0, 2));
      const minute = parseInt(timePortion.substring(2, 4));
      const second = parseInt(timePortion.substring(4, 6));
      
      // Validate date components
      if (isNaN(day) || isNaN(month) || isNaN(year) || isNaN(hour) || isNaN(minute) || isNaN(second)) {
        throw new Error(`Invalid date/time components in tag: ${tag}`);
      }
      
      if (month < 0 || month > 11) {
        throw new Error(`Invalid month in tag: ${tag}, month=${month+1}`);
      }
      
      if (day < 1 || day > 31) {
        throw new Error(`Invalid day in tag: ${tag}, day=${day}`);
      }
      
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
        throw new Error(`Invalid time in tag: ${tag}, time=${hour}:${minute}:${second}`);
      }
      
      // Create date object
      const parsedDate = new Date(year, month, day, hour, minute, second);
      
      return parsedDate;
    } catch (error) {
      console.error(`Error parsing date from tag ${tag}:`, error);
      // Return today as a fallback
      return new Date();
    }
  };

  const getDateKey = (date: Date): string => {
    // Return just DDMM format for grouping
    return `${String(date.getDate()).padStart(2, '0')}${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  const generateDateRange = (): string[] => {
    const dates = [];
    const today = new Date();  // Use system date

    for (let i = 0; i < DAYS_TO_SHOW; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      // Generate keys in DDMM format
      dates.push(`${String(date.getDate()).padStart(2, '0')}${String(date.getMonth() + 1).padStart(2, '0')}`);
    }
    
    return dates;
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  // New interface for commit-aligned data structure
  interface CommitAlignedData {
    commitId: string;
    dateKey: string;
    firstDate: Date;  // The date of the first deployment with this commit
    environments: Record<string, DeploymentData[]>;
  }

  const processTimelineData = (data: TimelineData, useCommitView?: boolean) => {
    // Skip processing if there's no data
    if (!data || Object.keys(data).length === 0) {
      console.log("No data to process in processTimelineData");
      return;
    }
    
    // Determine view mode - use parameter if provided, otherwise use state
    const useCommitAlignment = useCommitView !== undefined ? useCommitView : alignByCommit;
    
    console.log(`Processing timeline data with ${Object.keys(data).length} environments, alignByCommit=${useCommitAlignment}`);
    
    if (useCommitAlignment) {
      // For commit alignment with date grouping
      // First, collect all deployments by commit ID
      const commitMap: Record<string, CommitAlignedData> = {};
      
      // Process all deployments and organize by commit ID
      Object.entries(data).forEach(([envId, envData]) => {
        Object.entries(envData).forEach(([tag, deployment]) => {
          // Skip if no commit ID
          const commitId = deployment.commitId;
          if (!commitId) return;
          
          const date = parseDate(tag);
          const dateKey = getDateKey(date);
          
          // Create deployment data object
          const deploymentData: DeploymentData = {
            ...deployment,
            tag,
            date
          };
          
          // Initialize this commit in the map if it doesn't exist
          if (!commitMap[commitId]) {
            commitMap[commitId] = {
              commitId,
              dateKey,
              firstDate: date,
              environments: {}
            };
            
            // Initialize all environments with empty arrays
            environments.forEach(env => {
              commitMap[commitId].environments[env.id] = [];
            });
          }
          
          // Add this deployment to the commit map
          if (!commitMap[commitId].environments[envId]) {
            commitMap[commitId].environments[envId] = [];
          }
          
          commitMap[commitId].environments[envId].push(deploymentData);
          
          // Update the first date if this deployment is earlier
          if (date < commitMap[commitId].firstDate) {
            commitMap[commitId].firstDate = date;
            commitMap[commitId].dateKey = dateKey;
          }
        });
      });
      
      // Now, organize deployments by date keys
      const processed: ProcessedData = {};
      
      // Initialize all dates in the processed data
      generateDateRange().forEach(dateKey => {
        processed[dateKey] = {};
        environments.forEach(env => {
          processed[dateKey][env.id] = [];
        });
      });
      
      // Now add commit-grouped deployments to appropriate dates
      Object.values(commitMap).forEach(commitData => {
        const dateKey = commitData.dateKey;
        
        // Skip if this date is not in our display range
        if (!processed[dateKey]) return;
        
        // Add a special commit data property to the date
        if (!processed[dateKey]["__commits"]) {
          processed[dateKey]["__commits"] = [] as string[];
        }
        // Type cast to access the array methods
        (processed[dateKey]["__commits"] as string[]).push(commitData.commitId);
        
        // Add each environment's deployments for this commit
        environments.forEach(env => {
          const envDeployments = commitData.environments[env.id] || [];
          
          // Only add if there are deployments for this environment
          if (envDeployments.length > 0) {
            // Tag these deployments with their commit ID for proper grouping
            const taggedDeployments = envDeployments.map(dep => ({
              ...dep,
              __commitId: commitData.commitId // Add this for grouping
            }));
            
            // Make sure we've initialized the array for this environment
            if (!processed[dateKey][env.id]) {
              processed[dateKey][env.id] = [] as DeploymentData[];
            }
            // Cast to correct type for TypeScript
            (processed[dateKey][env.id] as DeploymentData[]).push(...taggedDeployments);
          }
        });
      });
      
      // Sort deployments within each date and environment by time
      Object.keys(processed).forEach(dateKey => {
        Object.keys(processed[dateKey]).forEach(envId => {
          if (envId !== "__commits") {
            // Cast to DeploymentData[] to access date property
            (processed[dateKey][envId] as DeploymentData[]).sort((a, b) => b.date.getTime() - a.date.getTime());
          }
        });
        
        // Also sort commits within each date
        if (processed[dateKey]["__commits"]) {
          (processed[dateKey]["__commits"] as string[]).sort((commitIdA, commitIdB) => {
            const dateA = commitMap[commitIdA]?.firstDate || new Date(0);
            const dateB = commitMap[commitIdB]?.firstDate || new Date(0);
            return dateB.getTime() - dateA.getTime();
          });
        }
      });
      
      setProcessedData(processed);
    } else {
      // Traditional date-based processing - completely rewritten and improved
      console.log("Using improved date-based processing with primary environment as source of truth");
      const processed: ProcessedData = {};
      
      // Get the first environment in the current leader config as the primary
      // This is important because we want to use the primary environment's dates
      const primaryEnvId = environments.length > 0 ? environments[0].id : null;
      console.log(`Using primary environment: ${primaryEnvId}`);
      
      if (!primaryEnvId) {
        console.warn("No environments found in leader configuration");
        setProcessedData({});
        return;
      }
      
      // Create a map to store all deployment data keyed by environment and date
      const deploymentsByEnv: Map<string, Map<string, DeploymentData[]>> = new Map();
      
      // Initialize map for each environment
      environments.forEach(env => {
        deploymentsByEnv.set(env.id, new Map<string, DeploymentData[]>());
      });
      
      // First, process all deployments from all environments and organize them by date
      environments.forEach(env => {
        if (!data[env.id]) return;
        
        const envDeployments = deploymentsByEnv.get(env.id)!;
        
        Object.entries(data[env.id]).forEach(([tag, deployment]) => {
          try {
            // Validate the tag format
            const tagParts = tag.split('_');
            if (tagParts.length < 3) {
              console.warn(`Skipping tag with invalid format: ${tag}`);
              return;
            }
            
            // Parse the date from the tag
            const date = parseDate(tag);
            const dateKey = getDateKey(date);
            
            // Create deployment data object
            const deploymentData: DeploymentData = {
              ...deployment,
              tag,
              date
            };
            
            // Add to this environment's deployments by date
            if (!envDeployments.has(dateKey)) {
              envDeployments.set(dateKey, []);
            }
            envDeployments.get(dateKey)!.push(deploymentData);
          } catch (error) {
            console.warn(`Error processing env ${env.id} tag ${tag}:`, error);
          }
        });
        
        // Sort deployments for each date by time (newest first)
        envDeployments.forEach((deployments, dateKey) => {
          deployments.sort((a, b) => b.date.getTime() - a.date.getTime());
        });
      });
      
      // Now, build the processed data structure based on primary environment dates
      // This ensures we use the primary environment as the source of truth for dates
      const primaryEnvDeployments = deploymentsByEnv.get(primaryEnvId);
      if (!primaryEnvDeployments || primaryEnvDeployments.size === 0) {
        console.warn("Primary environment has no deployments, using all visible dates");
        
        // Use date range as fallback if primary environment has no deployments
        const dateRange = generateDateRange();
        
        // Include any date that has deployments in any environment
        environments.forEach(env => {
          const envDeployments = deploymentsByEnv.get(env.id);
          if (!envDeployments) return;
          
          envDeployments.forEach((deployments, dateKey) => {
            if (dateRange.includes(dateKey) && deployments.length > 0) {
              if (!processed[dateKey]) {
                processed[dateKey] = {};
                environments.forEach(e => {
                  processed[dateKey][e.id] = [] as DeploymentData[];
                });
              }
              
              // Add deployments for this environment
              (processed[dateKey][env.id] as DeploymentData[]) = deployments;
            }
          });
        });
      } else {
        // Use primary environment dates as the authoritative set
        // First, include all dates from the primary environment
        primaryEnvDeployments.forEach((deployments, dateKey) => {
          // Skip dates with no deployments in primary environment
          if (deployments.length === 0) return;
          
          // Initialize this date in the processed data
          processed[dateKey] = {};
          environments.forEach(env => {
            processed[dateKey][env.id] = [] as DeploymentData[];
          });
          
          // Add primary environment deployments
          (processed[dateKey][primaryEnvId] as DeploymentData[]) = deployments;
          
          // Add deployments from other environments for this date
          environments.forEach(env => {
            if (env.id === primaryEnvId) return; // Skip primary, already added
            
            const envDeployments = deploymentsByEnv.get(env.id);
            if (!envDeployments) return;
            
            const dateDeployments = envDeployments.get(dateKey);
            if (dateDeployments && dateDeployments.length > 0) {
              (processed[dateKey][env.id] as DeploymentData[]) = dateDeployments;
            }
          });
        });
        
        // Add recent dates from other environments even if primary doesn't have them
        // This ensures we don't miss recent deployments in other environments
        const recentDateRange = generateDateRange().slice(0, 3); // Last 3 days
        environments.forEach(env => {
          if (env.id === primaryEnvId) return; // Skip primary
          
          const envDeployments = deploymentsByEnv.get(env.id);
          if (!envDeployments) return;
          
          recentDateRange.forEach(dateKey => {
            const dateDeployments = envDeployments.get(dateKey);
            if (dateDeployments && dateDeployments.length > 0) {
              // Create this date entry if it doesn't exist yet
              if (!processed[dateKey]) {
                processed[dateKey] = {};
                environments.forEach(e => {
                  processed[dateKey][e.id] = [] as DeploymentData[];
                });
              }
              
              // Add deployments for this environment
              (processed[dateKey][env.id] as DeploymentData[]) = dateDeployments;
            }
          });
        });
      }
            
      // Clean up the processed data to remove dates that don't have any deployments
      // This ensures we only show dates that have actual data
      Object.keys(processed).forEach(dateKey => {
        let hasDeployments = false;
        
        // Check if any environment has deployments for this date
        environments.forEach(env => {
          const deployments = processed[dateKey][env.id] as DeploymentData[];
          if (deployments && deployments.length > 0) {
            hasDeployments = true;
          }
        });
        
        // If no deployments, remove this date from the processed data
        if (!hasDeployments) {
          delete processed[dateKey];
        }
      });
      
      console.log(`Final processed data has ${Object.keys(processed).length} dates with deployments`);
      
      setProcessedData(processed);
    }
  };

  const connectToRepository = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/getRepository', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gitlabHost, repository }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to connect to repository');
      }

      const data = await response.json();
      
      // Store in localStorage
      localStorage.setItem("projectId", data.projectId.toString());
      localStorage.setItem("projectPath", data.projectPath);
      
      return data.projectId;
    } catch (error) {
      console.error('Error connecting to repository:', error);
      setError("Error connecting to repository. Please check your GitLab host and repository path.");
      return null;
    }
  };

  // State to track if refresh is in progress on server
  const [isRefreshing, setIsRefreshing] = useState(false);
  // State to track if this is a first load
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  // State to track when leader is changing
  const [isLeaderChanging, setIsLeaderChanging] = useState(false);
  
  // Helper function to reset the view state when things get stuck
  const resetView = () => {
    console.log("Resetting view state");
    
    // Reset all loading/state flags
    setLoading(false);
    setIsRefreshing(false);
    setIsLeaderChanging(false);
    
    // If we have data but it's not showing correctly, reprocess it
    if (timelineData && Object.keys(timelineData).length > 0) {
      console.log("Reprocessing existing data");
      processTimelineData(timelineData);
    }
  };

  // Function to force refresh data by clearing cache state
  const forceRefresh = () => {
    console.log("Forcing timeline data refresh");
    
    // Clear only client-side caches
    sessionStorage.removeItem("timeline_data_cache");
    sessionStorage.removeItem("timeline_last_fetch_time");
    
    // Ask user if they want to bypass server cache too
    const bypassServerCache = window.confirm(
      "Do you want to bypass server cache and fetch fresh data from GitLab?\n\n" +
      "• No: Use server cache if available (faster)\n" +
      "• Yes: Force fresh data from GitLab (slower)"
    );
    
    // Clear UI state
    setTimelineData({});
    setProcessedData({});
    
    // Trigger fetch with loading state
    setLoading(true);
    setIsRefreshing(true);
    
    // Pass user's choice about server cache
    fetchTimelineData(bypassServerCache);
  };

  // Simplified fetch function with clear state management
  const fetchTimelineData = async (forceBypass = false) => {
    // Set state to loading
    setLoading(true);
    setError(null);
    
    // Rate limit check for non-forced fetches (prevent multiple rapid fetches)
    if (!forceBypass) {
      const lastFetchTime = sessionStorage.getItem("timeline_last_fetch_time");
      if (lastFetchTime && (Date.now() - parseInt(lastFetchTime)) < 5000) {
        console.log("Skipping fetch - another fetch was triggered recently");
        setLoading(false);
        return;
      }
    }
    
    // Record fetch attempt time
    sessionStorage.setItem("timeline_last_fetch_time", Date.now().toString());
    
    console.log(`Fetching timeline data for ${selectedLeader} environments${forceBypass ? ' (forced)' : ''}`);
    
    try {
      // Get or connect to repository
      let projectId: number;
      const storedProjectId = localStorage.getItem("projectId");
      
      if (!storedProjectId) {
        console.log('No stored project ID, connecting to repository');
        const newProjectId = await connectToRepository();
        if (!newProjectId) {
          throw new Error('Failed to connect to repository');
        }
        projectId = newProjectId;
      } else {
        projectId = parseInt(storedProjectId);
      }
      
      // Fetch data for all environments
      const requests = allEnvironments.map(env => 
        fetch('/api/getTimeline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gitlabHost,
            projectId,
            environment: env.name,
            jobType: env.jobType,
            jiraRegex,
            forceRefresh: forceBypass
          })
        })
        .then(res => res.ok ? res.json() : { timeline: {} })
        .then(data => ({ 
          envId: env.id, 
          data: data.timeline || {}
        }))
        .catch(error => {
          console.error(`Error fetching ${env.id}:`, error);
          return { envId: env.id, data: {} };
        })
      );
      
      // Wait for all fetches to complete
      const results = await Promise.all(requests);
      
      // Build timeline data structure
      const newTimelineData = results.reduce((acc, result) => {
        acc[result.envId] = result.data;
        return acc;
      }, {} as TimelineData);
      
      // Cache the results
      try {
        sessionStorage.setItem("timeline_data_cache", JSON.stringify({
          data: newTimelineData,
          timestamp: Date.now(),
          leader: selectedLeader,
          alignByCommit
        }));
      } catch (e) {
        console.warn("Cache storage failed:", e);
      }
      
      // Update the UI
      console.log(`Successfully fetched data for ${Object.keys(newTimelineData).length} environments`);
      setTimelineData(newTimelineData);
      processTimelineData(newTimelineData);
      setIsFirstLoad(false);
      setIsLeaderChanging(false);
      setIsRefreshing(false);
      
    } catch (error) {
      console.error("Timeline fetch error:", error);
      setError(`Failed to load timeline data: ${error instanceof Error ? error.message : String(error)}`);
      setIsLeaderChanging(false);
      setIsRefreshing(false);
    } finally {
      // Always finish by clearing loading state
      setLoading(false);
    }
  };

  // Track if we've already fetched data in this session
  const hasInitialFetchRef = useRef(false);
  
  // Simplified component initialization and data loading
  useEffect(() => {
    console.log("Timeline component mounted or leader changed");
    
    // Always start in loading state
    setLoading(true);
    
    // Clear any previous errors
    setError(null);
    
    // Try to load from cache first
    let loadedFromCache = false;
    
    try {
      const cachedDataStr = sessionStorage.getItem("timeline_data_cache");
      if (cachedDataStr) {
        const cachedData = JSON.parse(cachedDataStr);
        
        // Check if cache is for current settings and still fresh (within 15 min)
        if (cachedData.leader === selectedLeader && 
            cachedData.alignByCommit === alignByCommit &&
            (Date.now() - cachedData.timestamp < 15 * 60 * 1000)) {
            
          console.log(`Using cached timeline data for ${selectedLeader}`);
          
          // Apply cached data
          setTimelineData(cachedData.data);
          processTimelineData(cachedData.data);
          setIsFirstLoad(false);
          setLoading(false);
          loadedFromCache = true;
        }
      }
    } catch (e) {
      console.warn("Error loading from cache:", e);
    }
    
    // If we didn't load from cache, fetch fresh data
    if (!loadedFromCache) {
      console.log(`Fetching fresh timeline data for ${selectedLeader}`);
      fetchTimelineData(false);
    }
    
    // Set up periodic refresh (every 15 minutes)
    const interval = setInterval(() => {
      if (!loading && !isRefreshing && !isLeaderChanging) {
        console.log('Running scheduled refresh');
        fetchTimelineData(false);
      }
    }, 15 * 60 * 1000);
    
    // Cleanup on unmount or leader change
    return () => {
      console.log('Cleaning up timeline effect');
      clearInterval(interval);
    };
  }, [selectedLeader]); // Only refresh when the leader changes

  const TimelineCard: React.FC<{ deployment: DeploymentData; envDisplay: string }> = ({ deployment, envDisplay }) => {
    const hasMoreTickets = deployment.tickets.length > MAX_VISIBLE_ITEMS;
    const hasMoreMRs = deployment.mrIds.length > MAX_VISIBLE_ITEMS;
    const showExpandButton = hasMoreTickets || hasMoreMRs || deployment.tickets.length + deployment.mrIds.length > MAX_VISIBLE_ITEMS;

    const handleExpand = () => {
      setSelectedDeployment({ ...deployment, envDisplay });
      setModalOpen(true);
    };

    return (
      <div className={`bg-white shadow rounded-lg p-3 ${CARD_HEIGHT} flex flex-col overflow-hidden mb-2`}>
        <div className="text-xs text-gray-600 flex items-center mb-1">
          <Clock className="h-3 w-3 mr-1" />
          {formatDate(deployment.date)}
        </div>
        <div className="text-base mb-1">
          <a
            href={`https://${gitlabHost}/${repository}/-/tags/${deployment.tag}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 hover:underline text-xs"
          >
            {deployment.tag}
          </a>
        </div>
        <div className="flex items-start mb-1">
          <GitMerge className="h-3 w-3 mr-1 text-purple-500 mt-0.5 flex-shrink-0" />
          <a
            href={`https://${gitlabHost}/${repository}/-/commit/${deployment.commitId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 hover:underline text-xs"
          >
            {deployment.commitId?deployment.commitId.substring(0,8):''}
          </a>
        </div>
        {deployment.tickets.length > 0 && (
          <div className="flex items-start mb-1">
            <Ticket className="h-3 w-3 mr-1 text-green-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs overflow-hidden">
              {deployment.tickets.slice(0, MAX_VISIBLE_ITEMS).map((ticket, i) => (
                <React.Fragment key={ticket}>
                  {i > 0 && ', '}
                  <a
                    href={`https://${jiraHost}/browse/${ticket}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {ticket}
                  </a>
                </React.Fragment>
              ))}
              {hasMoreTickets && ' ...'}
            </div>
          </div>
        )}
        {deployment.mrIds.length > 0 && (
          <div className="flex items-start">
            <GitMerge className="h-3 w-3 mr-1 text-purple-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs overflow-hidden">
              {deployment.mrIds.slice(0, MAX_VISIBLE_ITEMS).map((mrId, i) => (
                <React.Fragment key={mrId}>
                  {i > 0 && ', '}
                  <a
                    href={`https://${gitlabHost}/${repository}/-/merge_requests/${mrId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {mrId}
                  </a>
                </React.Fragment>
              ))}
              {hasMoreMRs && ' ...'}
            </div>
          </div>
        )}
        {showExpandButton && (
          <button
            onClick={handleExpand}
            className="mt-auto flex items-center justify-center text-xs text-blue-600 hover:text-blue-800"
          >
            <MoreHorizontal className="h-3 w-3 mr-1" />
            View All
          </button>
        )}
      </div>
    );
  };

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-64">
      <Clock className="animate-spin h-8 w-8 text-blue-500 mb-4" />
      <p className="text-blue-600">Loading timeline data...</p>
      <p className="text-xs text-gray-500 mt-2">
        {isRefreshing ? 
          "Refreshing data from the server..." : 
          "Loading from cache when available for better performance."}
      </p>
      {loading && isFirstLoad && (
        <p className="text-xs text-amber-600 mt-2">
          First load may take longer while server cache is built. Subsequent loads will be faster.
        </p>
      )}
    </div>
  );

  if (error) return (
    <div className="text-red-500 flex flex-col items-center justify-center h-64">
      <div className="flex items-center mb-4">
        <ExternalLink className="mr-2" />{error}
      </div>
      <button 
        onClick={() => {
          setError(null);
          setLoading(true);
          // Don't force bypass server cache on retry
          fetchTimelineData(false);
        }}
        className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-md"
      >
        Retry
      </button>
    </div>
  );
  
  // Handle case where we have no data but also no loading/error state
  if (!timelineData || Object.keys(timelineData).length === 0) return (
    <div className="flex flex-col justify-center items-center h-64">
      <p className="text-amber-600 mb-4">No timeline data available.</p>
      <button 
        onClick={() => {
          setLoading(true);
          // Don't force bypass server cache on load
          fetchTimelineData(false);
        }}
        className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md"
      >
        Load Data
      </button>
    </div>
  );

  const dates = generateDateRange();
  
  // Function to open the editor
  const handleEditLeaderConfig = (leader: string) => {
    setEditingLeader(leader);
    setSelectedEnvironments([...leaderConfigs[leader]]);
    setIsEditing(true);
  };
  
  // Function to save the edited configuration
  const handleSaveConfig = () => {
    const newConfigs = {
      ...leaderConfigs,
      [editingLeader]: selectedEnvironments
    };
    
    setLeaderConfigs(newConfigs);
    localStorage.setItem("leaderConfigs", JSON.stringify(newConfigs));
    setIsEditing(false);
    
    // Refresh the data with the new configuration
    fetchTimelineData();
  };
  
  // Function to delete a leader configuration
  const handleDeleteLeader = () => {
    if (Object.keys(leaderConfigs).length <= 1) {
      alert('Cannot delete the last leader configuration');
      return;
    }
    
    // Confirm deletion
    if (!confirm(`Are you sure you want to delete the "${editingLeader}" configuration?`)) {
      return;
    }
    
    // Create new configs without the deleted leader
    const newConfigs = { ...leaderConfigs };
    delete newConfigs[editingLeader];
    
    setLeaderConfigs(newConfigs);
    localStorage.setItem("leaderConfigs", JSON.stringify(newConfigs));
    setIsEditing(false);
    
    // Update the selected leader if needed
    if (selectedLeader === editingLeader) {
      const firstLeader = Object.keys(newConfigs)[0];
      setSelectedLeader(firstLeader);
      localStorage.setItem("selectedLeader", firstLeader);
    }
    
    // Refresh the data with the new configuration
    fetchTimelineData();
  };
  
  // Function to toggle environment selection
  const toggleEnvironment = (envId: string) => {
    if (selectedEnvironments.includes(envId)) {
      setSelectedEnvironments(selectedEnvironments.filter(id => id !== envId));
    } else {
      setSelectedEnvironments([...selectedEnvironments, envId]);
    }
  };
  
  // Function to create a new leader configuration
  const handleCreateLeader = () => {
    if (!newLeaderName || newLeaderName.trim() === '') return;
    
    // Create the new leader with no environments selected
    const newConfigs = {
      ...leaderConfigs,
      [newLeaderName.toLowerCase()]: []
    };
    
    setLeaderConfigs(newConfigs);
    localStorage.setItem("leaderConfigs", JSON.stringify(newConfigs));
    setSelectedLeader(newLeaderName.toLowerCase());
    setIsCreating(false);
    setNewLeaderName('');
    
    // Immediately open the editor for the new leader
    handleEditLeaderConfig(newLeaderName.toLowerCase());
  };
  
  return (
    <div className="container mx-auto p-4">
      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center">
          <span className="mr-2 font-medium">Leader:</span>
          <div className="relative">
            <select 
              className={`px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isLeaderChanging ? 'border-blue-500 text-gray-400' : ''
              }`}
              value={selectedLeader}
              onChange={(e) => handleLeaderChange(e.target.value)}
              disabled={isLeaderChanging}
            >
              {Object.keys(leaderConfigs).map(leader => (
                <option key={leader} value={leader}>{leader.toUpperCase()}</option>
              ))}
            </select>
            {isLeaderChanging && (
              <div className="absolute right-0 top-0 h-full flex items-center pr-2">
                <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            )}
          </div>
          <button 
            onClick={() => handleEditLeaderConfig(selectedLeader)}
            className="ml-2 px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-md text-sm"
            disabled={isLeaderChanging}
          >
            Edit
          </button>
          <button 
            onClick={() => setIsCreating(true)}
            className="ml-2 px-3 py-2 bg-green-100 hover:bg-green-200 rounded-md text-sm text-green-800"
            disabled={isLeaderChanging}
          >
            New
          </button>
          {isLeaderChanging && (
            <span className="ml-2 text-xs text-blue-600">Loading data for selected configuration...</span>
          )}
        </div>
        
        <div className="flex items-center">
          <label className={`flex items-center ${isLeaderChanging ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
            <div className="relative">
              <input 
                type="checkbox" 
                className="sr-only" 
                checked={alignByCommit}
                onChange={handleAlignToggle}
                disabled={isLeaderChanging}
              />
              <div className={`block w-14 h-8 rounded-full ${alignByCommit ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
              <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition ${alignByCommit ? 'transform translate-x-6' : ''}`}></div>
            </div>
            <div className="ml-3 text-gray-700 font-medium flex items-center">
              {alignByCommit ? "Commit View (Default)" : "Date View"}
              {isLeaderChanging && (
                <div className="ml-2 animate-spin h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              )}
            </div>
          </label>
        </div>
        
        <div className="flex items-center ml-auto gap-2">
          {/* Reset View Button - always available */}
          <button 
            onClick={resetView}
            className="flex items-center px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm text-gray-800"
            title="Reset view state without fetching new data"
          >
            <Clock className="mr-2 h-4 w-4" />
            Reset View
          </button>
        
          {/* Force Refresh Button */}
          <button 
            onClick={forceRefresh}
            className={`flex items-center px-3 py-2 ${loading || isRefreshing || isLeaderChanging ? 'bg-gray-200 cursor-not-allowed' : 'bg-blue-100 hover:bg-blue-200'} rounded-md text-sm ${loading || isRefreshing || isLeaderChanging ? 'text-gray-600' : 'text-blue-800'}`}
            title={isRefreshing ? "Refresh already in progress" : isLeaderChanging ? "Leader change in progress" : "Force refresh data"}
            disabled={loading || isRefreshing || isLeaderChanging}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading || isRefreshing ? 'animate-spin' : ''}`} />
            {loading ? 'Loading...' : isRefreshing ? 'Server Refreshing...' : 'Refresh Data'}
          </button>
          
          {/* Loading status message */}
          {(isRefreshing || isLeaderChanging) && (
            <div className="ml-2 text-xs text-amber-600">
              {isRefreshing ? 'Refresh in progress. This may take some time.' : 
               isLeaderChanging ? 'Changing view configuration...' : ''}
            </div>
          )}
        </div>
      </div>
      
      {/* Leader Config Editor Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Configure {editingLeader.toUpperCase()} Environments</h3>
            <div className="space-y-2 mb-6">
              {allEnvironments.map(env => (
                <label key={env.id} className="flex items-center p-2 hover:bg-gray-100 rounded">
                  <input
                    type="checkbox"
                    className="mr-3 h-4 w-4 text-blue-600"
                    checked={selectedEnvironments.includes(env.id)}
                    onChange={() => toggleEnvironment(env.id)}
                  />
                  <span>{env.display}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-between">
              <button
                onClick={handleDeleteLeader}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-700"
                disabled={Object.keys(leaderConfigs).length <= 1}
              >
                Delete
              </button>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveConfig}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  disabled={selectedEnvironments.length === 0}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* New Leader Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create New Leader Configuration</h3>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Leader Name
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={newLeaderName}
                onChange={(e) => setNewLeaderName(e.target.value)}
                placeholder="Enter a name (e.g. uat, prod, dev)"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 border border-gray-300 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateLeader}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                disabled={!newLeaderName || newLeaderName.trim() === ''}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Environment Headers */}
      <div className={`grid gap-4 mb-6`} 
          style={{ 
            gridTemplateColumns: `1fr ${environments.map(() => '2fr').join(' ')}` 
          }}>
        <div className="text-base font-medium text-gray-500">
          {alignByCommit ? "Commit" : "Date"}
        </div>
        {environments.map((env, envIndex) => (
          <div key={env.id} className={`${
            envIndex % 2 === 0 ? 'bg-blue-500' : 'bg-blue-600'
          } text-white p-4 rounded-lg font-semibold flex items-center`}>
            <GitCommit className="mr-2" />
            {env.display}
          </div>
        ))}
      </div>

      {/* Timeline Rows */}
      <div className="space-y-4">
        {dates.map((dateKey, rowIndex) => {
          const [day, month] = [dateKey.substring(0, 2), dateKey.substring(2, 4)];
          const date = new Date();
          date.setMonth(parseInt(month) - 1);
          date.setDate(parseInt(day));
          
          // Check if this date has any deployments for any environment
          const hasDeployments = environments.some(env => 
            (processedData[dateKey]?.[env.id]?.length || 0) > 0
          );
          
          // Skip empty dates
          if (!hasDeployments) {
            return null;
          }
          
          // Get all commits for this date (only used in alignByCommit mode)
          const dateCommits = (processedData[dateKey]?.["__commits"] as string[]) || [];
          
          return (
            <div key={dateKey} className="mb-6 border border-gray-200 rounded-lg overflow-hidden">
              {/* Date Header */}
              <div className="bg-gray-100 p-4 font-semibold border-b border-gray-200">
                {date.toLocaleDateString('en-AU', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </div>
              
              {alignByCommit ? (
                // Commit-aligned view with commits grouped by date
                <>
                  {/* Header row similar to date-based view */}
                  <div className="grid gap-4 py-2 bg-gray-50 border-b border-gray-200"
                      style={{ 
                        gridTemplateColumns: `1fr ${environments.map(() => '2fr').join(' ')}` 
                      }}>
                    <div className="p-4 font-medium text-gray-600 flex items-center">
                      <GitCommit className="h-4 w-4 mr-2" />
                      <span>Commit</span>
                    </div>
                    
                    {/* Environment headers */}
                    {environments.map((env, envIndex) => (
                      <div key={`${dateKey}-header-${env.id}`} 
                          className={`p-3 ${
                            envIndex % 2 === 0 ? 'bg-blue-50' : 'bg-blue-100'
                          }`}>
                        <span className="font-medium">{env.display}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Commits rows */}
                  {dateCommits.map((commitId, commitIndex) => {
                    // Find any deployment with this commit to show its details
                    let commitDisplayData = null;
                    for (const env of environments) {
                      const deployments = (processedData[dateKey]?.[env.id] as DeploymentData[]) || [];
                      const matchingDep = deployments.find(d => d.__commitId === commitId);
                      if (matchingDep) {
                        commitDisplayData = matchingDep;
                        break;
                      }
                    }
                    
                    if (!commitDisplayData) return null;
                    
                    return (
                      <div key={`${dateKey}-${commitId}`} 
                          className={`grid gap-4 border-b border-gray-200 py-2 ${
                            commitIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                          }`}
                          style={{ 
                            gridTemplateColumns: `1fr ${environments.map(() => '2fr').join(' ')}` 
                          }}>
                        {/* Commit ID cell */}
                        <div className="flex items-center p-4">
                          <GitCommit className="h-4 w-4 mr-2 text-gray-600" />
                          <span className="text-sm font-mono bg-gray-100 p-1 rounded text-gray-800">
                            {commitId.substring(0, 8)}
                          </span>
                        </div>
                        
                        {/* Environment cells */}
                        {environments.map((env) => {
                          // Get only deployments for this commit ID
                          const commitDeployments = ((processedData[dateKey]?.[env.id] as DeploymentData[]) || [])
                            .filter(d => d.__commitId === commitId);
                            
                          return (
                            <div key={`${dateKey}-${commitId}-${env.id}`} className="p-4">
                              {commitDeployments.map((deployment, index) => (
                                <TimelineCard
                                  key={`${deployment.tag}-${index}`}
                                  deployment={deployment}
                                  envDisplay={env.display}
                                />
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </>
              ) : (
                // Traditional date-based view - all deployments grouped by environment only
                <div className="grid gap-4 py-2"
                    style={{ 
                      gridTemplateColumns: `1fr ${environments.map(() => '2fr').join(' ')}` 
                    }}>
                  {/* Header cell */}
                  <div className="p-4 font-medium text-gray-600 flex items-center">
                    <span className="mr-2">⏱️</span>
                    <span>Deployments</span>
                  </div>
                  
                  {/* Environment headers */}
                  {environments.map((env, envIndex) => (
                    <div key={`${dateKey}-header-${env.id}`} 
                        className={`p-3 ${
                          envIndex % 2 === 0 ? 'bg-blue-50' : 'bg-blue-100'
                        }`}>
                      <span className="font-medium">{env.display}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Show deployments in standard (non-commit-aligned) mode */}
              {!alignByCommit && (
                <div className="grid gap-4"
                    style={{ 
                      gridTemplateColumns: `1fr ${environments.map(() => '2fr').join(' ')}` 
                    }}>
                  <div className="h-4"></div> {/* Spacer cell */}
                  
                  {/* Environment cells */}
                  {environments.map((env) => (
                    <div key={`${dateKey}-content-${env.id}`} className="p-4">
                      {((processedData[dateKey]?.[env.id] as DeploymentData[]) || []).map((deployment, index) => (
                        <TimelineCard
                          key={`${deployment.tag}-${index}`}
                          deployment={deployment}
                          envDisplay={env.display}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }).filter(Boolean)}
      </div>

      <DeploymentModal
        deployment={selectedDeployment}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        jiraHost={jiraHost}
        gitlabHost={gitlabHost}
        repository={repository}
      />
    </div>
  );
};

export default EnvironmentTimeline;