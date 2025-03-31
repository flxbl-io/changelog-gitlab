# Changelog Generator App

A Next.js application for generating changelogs from GitLab repositories. This app uses the GitLab API to fetch repository information, commits, and extract Jira ticket references to create comprehensive changelog reports.

## Features

- Connect to GitLab repositories using the GitLab API
- Browse tags and branches 
- Generate changelogs between any two commits, tags, or branches
- Extract Jira ticket references from commit messages
- Identify merge requests associated with changes
- Fast performance through API-based operations

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/yourusername/changelog-app-v2.git
cd changelog-app-v2
```

2. Install dependencies:

```bash
npm install
# or
yarn
# or
pnpm install
```

3. Set up environment variables:

Copy the `.env.example` file to `.env.local` and fill in your GitLab API token:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
GITLAB_API_TOKEN=your_gitlab_api_token_here
```

4. Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

5. Open [http://localhost:3000](http://localhost:3000) with your browser to use the app.

## GitLab API Integration

This application uses the GitLab API to fetch repository data rather than local git operations, providing:

- Faster performance - no local git clone/fetch operations
- Reduced storage requirements - no local repository storage
- Cross-platform compatibility - works anywhere with network access

### Required Permissions

To use this app with private GitLab repositories, you'll need a GitLab personal access token with the following scopes:

- `read_api` - For reading repository data via API
- `read_repository` - For accessing repository content

You can create a personal access token at: https://gitlab.com/-/profile/personal_access_tokens

## How to Use

1. Enter your GitLab host (e.g., gitlab.com) and repository path (e.g., group/project)
2. Click "Connect to Repository" to establish a connection
3. Select a source and target commit/tag/branch for your changelog
4. Configure your Jira host and ticket regex pattern
5. Click "Generate Changelog" to create the report

## Environment Variables

- `GITLAB_API_TOKEN` - GitLab personal access token for API authentication
- `NEXT_PUBLIC_APP_URL` - The application's public URL (optional, used for OAuth callback)

## License

This project is licensed under the MIT License - see the LICENSE file for details.