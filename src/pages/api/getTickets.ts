import { NextApiRequest, NextApiResponse } from "next";
import { buildGitLabApiUrl, gitlabFetch } from '@/utils/gitlab';

interface TicketInfo {
  tickets: string[];
  mrIds: string[];
}

interface GitLabCommit {
  id: string;
  short_id: string;
  title: string;
  message: string;
  created_at: string;
  author_name: string;
  author_email: string;
  parent_ids: string[];
}

const cache: { [key: string]: { [hash: string]: TicketInfo } } = {};
const MAX_CACHE_SIZE = 10;

function addToCache(key: string, value: { [hash: string]: TicketInfo }) {
  if (Object.keys(cache).length >= MAX_CACHE_SIZE) {
    const oldestKey = Object.keys(cache)[0];
    delete cache[oldestKey];
  }
  cache[key] = value;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { 
      fromCommit, 
      toCommit, 
      gitlabHost,
      projectId,
      jiraRegex 
    } = req.body;

    if (!jiraRegex) {
      return res.status(400).json({ error: 'No Jira regex provided' });
    }

    if (!gitlabHost || !projectId) {
      return res.status(400).json({ error: 'Please provide gitlabHost and projectId' });
    }

    try {
      const toRef = toCommit || 'HEAD';
      
      const correctedRegex = jiraRegex.replace(/d\+/g, '\\d+');
      const jiraTicketRegex = new RegExp(correctedRegex, 'gi');
      const ticketInfo: { [hash: string]: TicketInfo } = {};

      // Generate a cache key based on parameters
      const cacheKey = `${gitlabHost}-${projectId}-${fromCommit}-${toRef}-${jiraRegex}`;

      // Check if the result is in cache
      if (cache[cacheKey]) {
        return res.status(200).json({ ticketInfo: cache[cacheKey] });
      }

      console.log(`Fetching tickets via GitLab API for project ${projectId}`);
      
      // Get all commits between the two references
      const compareUrl = buildGitLabApiUrl(
        gitlabHost, 
        `projects/${projectId}/repository/compare?from=${fromCommit}&to=${toRef}`
      );
      console.log(`Comparing commits: ${compareUrl}`);
      
      const compareResponse = await gitlabFetch(compareUrl);
      
      if (!compareResponse.ok) {
        throw new Error(`GitLab API error: ${compareResponse.status} ${compareResponse.statusText}`);
      }
      
      const compareData = await compareResponse.json();
      
      // Process only merge commits (those with multiple parents)
      const mergeCommits = compareData.commits.filter((c: GitLabCommit) => c.parent_ids.length > 1);
      
      // Fetch each commit's full details to extract tickets and MR IDs
      for (const commit of mergeCommits) {
        // Get full commit details to extract the message
        const commitUrl = buildGitLabApiUrl(
          gitlabHost, 
          `projects/${projectId}/repository/commits/${commit.id}`
        );
        
        const commitResponse = await gitlabFetch(commitUrl);
        
        if (!commitResponse.ok) {
          console.error(`Error fetching commit ${commit.id}: ${commitResponse.status}`);
          continue;
        }
        
        const commitData = await commitResponse.json();
        const commitMessage = commitData.message || '';
        
        // Extract Jira tickets from commit message
        const matchResult = commitMessage.match(jiraTicketRegex);
        // Cast the regex matches to strings using proper TypeScript casting
        const matches: string[] = matchResult ? Array.from(matchResult).map(match => String(match)) : [];
        // Create a unique array of tickets
        const tickets: string[] = [...new Set(matches)].filter(Boolean);
        
        // Extract MR ID from commit message
        const mrIds: string[] = [];
        const mrRegex = /See merge request .*!(\d+)/;
        const mrMatch = mrRegex.exec(commitMessage);
        if (mrMatch && mrMatch[1]) {
          mrIds.push(mrMatch[1]);
        }
        
        ticketInfo[commit.id] = { tickets, mrIds };
      }

      // Add the result to cache
      addToCache(cacheKey, ticketInfo);

      res.status(200).json({ ticketInfo });
    } catch (error) {
      console.error('Error processing tickets:', error);
      res.status(500).json({ error: 'Error processing tickets. Please check your inputs and try again.' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}