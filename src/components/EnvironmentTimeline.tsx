"use client"

import React, { useState, useEffect } from 'react';
import { GitCommit, GitMerge, Tag, Clock, Ticket, ExternalLink, MoreHorizontal } from 'lucide-react';
import DeploymentModal from './DeploymentModal';

interface TimelineItem {
  tag: string;
  tickets: string[];
  mrIds: string[];
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
  commitId?:string;
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
  
  // Load settings from localStorage
  useEffect(() => {
    const storedJiraHost = localStorage.getItem("jiraHost");
    const storedRepository = localStorage.getItem("repository");
    const storedGitlabHost = localStorage.getItem("gitlabHost");
    const storedJiraRegex = localStorage.getItem("jiraRegex");
    
    if (storedJiraHost) setJiraHost(storedJiraHost);
    if (storedRepository) setRepository(storedRepository);
    if (storedGitlabHost) setGitlabHost(storedGitlabHost);
    if (storedJiraRegex) setJiraRegex(storedJiraRegex);
  }, []);

  const environments: Environment[] = [
    { id: 'sit1-val', display: 'SIT1 - VAL', name: 'SIT1', jobType: 'VAL' },
    { id: 'sit1-dep', display: 'SIT1 - DEP', name: 'SIT1', jobType: 'DEP' },
    { id: 'sit2-val', display: 'SIT2 - VAL', name: 'SIT2', jobType: 'VAL' },
    { id: 'sit2-dep', display: 'SIT2 - DEP', name: 'SIT2', jobType: 'DEP' },
    { id: 'staging-dep', display: 'STAGING - DEP', name: 'STAGING', jobType: 'DEP' },
    { id: 'prod-val', display: 'PROD - VAL', name: 'PROD', jobType: 'VAL' },
  ];

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

  const processTimelineData = (data: TimelineData) => {
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
  };

  const fetchTimelineData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get stored projectId from localStorage, or ask user to connect to repository first
      const storedProjectId = localStorage.getItem("projectId");
      
      if (!storedProjectId) {
        setError('Please connect to a repository first from the Changelog Generator page');
        setLoading(false);
        return;
      }
      
      const projectId = parseInt(storedProjectId);
      
      const promises = environments.map(env =>
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
        })
      );

      const results = await Promise.all(promises);
      const newTimelineData = results.reduce<TimelineData>((acc, result, index) => {
        acc[environments[index].id] = result.timeline;
        return acc;
      }, {});

      setTimelineData(newTimelineData);
      processTimelineData(newTimelineData);
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
  }, []);

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

  return (
    <div className="container mx-auto p-4">
      {/* Environment Headers */}
      <div className="grid grid-cols-[1fr,2fr,2fr,2fr,2fr,2fr,2fr] gap-4 mb-6">
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
      <div className="space-y-0">
        {dates.map((dateKey, rowIndex) => {
          const [day, month] = [dateKey.substring(0, 2), dateKey.substring(2, 4)];
          const date = new Date();
          date.setMonth(parseInt(month) - 1);
          date.setDate(parseInt(day));
          
          return (
            <div key={dateKey} className="grid grid-cols-[1fr,2fr,2fr,2fr,2fr,2fr,2fr] gap-4">
              {/* Date cell */}
              <div className={`text-base text-gray-500 flex items-center p-4 ${
                rowIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'
              }`}>
                {date.toLocaleDateString('en-AU', {
                  day: '2-digit',
                  month: 'short'
                })}
              </div>
              
              {/* Environment cells */}
              {environments.map((env, envIndex) => (
                <div key={`${dateKey}-${env.id}`} 
                    className={`min-h-[4rem] p-4 ${
                      rowIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                    } ${
                      envIndex % 2 === 0 ? 'bg-opacity-100' : 'bg-opacity-50'
                    }`}>
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
          );
        })}
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