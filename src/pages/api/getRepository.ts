import { NextApiRequest, NextApiResponse } from 'next';
import { encodeRepositoryPath, buildGitLabApiUrl, gitlabFetch } from '@/utils/gitlab';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { gitlabHost, repository } = req.body;

    try {
      // Encode repository path for API usage
      const encodedRepo = encodeRepositoryPath(repository);
      
      // Call GitLab API to verify repository exists and get its ID
      const apiUrl = buildGitLabApiUrl(gitlabHost, `projects/${encodedRepo}`);
      console.log(`Checking repository via GitLab API: ${apiUrl}`);
      
      const response = await gitlabFetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
      }
      
      const projectData = await response.json();
      
      // Return the project ID and other repository info
      res.status(200).json({ 
        projectId: projectData.id,
        projectPath: projectData.path_with_namespace,
        defaultBranch: projectData.default_branch
      });
    } catch (error) {
      console.error('Error accessing repository via GitLab API:', error);
      res.status(500).json({ 
        error: 'Error accessing repository. Please check your GitLab host, repository path, and API token.'
      });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}