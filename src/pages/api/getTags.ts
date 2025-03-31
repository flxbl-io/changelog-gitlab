import { NextApiRequest, NextApiResponse } from 'next';
import { buildGitLabApiUrl, fetchAllPages } from '@/utils/gitlab';

interface CacheItem {
  timestamp: number;
  data: string[];
}

interface GitLabTag {
  name: string;
  commit: { id: string; short_id: string; created_at: string; };
}

interface GitLabBranch {
  name: string;
  commit: { id: string; short_id: string; created_at: string; };
}

const cache: { [key: string]: CacheItem } = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const MAX_PAGES = 5; // Maximum number of pages to fetch (500 items at 100 per page)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { gitlabHost, projectId } = req.body;
    
    if (!gitlabHost || !projectId) {
      return res.status(400).json({ error: 'Please provide gitlabHost and projectId' });
    }

    // Generate cache key based on parameters
    const cacheKey = `${gitlabHost}-${projectId}`;
    const now = Date.now();
    const cachedItem = cache[cacheKey];

    if (cachedItem && now - cachedItem.timestamp < CACHE_DURATION) {
      // Return cached data if it's less than 5 minutes old
      return res.status(200).json({ tagsAndBranches: cachedItem.data, cached: true });
    }

    try {
      console.log(`Fetching tags and branches via GitLab API for project ${projectId}`);
      
      // Fetch all pages of tags and branches in parallel
      const [tags, branches] = await Promise.all([
        fetchAllPages<GitLabTag>(
          buildGitLabApiUrl(gitlabHost, `projects/${projectId}/repository/tags`),
          MAX_PAGES
        ),
        fetchAllPages<GitLabBranch>(
          buildGitLabApiUrl(gitlabHost, `projects/${projectId}/repository/branches`),
          MAX_PAGES
        )
      ]);

      console.log(`Fetched ${tags.length} tags and ${branches.length} branches`);

      // Combine tags and branches into a single array of names
      const tagsAndBranches = [
        ...tags.map(tag => tag.name),
        ...branches.map(branch => branch.name)
      ];

      // Update cache
      cache[cacheKey] = {
        timestamp: now,
        data: tagsAndBranches
      };

      res.status(200).json({ 
        tagsAndBranches, 
        cached: false,
        counts: {
          tags: tags.length,
          branches: branches.length,
          total: tagsAndBranches.length
        } 
      });
    } catch (error) {
      console.error('Error retrieving tags and branches:', error);
      res.status(500).json({ error: 'Error retrieving tags and branches.' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}