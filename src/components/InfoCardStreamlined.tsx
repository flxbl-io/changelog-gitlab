// InfoCards.tsx
import React from "react";

interface InfoCardsProps {
  commitsCount: number;
  mergeRequestsCount: number;
  generatedAt: string;
}

const InfoCardStreamlined: React.FC<InfoCardsProps> = ({
  commitsCount,
  mergeRequestsCount,
  generatedAt,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <div className="bg-blue-100 p-4 rounded-md">
        <p className="text-lg font-semibold">Commits</p>
        <p className="text font-bold">{commitsCount}</p>
      </div>
      <div className="bg-green-100 p-4 rounded-md">
        <p className="text-lg font-semibold">Merge Requests</p>
        <p className="text font-bold">{mergeRequestsCount}</p>
      </div>
    </div>
  );
};

export default InfoCardStreamlined;