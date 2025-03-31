// ChangelogForm.tsx
"use client";

import React, { useState, useEffect } from "react";
import ProgressBar from "./ProgressBar";
import CombinedChangelogTable from "./CombinedChangelogTable";
import InfoCards from "./InfoCards";
import { Commit, TicketInfoState } from "@/model/models";

export default function ChangelogForm() {
  const [fromCommit, setFromCommit] = useState("");
  const [toCommit, setToCommit] = useState("");
  const [jiraHost, setJiraHost] = useState("jira.apps.ndis.gov.au");
  const [repository, setRepository] = useState("ocio/salesforce/pace-sf");
  const [gitlabHost, setGitlabHost] = useState("gitlab.apps.ndia.gov.au");
  const [jiraRegex, setJiraRegex] = useState("(PSS-d+)|(P2B-d+)|(DIPMO-d+)|(P2CL-d+)|(GPO-d+)|(CS-d+)|(OCM-d+)|(OCM-d+)|(TS-d+)|");
  const [commits, setCommits] = useState<Commit[]>([]);
  const [ticketInfo, setTicketInfo] = useState<TicketInfoState>({});
  const [error, setError] = useState("");
  const [tagsAndBranches, setTagsAndBranches] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [projectPath, setProjectPath] = useState<string | null>(null);

  useEffect(() => {
    const storedFromCommit = localStorage.getItem("fromCommit");
    const storedToCommit = localStorage.getItem("toCommit");
    const storedJiraHost = localStorage.getItem("jiraHost");
    const storedJiraRegex = localStorage.getItem("jiraRegex");
    const storedRepository = localStorage.getItem("repository");
    const storedGitlabHost = localStorage.getItem("gitlabHost");
    const storedProjectId = localStorage.getItem("projectId");
    const storedProjectPath = localStorage.getItem("projectPath");

    if (storedFromCommit) setFromCommit(storedFromCommit);
    if (storedToCommit) setToCommit(storedToCommit);
    if (storedJiraHost) setJiraHost(storedJiraHost);
    if (storedJiraRegex) setJiraRegex(storedJiraRegex);
    if (storedRepository) setRepository(storedRepository);
    if (storedGitlabHost) setGitlabHost(storedGitlabHost);
    if (storedProjectId) setProjectId(parseInt(storedProjectId));
    if (storedProjectPath) setProjectPath(storedProjectPath);

    // If we have stored project info, try to fetch tags right away
    if (storedProjectId && storedGitlabHost) {
      fetchTagsAndBranches(storedGitlabHost, parseInt(storedProjectId));
    } else if (gitlabHost && repository) {
      connectToRepository();
    }
  }, []);

  const fetchTagsAndBranches = async (host: string, id: number) => {
    if (!id || !host) return;
    
    setIsFetching(true);
    try {
      // Fetch tags and branches in parallel
      const [tagsResponse, branchesResponse] = await Promise.all([
        fetch('/api/getTags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            gitlabHost: host,
            projectId: id
          }),
        }),
        fetch('/api/getAllBranches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            gitlabHost: host,
            projectId: id
          }),
        })
      ]);
      
      if (!tagsResponse.ok) {
        const errorData = await tagsResponse.json();
        throw new Error(errorData.error || 'Error fetching tags');
      }
      
      if (!branchesResponse.ok) {
        const errorData = await branchesResponse.json();
        throw new Error(errorData.error || 'Error fetching branches');
      }
      
      const tagsData = await tagsResponse.json();
      const branchesData = await branchesResponse.json();
      
      // Combine tags from getTags and branches from getAllBranches
      const allRefs = [
        ...tagsData.tagsAndBranches, 
        ...branchesData.updatedBranches || []
      ];
      
      // Remove duplicates
      const uniqueRefs = [...new Set(allRefs)];
      
      setTagsAndBranches(uniqueRefs);
    } catch (error) {
      console.error('Error fetching refs from GitLab API:', error);
      setError("Error fetching tags and branches from GitLab. Please check your connection and try again.");
    }
    setIsFetching(false);
  };

  const connectToRepository = async () => {
    setIsConnecting(true);
    setIsLoading(true);
    setError("");
    
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
      setProjectId(data.projectId);
      setProjectPath(data.projectPath);
      
      // Store in localStorage
      localStorage.setItem("projectId", data.projectId.toString());
      localStorage.setItem("projectPath", data.projectPath);
      
      // Now fetch tags using GitLab API
      await fetchTagsAndBranches(gitlabHost, data.projectId);
      
    } catch (error) {
      console.error('Error connecting to repository:', error);
      setError("Error connecting to repository. Please check your GitLab host and repository path.");
    }
    
    setIsConnecting(false);
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    
    if (!projectId) {
      setError("Please connect to a repository first");
      setIsLoading(false);
      return;
    }
    
    try {
      const [commitResponse, ticketResponse] = await Promise.all([
        fetch("/api/getCommits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            fromCommit, 
            toCommit, 
            gitlabHost, 
            projectId 
          }),
        }),
        fetch("/api/getTickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            fromCommit, 
            toCommit, 
            gitlabHost, 
            projectId, 
            jiraRegex 
          }),
        }),
      ]);

      if (!commitResponse.ok || !ticketResponse.ok) {
        const commitError = !commitResponse.ok ? await commitResponse.json() : null;
        const ticketError = !ticketResponse.ok ? await ticketResponse.json() : null;
        throw new Error(
          commitError?.error || ticketError?.error || "Failed to fetch data"
        );
      }

      const commitData = await commitResponse.json();
      const ticketData = await ticketResponse.json();

      setCommits(commitData.commits);
      setTicketInfo(ticketData.ticketInfo);
    } catch (error) {
      console.error("Error fetching data:", error);
      setError("Error fetching data. Please check your inputs and try again.");
    }
    
    setIsLoading(false);
  };

  const handleInputChange = (field: string, value: string) => {
    // Update form field value in state and localStorage
    switch (field) {
      case "fromCommit":
        setFromCommit(value);
        localStorage.setItem("fromCommit", value);
        break;
      case "toCommit":
        setToCommit(value);
        localStorage.setItem("toCommit", value);
        break;
      case "jiraHost":
        setJiraHost(value);
        localStorage.setItem("jiraHost", value);
        break;
      case "jiraRegex":
        setJiraRegex(value);
        localStorage.setItem("jiraRegex", value);
        break;
      case "repository":
        setRepository(value);
        localStorage.setItem("repository", value);
        break;
      case "gitlabHost":
        setGitlabHost(value);
        localStorage.setItem("gitlabHost", value);
        break;
      default:
        break;
    }
  };

  const getTimeGenerated = () => {
    const now = new Date();
    return now.toLocaleString();
  };

  const countMergeRequests = () => {
    const mrIds = Object.values(ticketInfo).flatMap((info) => info.mrIds);
    return mrIds.length;
  };

  return (
    <div className="container mx-auto p-4">
      <ProgressBar isLoading={isLoading || isFetching || isConnecting} />
      <h1 className="text-3xl font-bold mb-6">Changelog Generator</h1>

      <div className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <input
              type="text"
              id="gitlabHost"
              value={gitlabHost}
              onChange={(e) => handleInputChange("gitlabHost", e.target.value)}
              placeholder="GitLab Host (e.g. gitlab.com)"
              className="w-full px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="text"
              id="repository"
              value={repository}
              onChange={(e) => handleInputChange("repository", e.target.value)}
              placeholder="Repository Path (e.g. group/project)"
              className="w-full px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={connectToRepository}
              disabled={isConnecting || !repository || !gitlabHost}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded disabled:opacity-50"
            >
              {isConnecting ? "Connecting..." : "Connect to Repository"}
            </button>
            {projectId && (
              <div className="ml-4 text-green-600">
                ✓ Connected to Project ID: {projectId}
              </div>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mb-8 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div className="relative">
              <input
                type="text"
                id="fromCommit"
                value={fromCommit}
                onChange={(e) => handleInputChange("fromCommit", e.target.value)}
                placeholder="From Commit/Tag/Branch"
                className="w-full px-3 py-2 pr-24 bg-white border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <select
                value={fromCommit}
                onChange={(e) => handleInputChange("fromCommit", e.target.value)}
                className="absolute right-0 top-0 bottom-0 px-2 py-2 border-l bg-white rounded-r-md focus:outline-none"
              >
                <option value="">Select</option>
                {tagsAndBranches.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative">
              <input
                type="text"
                id="toCommit"
                value={toCommit}
                onChange={(e) => handleInputChange("toCommit", e.target.value)}
                placeholder="To Commit/Tag/Branch (defaults to HEAD)"
                className="w-full px-3 py-2 pr-24 border bg-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={toCommit}
                onChange={(e) => handleInputChange("toCommit", e.target.value)}
                className="absolute right-0 top-0 bottom-0 px-2 py-2 border-l bg-white rounded-r-md focus:outline-none"
              >
                <option value="">Select</option>
                {tagsAndBranches.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-4">
            <input
              type="text"
              id="jiraHost"
              value={jiraHost}
              onChange={(e) => handleInputChange("jiraHost", e.target.value)}
              placeholder="Jira Host"
              className="w-full px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="text"
              id="jiraRegex"
              value={jiraRegex}
              onChange={(e) => handleInputChange("jiraRegex", e.target.value)}
              placeholder="Jira Ticket Regex"
              className="w-full px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>
        <div className="flex space-x-4">
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded"
            disabled={isLoading || !projectId}
          >
            {isLoading ? "Generating..." : "Generate Changelog"}
          </button>
          
          {projectId && (
            <button
              type="button"
              onClick={() => fetchTagsAndBranches(gitlabHost, projectId)}
              disabled={isFetching}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded disabled:opacity-50"
            >
              {isFetching ? "Refreshing..." : "Refresh Tags & Branches"}
            </button>
          )}
        </div>
      </form>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      <div className="gap-8">
        {commits.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-semibold mb-4">Changelog</h2>
            <InfoCards
              commitsCount={commits.length}
              mergeRequestsCount={countMergeRequests()}
              generatedAt={getTimeGenerated()}
            />
            <CombinedChangelogTable
              commits={commits}
              ticketInfo={ticketInfo}
              jiraHost={jiraHost}
              gitlabHost={gitlabHost}
              repository={repository}
            />
          </div>
        )}
      </div>
    </div>
  );
}
