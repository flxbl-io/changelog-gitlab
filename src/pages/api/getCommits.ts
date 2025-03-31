import { NextApiRequest, NextApiResponse } from 'next';
import { buildGitLabApiUrl, gitlabFetch } from '@/utils/gitlab';

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

interface Commit {
  hash: string;
  message: string;
}

interface CacheItem {
  timestamp: number;
  data: Commit[];
}

// Cache settings
const cache: { [key: string]: CacheItem } = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { 
      fromCommit, 
      toCommit = 'HEAD', 
      gitlabHost, 
      projectId
    } = req.body;

    if (!gitlabHost || !projectId) {
      return res.status(400).json({ error: 'Please provide gitlabHost and projectId' });
    }

    try {
      // Generate cache key based on parameters
      const cacheKey = `${gitlabHost}-${projectId}-${fromCommit}-${toCommit}`;
      const now = Date.now();
      const cachedItem = cache[cacheKey];

      if (cachedItem && now - cachedItem.timestamp < CACHE_DURATION) {
        // Return cached data if it's less than 5 minutes old
        console.log(`Returning cached commits for ${cacheKey}`);
        return res.status(200).json({ commits: cachedItem.data, cached: true });
      }

      console.log(`Fetching commits via GitLab API for project ${projectId}`);
      
      // Create the comparison URL - use comparison endpoint when we have both refs
      const apiUrl = buildGitLabApiUrl(
        gitlabHost, 
        `projects/${projectId}/repository/compare?from=${fromCommit}&to=${toCommit}`
      );
      console.log(`Fetching commits from: ${apiUrl}`);
      
      const response = await gitlabFetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Filter to only get merge commits (two or more parent IDs)
      const commits: Commit[] = data.commits
        .filter((commit: GitLabCommit) => commit.parent_ids.length > 1)
        .map((commit: GitLabCommit) => ({
          hash: commit.id,
          message: commit.title
        }));

      // Update cache
      cache[cacheKey] = {
        timestamp: now,
        data: commits
      };

      res.status(200).json({ commits, cached: false });
    } catch (error) {
      console.error('Error fetching commits:', error);
      res.status(500).json({ error: 'Error fetching commits. Please check your inputs and try again.' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}