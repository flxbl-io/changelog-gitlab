import { NextApiRequest, NextApiResponse } from "next";
import { buildGitLabApiUrl, gitlabFetch, fetchAllPages } from "@/utils/gitlab";

interface TimelineItem {
  tag: string;
  commitId?: string;
  tickets: string[];
  mrIds: string[];
}

interface DeploymentTimeline {
  [tag: string]: TimelineItem;
}

interface GitLabTag {
  name: string;
  commit: { 
    id: string; 
    short_id: string; 
    created_at: string;
    message?: string;
  };
  message?: string;
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

// Enhanced in-memory cache with more metadata
interface CacheEntry {
  timestamp: number;
  data: DeploymentTimeline;
  hitCount: number;
  lastAccessed: number;
  isRefreshing: boolean;
  refreshStartTime?: number;
}

// Global cache storage (persists between API calls but not server restarts)
const cache: { [key: string]: CacheEntry } = {};

// Cache settings
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes for normal cache
const LONG_CACHE_DURATION = 120 * 60 * 1000; // 2 hours for frequently accessed cache
const REFRESH_TIMEOUT = 60 * 1000; // Consider a refresh operation stale after 60 seconds
const MAX_CACHE_SIZE = 50; // Maximum number of entries to keep in cache
const CACHE_CLEANUP_PROBABILITY = 0.1; // 10% chance to run cleanup on each request

// Function to clean up old cache entries
function cleanupCache() {
  const cacheEntries = Object.entries(cache);
  
  // Exit early if cache isn't large enough to need cleanup
  if (cacheEntries.length < MAX_CACHE_SIZE) {
    return;
  }
  
  console.log(`Cache cleanup triggered - entries: ${cacheEntries.length}`);
  
  // Sort entries by last accessed time (oldest first)
  const sortedEntries = cacheEntries.sort(([, entryA], [, entryB]) => 
    entryA.lastAccessed - entryB.lastAccessed
  );
  
  // Remove entries until we're back under the limit
  // Keep the most recently accessed entries
  const entriesToRemove = sortedEntries.slice(0, sortedEntries.length - MAX_CACHE_SIZE);
  
  for (const [key] of entriesToRemove) {
    console.log(`Removing old cache entry: ${key}`);
    delete cache[key];
  }
  
  console.log(`Cache cleanup complete - removed ${entriesToRemove.length} entries`);
}

// Fetch tags matching a specific pattern
async function getDeploymentTags(
  gitlabHost: string,
  projectId: number,
  environment: string,
  jobType: string
): Promise<GitLabTag[]> {
  console.log(`Fetching tags for project ${projectId}, environment ${environment}, jobType ${jobType}`);
  
  // Fetch all tags
  const allTags = await fetchAllPages<GitLabTag>(
    buildGitLabApiUrl(gitlabHost, `projects/${projectId}/repository/tags`),
    10 // Maximum 10 pages of tags
  );
  
  // Regex pattern for strict tag format: ENV_TYPE_YYYYMMDD-HHMMSS
  const tagPattern = new RegExp(`^${environment}_${jobType}_\\d{8}-\\d{6}$`);
  
  // Filter tags by pattern and sort by creation date
  const filteredTags = allTags
    .filter(tag => tagPattern.test(tag.name))
    .sort((a, b) => {
      // Extract date parts from tag names
      const dateA = a.name.split('_')[2]; // YYYYMMDD-HHMMSS
      const dateB = b.name.split('_')[2]; // YYYYMMDD-HHMMSS
      return dateA.localeCompare(dateB); // Sort chronologically
    });
  
  console.log(`Found ${filteredTags.length} deployment tags for ${environment}_${jobType}`);
  return filteredTags;
}

// Extract Jira tickets and MR IDs from commits between two tags
async function getTicketsAndMRs(
  gitlabHost: string,
  projectId: number,
  fromTag: string,
  toTag: string,
  jiraRegex: string
): Promise<TimelineItem> {
  console.log(`Fetching commits between ${fromTag} and ${toTag}`);
  
  // Get commits between two tags
  const compareUrl = buildGitLabApiUrl(
    gitlabHost, 
    `projects/${projectId}/repository/compare?from=${fromTag}&to=${toTag}`
  );
  
  const compareResponse = await gitlabFetch(compareUrl);
  
  if (!compareResponse.ok) {
    throw new Error(`GitLab API error: ${compareResponse.status} ${compareResponse.statusText}`);
  }
  
  const compareData = await compareResponse.json();
  const mergeCommits = compareData.commits.filter((c: GitLabCommit) => c.parent_ids.length > 1);
  
  // Correct the regex pattern
  const correctedRegex = jiraRegex.replace(/d\+/g, '\\d+');
  const jiraTicketRegex = new RegExp(correctedRegex, 'gi');
  const mrRegex = /See merge request .*!(\d+)/;
  
  const tickets = new Set<string>();
  const mrIds = new Set<string>();
  
  // Process each merge commit to extract tickets and MR IDs
  for (const commit of mergeCommits) {
    // Fetch full commit message if needed
    let commitMessage = commit.message;
    
    if (!commitMessage || commitMessage.length < 10) {
      const commitUrl = buildGitLabApiUrl(
        gitlabHost, 
        `projects/${projectId}/repository/commits/${commit.id}`
      );
      const commitResponse = await gitlabFetch(commitUrl);
      
      if (commitResponse.ok) {
        const commitData = await commitResponse.json();
        commitMessage = commitData.message || '';
      }
    }
    
    // Extract Jira tickets
    const matchResult = commitMessage.match(jiraTicketRegex);
    // Properly handle the RegExpMatchArray
    if (matchResult) {
      Array.from(matchResult).forEach(ticket => tickets.add(String(ticket)));
    }
    
    // Extract MR ID
    const mrMatch = mrRegex.exec(commitMessage);
    if (mrMatch) {
      mrIds.add(mrMatch[1]);
    }
  }
  
  // Get the commit ID for the tag
  const tagInfoUrl = buildGitLabApiUrl(
    gitlabHost, 
    `projects/${projectId}/repository/tags/${encodeURIComponent(toTag)}`
  );
  
  const tagResponse = await gitlabFetch(tagInfoUrl);
  let commitId: string | undefined;
  
  if (tagResponse.ok) {
    const tagInfo = await tagResponse.json();
    commitId = tagInfo.commit?.id;
  }
  
  return {
    tag: toTag,
    commitId,
    tickets: Array.from(tickets),
    mrIds: Array.from(mrIds)
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    // Randomly run cache cleanup to prevent memory leaks (10% probability)
    if (Math.random() < CACHE_CLEANUP_PROBABILITY) {
      cleanupCache();
    }
    
    const { 
      gitlabHost, 
      projectId, 
      environment, 
      jobType, 
      jiraRegex,
      forceRefresh = false  // New parameter to force refresh
    } = req.body;

    if (!gitlabHost || !projectId || !environment || !jobType || !jiraRegex) {
      return res.status(400).json({ 
        error: 'Missing required parameters. Please provide gitlabHost, projectId, environment, jobType, and jiraRegex' 
      });
    }

    const cacheKey = `${gitlabHost}-${projectId}-${environment}-${jobType}-${jiraRegex}`;
    const now = Date.now();

    // Check for existing refresh operation
    if (cache[cacheKey]?.isRefreshing) {
      // Check if the refresh operation has timed out
      const refreshStartTime = cache[cacheKey].refreshStartTime || 0;
      const isRefreshStale = now - refreshStartTime > REFRESH_TIMEOUT;
      
      if (!isRefreshStale) {
        console.log(`Refresh already in progress for ${environment}_${jobType}, returning cached data`);
        // Return the existing cached data with a flag indicating refresh in progress
        return res.status(200).json({ 
          timeline: cache[cacheKey].data, 
          cached: true,
          refreshInProgress: true,
          cacheAge: now - cache[cacheKey].timestamp,
          hitCount: cache[cacheKey].hitCount
        });
      } else {
        // Reset stale refresh flag
        console.log(`Stale refresh detected for ${environment}_${jobType}, resetting`);
        cache[cacheKey].isRefreshing = false;
      }
    }

    // Check if we have a valid cache entry
    if (cache[cacheKey] && !forceRefresh) {
      // Update cache metadata regardless of whether we use it
      cache[cacheKey].hitCount += 1;
      cache[cacheKey].lastAccessed = now;
      
      // Determine cache validity - higher hit count gives longer validity
      const effectiveCacheDuration = 
        cache[cacheKey].hitCount > 5 ? LONG_CACHE_DURATION : CACHE_DURATION;
      
      // Check if the cache is still valid
      if (now - cache[cacheKey].timestamp < effectiveCacheDuration) {
        console.log(`Using cached timeline data for ${environment}_${jobType}, hit count: ${cache[cacheKey].hitCount}`);
        return res.status(200).json({ 
          timeline: cache[cacheKey].data, 
          cached: true,
          cacheAge: now - cache[cacheKey].timestamp,
          hitCount: cache[cacheKey].hitCount
        });
      }
      
      console.log(`Cache expired for ${environment}_${jobType}, fetching fresh data`);
    } else if (forceRefresh) {
      console.log(`Force refresh requested for ${environment}_${jobType}`);
    } else {
      console.log(`No cache entry found for ${environment}_${jobType}, creating new entry`);
    }
    
    // Set refresh lock to prevent concurrent refreshes
    if (cache[cacheKey]) {
      cache[cacheKey].isRefreshing = true;
      cache[cacheKey].refreshStartTime = now;
    } else {
      cache[cacheKey] = {
        timestamp: now,
        data: {},
        hitCount: 0,
        lastAccessed: now,
        isRefreshing: true,
        refreshStartTime: now
      };
    }

    try {
      // Get tags matching the deployment pattern
      const deploymentTags = await getDeploymentTags(gitlabHost, projectId, environment, jobType);
      let timeline: DeploymentTimeline = {};

      if (deploymentTags.length > 0) {
        // Process the tags in chronological order (oldest to newest)
        for (let i = 0; i < deploymentTags.length; i++) {
          const currentTag = deploymentTags[i].name;
          const previousTag = i > 0 ? deploymentTags[i - 1].name : null;

          if (previousTag) {
            timeline[currentTag] = await getTicketsAndMRs(gitlabHost, projectId, previousTag, currentTag, jiraRegex);
          } else {
            // This is the oldest tag, treat it as the baseline
            timeline[currentTag] = {
              tag: currentTag,
              commitId: deploymentTags[i].commit.id,
              tickets: [],
              mrIds: []
            };
          }
        }

        // Reverse the timeline to have the most recent deployments first
        timeline = Object.fromEntries(
          Object.entries(timeline).reverse()
        );
      }

      // Update the cache entry with new data and release the refresh lock
      if (cache[cacheKey]) {
        cache[cacheKey] = {
          ...cache[cacheKey],
          timestamp: now,
          data: timeline,
          lastAccessed: now,
          isRefreshing: false,  // Release the lock
          refreshStartTime: undefined
        };
        // Increment hit count only if it's an existing entry
        cache[cacheKey].hitCount += 1;
      } else {
        // Create new entry
        cache[cacheKey] = {
          timestamp: now,
          data: timeline,
          hitCount: 1,
          lastAccessed: now,
          isRefreshing: false
        };
      }

      // Add cache control headers to help browser caching
      res.setHeader('Cache-Control', 'max-age=300, stale-while-revalidate=600');
      
      // Return the data with cache information
      res.status(200).json({ 
        timeline, 
        cached: false,
        refreshCompleted: true,
        cacheCreated: now,
        cachedEntriesCount: Object.keys(cache).length 
      });
    } catch (error) {
      console.error('Error retrieving deployment timeline:', error);
      
      // Release the refresh lock in case of error
      if (cache[cacheKey]) {
        cache[cacheKey].isRefreshing = false;
        cache[cacheKey].refreshStartTime = undefined;
      }
      
      res.status(500).json({ 
        error: 'Error retrieving deployment timeline',
        errorDetails: error instanceof Error ? error.message : String(error)
      });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

