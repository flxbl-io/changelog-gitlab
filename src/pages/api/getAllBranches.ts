
import { NextApiRequest, NextApiResponse } from 'next';
import { buildGitLabApiUrl, fetchAllPages } from '@/utils/gitlab';

interface GitLabBranch {
  name: string;
  commit: {
    id: string;
    short_id: string;
    created_at: string;
    committed_date: string;
  };
  merged: boolean;
  protected: boolean;
  developers_can_push: boolean;
  developers_can_merge: boolean;
  can_push: boolean;
  default: boolean;
  web_url: string;
}

// Cache configuration
let updateInProgress = false;
let lastUpdateTimestamp = 0;
const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
let cachedBranches: Record<string, string[]> = {}; // Key: project_id

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { gitlabHost, projectId } = req.body;
    
    if (!gitlabHost || !projectId) {
      return res.status(400).json({ error: 'GitLab host and project ID are required' });
    }
    
    const cacheKey = `${gitlabHost}-${projectId}`;
    
    try {
      // Check if an update is already in progress
      if (updateInProgress) {
        console.log('Update already in progress. Serving cached branches.');
        return res.status(200).json({
          message: 'Update already in progress. Serving cached branches.',
          updatedBranches: cachedBranches[cacheKey] || []
        });
      }
      
      // Check if the branches were updated recently
      const currentTimestamp = Date.now();
      if (cachedBranches[cacheKey] && currentTimestamp - lastUpdateTimestamp < UPDATE_INTERVAL) {
        console.log('Skipping update as branches were recently updated. Serving cached branches.');
        return res.status(200).json({
          message: 'Branches were recently updated. Skipping update. Serving cached branches.',
          updatedBranches: cachedBranches[cacheKey]
        });
      }
      
      // Lock the update process
      updateInProgress = true;
      
      // Regex pattern for branches to include
      const includeBranchPattern = /^(?:env|val|int|release)\/.*/;
      
      console.log(`Fetching branches for project ${projectId} from GitLab API`);
      
      // Fetch all branches using GitLab API
      const branches = await fetchAllPages<GitLabBranch>(
        buildGitLabApiUrl(gitlabHost, `projects/${projectId}/repository/branches?sort=updated_desc`),
        10 // Fetch up to 10 pages (1000 branches)
      );
      
      // Sort by last commit date (newest first)
      const sortedBranches = branches.sort((a, b) => {
        const dateA = new Date(a.commit.committed_date || a.commit.created_at);
        const dateB = new Date(b.commit.committed_date || b.commit.created_at);
        return dateB.getTime() - dateA.getTime();
      });
      
      // Filter branches to only include those matching the pattern
      const filteredBranches = sortedBranches
        .filter(branch => includeBranchPattern.test(branch.name))
        .map(branch => branch.name);
      
      console.log(`Found ${filteredBranches.length} branches matching pattern out of ${branches.length} total branches`);
      
      // Update cache
      lastUpdateTimestamp = currentTimestamp;
      cachedBranches[cacheKey] = filteredBranches;
      
      // Unlock the update process
      updateInProgress = false;
      
      // Return the updated branches
      res.status(200).json({
        message: 'Branches fetched successfully via GitLab API.',
        updatedBranches: filteredBranches
      });
      
    } catch (error) {
      console.error('Error fetching branches from GitLab API:', error);
      
      // Unlock the update process in case of an error
      updateInProgress = false;
      
      res.status(500).json({ 
        error: 'Error fetching branches. Please check your GitLab host and project ID.'
      });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
