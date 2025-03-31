"use client"

import React, { useEffect, useRef } from 'react';
import { Clock, GitMerge, Ticket, X } from 'lucide-react';

interface TimelineItem {
  tag: string;
  tickets: string[];
  mrIds: string[];
  date: Date;
}

interface DeploymentModalProps {
  deployment: (TimelineItem & { envDisplay: string }) | null;
  open: boolean;
  onClose: () => void;
  jiraHost: string;
  gitlabHost: string;
  repository: string;
}

const formatDate = (date: Date): string => {
  return date.toLocaleString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

const DeploymentModal: React.FC<DeploymentModalProps> = ({
  deployment,
  open,
  onClose,
  jiraHost,
  gitlabHost,
  repository
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [open, onClose]);

  if (!open || !deployment) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div 
        ref={modalRef}
        className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold">
            Deployment Details - {deployment.envDisplay}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Deployment Info */}
          <div className="space-y-2">
            <p className="text-sm text-gray-600 flex items-center">
              <Clock className="h-4 w-4 mr-2" />
              {formatDate(deployment.date)}
            </p>
            <p className="text-sm">
              <span className="font-medium">Tag: </span>
              <a
                href={`https://${gitlabHost}/${repository}/-/tags/${deployment.tag}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                {deployment.tag}
              </a>
            </p>
          </div>

          {/* Tickets Section */}
          {deployment.tickets.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center text-lg">
                <Ticket className="h-5 w-5 mr-2 text-green-500" />
                Tickets ({deployment.tickets.length})
              </h3>
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-lg">
                {deployment.tickets.map((ticket) => (
                  <a
                    key={ticket}
                    href={`https://${jiraHost}/browse/${ticket}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 hover:underline flex items-center"
                  >
                    <span className="truncate">{ticket}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Merge Requests Section */}
          {deployment.mrIds.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center text-lg">
                <GitMerge className="h-5 w-5 mr-2 text-purple-500" />
                Merge Requests ({deployment.mrIds.length})
              </h3>
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-lg">
                {deployment.mrIds.map((mrId) => (
                  <a
                    key={mrId}
                    href={`https://${gitlabHost}/${repository}/-/merge_requests/${mrId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 hover:underline flex items-center"
                  >
                    <span className="truncate">MR #{mrId}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeploymentModal;