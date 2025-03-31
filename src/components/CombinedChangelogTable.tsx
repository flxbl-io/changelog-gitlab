import { Commit, TicketInfoState } from '@/model/models';
import React from 'react';


interface CombinedChangelogTableProps {
  commits: Commit[];
  ticketInfo: TicketInfoState;
  jiraHost: string;
  gitlabHost: string;
  repository: string;
}

const CombinedChangelogTable: React.FC<CombinedChangelogTableProps> = ({ 
  commits, 
  ticketInfo, 
  jiraHost, 
  gitlabHost, 
  repository 
}) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-300">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Commit Hash</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Commit Message</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jira Tickets</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Merge Requests</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {commits.map((commit) => (
            <tr key={commit.hash} className="hover:bg-gray-50">
              <td className="px-4 py-2 whitespace-nowrap font-mono text-sm">
                <a
                  href={`https://${gitlabHost}${repository}/-/commit/${commit.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {commit.hash.substring(0, 7)}
                </a>
              </td>
              <td className="px-4 py-2 text-sm">{commit.message}</td>
              <td className="px-4 py-2">
                <div className="flex flex-wrap gap-2">
                  {ticketInfo[commit.hash]?.tickets.map((ticket) => (
                    <a
                      key={ticket}
                      href={`https://${jiraHost}/browse/${ticket}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block bg-blue-100 text-blue-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded hover:bg-blue-200"
                    >
                      {ticket}
                    </a>
                  ))}
                </div>
              </td>
              <td className="px-4 py-2">
                <div className="flex flex-wrap gap-2">
                  {ticketInfo[commit.hash]?.mrIds.map((mrId) => (
                    <a
                      key={mrId}
                      href={`https://${gitlabHost}${repository}/-/merge_requests/${mrId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block bg-blue-100 text-blue-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded hover:bg-blue-200"
                    >
                      {mrId}
                    </a>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CombinedChangelogTable;