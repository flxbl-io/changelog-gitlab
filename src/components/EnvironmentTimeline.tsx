"use client"

import React, { useState, useEffect } from 'react';
import { GitCommit, GitMerge, Tag, Clock, Ticket, ExternalLink, MoreHorizontal } from 'lucide-react';
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
  // Don't need to redeclare commitId since it's inherited from TimelineItem
}

interface ProcessedData {
  [dateKey: string]: {
    [envId: string]: DeploymentData[];
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
  
  // Handle leader selection change
  const handleLeaderChange = (leader: string) => {
    setSelectedLeader(leader);
    localStorage.setItem("selectedLeader", leader);
  };
  
  // Handle alignment toggle
  const handleAlignToggle = () => {
    const newValue = !alignByCommit;
    setAlignByCommit(newValue);
    localStorage.setItem("alignByCommit", String(newValue));
  };

  const parseDate = (tag: string): Date => {
    const datePart = tag.split('_')[2];
    let day = 0, month = 0, year = 0;
    
    // Handle both date formats, but keep original time
    if (datePart.startsWith('2024')) {
      year = parseInt(datePart.substring(0, 4));
      month = parseInt(datePart.substring(4, 6)) - 1;
      day = parseInt(datePart.substring(6, 8));
      const hour = parseInt(datePart.substring(9, 11));
      const minute = parseInt(datePart.substring(11, 13));
      const second = parseInt(datePart.substring(13, 15));
      return new Date(year, month, day, hour, minute, second);
    } else {
      day = parseInt(datePart.substring(0, 2));
      month = parseInt(datePart.substring(2, 4)) - 1;
      year = parseInt(datePart.substring(4, 8));
      const hour = parseInt(datePart.substring(9, 11));
      const minute = parseInt(datePart.substring(11, 13));
      const second = parseInt(datePart.substring(13, 15));
      return new Date(year, month, day, hour, minute, second);
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

  const processTimelineData = (data: TimelineData) => {
    if (alignByCommit) {
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
          processed[dateKey]["__commits"] = [];
        }
        processed[dateKey]["__commits"].push(commitData.commitId);
        
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
            
            processed[dateKey][env.id].push(...taggedDeployments);
          }
        });
      });
      
      // Sort deployments within each date and environment by time
      Object.keys(processed).forEach(dateKey => {
        Object.keys(processed[dateKey]).forEach(envId => {
          if (envId !== "__commits") {
            processed[dateKey][envId].sort((a, b) => b.date.getTime() - a.date.getTime());
          }
        });
        
        // Also sort commits within each date
        if (processed[dateKey]["__commits"]) {
          processed[dateKey]["__commits"].sort((commitIdA, commitIdB) => {
            const dateA = commitMap[commitIdA]?.firstDate || new Date(0);
            const dateB = commitMap[commitIdB]?.firstDate || new Date(0);
            return dateB.getTime() - dateA.getTime();
          });
        }
      });
      
      setProcessedData(processed);
    } else {
      // Traditional date-based processing
      const processed: ProcessedData = {};
      
      // Initialize all dates with empty arrays
      generateDateRange().forEach(dateKey => {
        processed[dateKey] = {};
        environments.forEach(env => {
          processed[dateKey][env.id] = [];
        });
      });
  
      // Fill in the deployments
      Object.entries(data).forEach(([envId, envData]) => {
        Object.entries(envData).forEach(([tag, deployment]) => {
          const date = parseDate(tag);
          const dateKey = getDateKey(date);
          
          if (processed[dateKey]) {  // Only process if date is within our range
            if (!processed[dateKey][envId]) {
              processed[dateKey][envId] = [];
            }
            processed[dateKey][envId].push({
              ...deployment,
              tag,
              date, // Keep original timestamp
            });
          }
        });
      });
      
      // Sort deployments within each date and environment by time
      Object.keys(processed).forEach(dateKey => {
        Object.keys(processed[dateKey]).forEach(envId => {
          processed[dateKey][envId].sort((a, b) => b.date.getTime() - a.date.getTime());
        });
      });
      
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

  const fetchTimelineData = async () => {
    // Clear previous data when changing configurations
    setTimelineData({});
    setProcessedData({});
    setLoading(true);
    setError(null);
    try {
      // Get stored projectId from localStorage, or connect to repository first
      let storedProjectId = localStorage.getItem("projectId");
      let projectId: number;
      
      if (!storedProjectId) {
        console.log('No stored project ID found, attempting to connect to repository');
        const newProjectId = await connectToRepository();
        if (!newProjectId) {
          setError('Failed to connect to repository. Please check settings and try again.');
          setLoading(false);
          return;
        }
        projectId = newProjectId;
      } else {
        projectId = parseInt(storedProjectId);
      }
      
      // Always fetch ALL environments data to keep both SIT1 and SIT2 data cached
      const promises = allEnvironments.map(env =>
        fetch('/api/getTimeline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gitlabHost,
            projectId,
            environment: env.name,
            jobType: env.jobType,
            jiraRegex
          }),
        }).then(res => {
          if (!res.ok) {
            throw new Error(`Error fetching timeline for ${env.display}: ${res.status}`);
          }
          return res.json();
        }).then(result => ({
          envId: env.id,
          data: result.timeline
        }))
      );

      const results = await Promise.all(promises);
      const newTimelineData = results.reduce<TimelineData>((acc, result) => {
        acc[result.envId] = result.data;
        return acc;
      }, {});

      setTimelineData(newTimelineData);
      processTimelineData(newTimelineData);
      console.log(`Fetched timeline data for ALL environments: ${allEnvironments.map(e => e.id).join(', ')}`);
    } catch (err) {
      setError('Failed to fetch timeline data: ' + (err instanceof Error ? err.message : String(err)));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimelineData();
    const interval = setInterval(fetchTimelineData, 10 * 60 * 1000); // Update every 10 minutes
    return () => clearInterval(interval);
  }, [selectedLeader, alignByCommit]);

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
    <div className="flex justify-center items-center h-64">
      <Clock className="animate-spin h-8 w-8 text-blue-500" />
    </div>
  );

  if (error) return (
    <div className="text-red-500 flex items-center justify-center h-64">
      <ExternalLink className="mr-2" />{error}
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
          <select 
            className="px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedLeader}
            onChange={(e) => handleLeaderChange(e.target.value)}
          >
            {Object.keys(leaderConfigs).map(leader => (
              <option key={leader} value={leader}>{leader.toUpperCase()}</option>
            ))}
          </select>
          <button 
            onClick={() => handleEditLeaderConfig(selectedLeader)}
            className="ml-2 px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-md text-sm"
          >
            Edit
          </button>
          <button 
            onClick={() => setIsCreating(true)}
            className="ml-2 px-3 py-2 bg-green-100 hover:bg-green-200 rounded-md text-sm text-green-800"
          >
            New
          </button>
        </div>
        
        <div className="flex items-center">
          <label className="flex items-center cursor-pointer">
            <div className="relative">
              <input 
                type="checkbox" 
                className="sr-only" 
                checked={alignByCommit}
                onChange={handleAlignToggle}
              />
              <div className={`block w-14 h-8 rounded-full ${alignByCommit ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
              <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition ${alignByCommit ? 'transform translate-x-6' : ''}`}></div>
            </div>
            <div className="ml-3 text-gray-700 font-medium">
              {alignByCommit ? "Commit View (Default)" : "Date View"}
            </div>
          </label>
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
        <div className="text-base font-medium text-gray-500">Date</div>
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
          const dateCommits = processedData[dateKey]?.["__commits"] || [];
          
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
                // Commit-aligned view - group deployments by commit within each date
                dateCommits.map((commitId, commitIndex) => {
                  // Find any deployment with this commit to show its details
                  let commitDisplayData = null;
                  for (const env of environments) {
                    const deployments = processedData[dateKey]?.[env.id] || [];
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
                          commitIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                        }`}
                        style={{ 
                          gridTemplateColumns: `1fr ${environments.map(() => '2fr').join(' ')}` 
                        }}>
                      {/* Commit ID cell */}
                      <div className="flex items-center p-4">
                        <span className="text-sm font-mono bg-gray-100 p-1 rounded text-gray-800">
                          {commitId.substring(0, 8)}
                        </span>
                      </div>
                      
                      {/* Environment cells */}
                      {environments.map((env) => {
                        // Get only deployments for this commit ID
                        const commitDeployments = processedData[dateKey]?.[env.id]
                          ?.filter(d => d.__commitId === commitId) || [];
                          
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
                })
              ) : (
                // Traditional date-based view - all deployments grouped by environment only
                <div className="grid gap-4 py-2"
                    style={{ 
                      gridTemplateColumns: `1fr ${environments.map(() => '2fr').join(' ')}` 
                    }}>
                  {/* Header cell - labels */}
                  <div className="p-4 font-medium text-gray-600">
                    Environments
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
                      {processedData[dateKey]?.[env.id]?.map((deployment, index) => (
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