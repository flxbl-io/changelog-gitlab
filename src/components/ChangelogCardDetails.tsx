import { CardDetailsProps } from "@/model/models";
import React from "react";



export default function ChangelogCardDetails({
  commits,
  ticketInfo,
  gitlabHost,
  repository,
  jiraHost,
}: CardDetailsProps) {
  const allMrIds = Object.values(ticketInfo).flatMap((info) => info.mrIds);
  const displayedMrIds = allMrIds.slice(0, 20);
  const hasMoreMrs = allMrIds.length > 20;

  const allTickets = Object.values(ticketInfo).flatMap((info) => info.tickets);
  const displayedTickets = allTickets.slice(0, 20);
  const hasMoreTickets = allTickets.length > 20;

  const displayedCommits = commits.slice(0, 20);
  console.log(`di`,displayedCommits.length)
  const hasMoreCommits = commits.length > 20;

  return (
    <div>
      <div>
        <h4 className="text-lg font-semibold mb-2">Merge Requests:</h4>
        <ul className="list-disc list-inside mb-4">
          {displayedMrIds.map((mrId) => (
            <li key={mrId}>
              <a
                href={`https://${gitlabHost}${repository}/-/merge_requests/${mrId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                {mrId}
              </a>
            </li>
          ))}
        </ul>
        {hasMoreMrs && (
          <p className="text-sm text-gray-600 mb-4">
            Showing the latest 20 Merge Requests. Please check the detailed form for more.
          </p>
        )}
      </div>
      <div>
        <h4 className="text-lg font-semibold mb-2">Tickets:</h4>
        <ul className="list-disc list-inside mb-4">
          {displayedTickets.map((ticket) => (
            <li key={ticket}>
              <a
                href={`https://${jiraHost}/browse/${ticket}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                {ticket}
              </a>
            </li>
          ))}
        </ul>
        {hasMoreTickets && (
          <p className="text-sm text-gray-600 mb-4">
            Showing the latest 20 Tickets. Please check the detailed form for more.
          </p>
        )}
      </div>
    </div>
  );
}