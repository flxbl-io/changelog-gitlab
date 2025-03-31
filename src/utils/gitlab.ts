/**
 * GitLab API utilities
 */

// Default page size for paginated requests
export const DEFAULT_PAGE_SIZE = 100;

// Function to encode repository path for GitLab API
export function encodeRepositoryPath(repositoryPath: string): string {
  return encodeURIComponent(repositoryPath);
}

// Get GitLab API token from environment variable
export function getGitLabToken(): string {
  const token = process.env.GITLAB_API_TOKEN;
  if (!token) {
    console.warn('GITLAB_API_TOKEN environment variable not set');
    return '';
  }
  return token;
}

// Normalize GitLab host URL (remove trailing slash if present)
export function normalizeGitLabHost(host: string): string {
  return host.endsWith('/') ? host.slice(0, -1) : host;
}

// Create headers with authentication for GitLab API requests
export function createGitLabHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  const token = getGitLabToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

// Helper to make GitLab API requests with proper authentication
export async function gitlabFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = createGitLabHeaders();
  
  const requestOptions: RequestInit = {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {})
    }
  };
  
  return fetch(url, requestOptions);
}

// Build a GitLab API URL with the correct host and endpoint
export function buildGitLabApiUrl(host: string, endpoint: string): string {
  const normalizedHost = normalizeGitLabHost(host);
  return `https://${normalizedHost}/api/v4/${endpoint}`;
}

// Add pagination parameters to a URL
export function addPaginationParams(url: string, page: number, perPage: number = DEFAULT_PAGE_SIZE): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}page=${page}&per_page=${perPage}`;
}

// Fetch all pages of a paginated GitLab API endpoint
export async function fetchAllPages<T>(
  baseUrl: string, 
  maxPages: number = 10,
  perPage: number = DEFAULT_PAGE_SIZE
): Promise<T[]> {
  let results: T[] = [];
  let currentPage = 1;
  let hasMorePages = true;
  
  while (hasMorePages && currentPage <= maxPages) {
    const url = addPaginationParams(baseUrl, currentPage, perPage);
    const response = await gitlabFetch(url);
    
    if (!response.ok) {
      throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json() as T[];
    results = [...results, ...data];
    
    // Check if we have more pages
    const totalPagesHeader = response.headers.get('x-total-pages');
    const totalPages = totalPagesHeader ? parseInt(totalPagesHeader, 10) : 1;
    
    hasMorePages = currentPage < totalPages;
    currentPage++;
  }
  
  return results;
}

// Helper interface for GitLab API pagination
export interface GitLabPaginationParams {
  page?: number;
  perPage?: number;
}