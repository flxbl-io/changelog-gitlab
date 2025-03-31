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

const cache: { [key: string]: { timestamp: number; data: DeploymentTimeline } } = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

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
    const { 
      gitlabHost, 
      projectId, 
      environment, 
      jobType, 
      jiraRegex 
    } = req.body;

    if (!gitlabHost || !projectId || !environment || !jobType || !jiraRegex) {
      return res.status(400).json({ 
        error: 'Missing required parameters. Please provide gitlabHost, projectId, environment, jobType, and jiraRegex' 
      });
    }

    const cacheKey = `${gitlabHost}-${projectId}-${environment}-${jobType}-${jiraRegex}`;
    const now = Date.now();

    if (cache[cacheKey] && now - cache[cacheKey].timestamp < CACHE_DURATION) {
      return res.status(200).json({ timeline: cache[cacheKey].data, cached: true });
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

      cache[cacheKey] = {
        timestamp: now,
        data: timeline
      };

      res.status(200).json({ timeline, cached: false });
    } catch (error) {
      console.error('Error retrieving deployment timeline:', error);
      res.status(500).json({ error: 'Error retrieving deployment timeline' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

