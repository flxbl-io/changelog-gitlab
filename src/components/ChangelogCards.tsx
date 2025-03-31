"use client"

import React, { useState, useEffect, useCallback } from "react";
import { Edit2, Trash2, Plus } from "lucide-react";
import ProgressBar from "./ProgressBar";
import CardModal from "./CardModal";
import ChangelogCardDetails from "./ChangelogCardDetails";
import InfoCardStreamlined from "./InfoCardStreamlined";
import { Card, TicketInfoState } from "@/model/models";

const initialCards: Card[] = [
  {
    id: "1",
    name: "SIT1",
    fromCommit: "release/BAU_25.2",
    toCommit: "env/Production",
    commits: [],
    ticketInfo: {},
    isLoading: false,
  },
  {
    id: "2",
    name: "SIT2",
    fromCommit: "release/MAY25",
    toCommit: "env/Production",
    commits: [],
    ticketInfo: {},
    isLoading: false,
  },
  {
    id: "3",
    name: "STAGING",
    fromCommit: "release/MAY25",
    toCommit: "env/Production",
    commits: [],
    ticketInfo: {},
    isLoading: false,
  },
  {
    id: "4",
    name: "PROD",
    fromCommit: "release/MAY25",
    toCommit: "env/Production",
    commits: [],
    ticketInfo: {},
    isLoading: false,
  },
];

const ChangelogCards: React.FC = () => {
  const [jiraHost, setJiraHost] = useState("jira.apps.ndis.gov.au");
  const [repository, setRepository] = useState("ocio/salesforce/pace-sf");
  const [gitlabHost, setGitlabHost] = useState("gitlab.apps.ndia.gov.au/");
  const [jiraRegex, setJiraRegex] = useState("(PSS-d+)|(P2B-d+)|(DIPMO-d+)|(P2CL-d+)|(GPO-d+)|(CS-d+)|(OCM-d+)|(OCM-d+)|(TS-d+)|");
  const [directory, setDirectory] = useState("/home/azlam/projects/pace-sf-server");

  const [error, setError] = useState("");
  const [tagsAndBranches, setTagsAndBranches] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadStoredData = useCallback(() => {
    const storedCards = localStorage.getItem("cards");
    const storedJiraHost = localStorage.getItem("jiraHost");
    const storedJiraRegex = localStorage.getItem("jiraRegex");
    const storedRepository = localStorage.getItem("repository");

    if (storedCards) {
      const parsedCards = JSON.parse(storedCards);
      console.log(`Loaded cards:`, parsedCards);
      setCards(parsedCards.length > 0 ? parsedCards : initialCards);
    } else {
      setCards(initialCards);
    }
    if (storedJiraHost) setJiraHost(storedJiraHost);
    if (storedJiraRegex) setJiraRegex(storedJiraRegex);
    if (storedRepository) setRepository(storedRepository);

    setIsLoading(false);
  }, []);

  const fetchCardData = useCallback(async (card: Card) => {
    const { id, fromCommit, toCommit } = card;

    console.log(`Fetching data for card:`, card);
    setCards(prevCards =>
      prevCards.map(c => (c.id === id ? { ...c, isLoading: true } : c))
    );

    try {
      const [tagResponse,commitResponse, ticketResponse] = await Promise.all([
        fetch("/api/getTags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory }),
        }),
        fetch("/api/getCommits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fromCommit, toCommit, directory }),
        }),
        fetch("/api/getTickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fromCommit, toCommit, directory, jiraRegex }),
        }),
      ]);

      if (!commitResponse.ok || !ticketResponse.ok) {
        throw new Error("Failed to fetch data");
      }

      const [commitData, ticketData] = await Promise.all([
        commitResponse.json(),
        ticketResponse.json(),
      ]);

      console.log (`comm`,commitResponse);
      console.log (`tocket`,ticketResponse);
      setCards(prevCards =>
        prevCards.map(c =>
          c.id === id
            ? {
                ...c,
                commits: commitData.commits,
                ticketInfo: ticketData.ticketInfo,
                isLoading: false,
              }
            : c
        )
      );
    } catch (error) {
      console.error("Error fetching data:", error);
      setCards(prevCards =>
        prevCards.map(c => (c.id === id ? { ...c, isLoading: false } : c))
      );
    }
  }, [directory, jiraRegex]);

  useEffect(() => {
    loadStoredData();
  }, [loadStoredData]);

  useEffect(() => {
    if (!isLoading) {
      const updateAllCards = () => {
        setCards(prevCards => {
          prevCards.forEach((card) => {
            if (!card.isLoading) {
              fetchCardData(card);
            }
          });
          return prevCards;
        });
        setLastUpdated(new Date());
      };

      updateAllCards();

      const interval = setInterval(updateAllCards, 10 * 60 * 1000); // 10 minutes

      return () => clearInterval(interval);
    }
  }, [isLoading, fetchCardData]);

  const handleDeleteCard = useCallback((cardId: string) => {
    setCards(prevCards => {
      const updatedCards = prevCards.filter((card) => card.id !== cardId);
      const newCards = updatedCards.length > 0 ? updatedCards : initialCards;
      localStorage.setItem("cards", JSON.stringify(newCards));
      return newCards;
    });
  }, []);

  const handleAddCard = useCallback(() => {
    const newCard: Card = {
      id: String(Date.now()),
      name: "",
      fromCommit: "",
      toCommit: "",
      commits: [],
      ticketInfo: {},
      isLoading: false,
    };
    setSelectedCard(newCard);
    setIsModalOpen(true);
  }, []);

  const handleSaveCard = useCallback(async (updatedCard: Card) => {
    setCards(prevCards => {
      const existingCardIndex = prevCards.findIndex(card => card.id === updatedCard.id);
      let newCards: Card[];
      
      if (existingCardIndex !== -1) {
        newCards = prevCards.map((card, index) => 
          index === existingCardIndex ? updatedCard : card
        );
      } else {
        newCards = [...prevCards, { ...updatedCard, id: String(Date.now()) }];
      }
      
      localStorage.setItem("cards", JSON.stringify(newCards));
      return newCards;
    });

    setIsModalOpen(false);
    await fetchCardData(updatedCard);
  }, [fetchCardData]);

  const handleCloseModal = useCallback(() => {
    setSelectedCard(null);
    setIsModalOpen(false);
  }, []);

  const countMergeRequests = useCallback((ticketInfo: TicketInfoState) => {
    const mrIds = Object.values(ticketInfo).flatMap((info) => info.mrIds);
    return mrIds.length;
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Pending MRs to Environments</h1>

      <div className="mb-8">
        <button
          onClick={handleAddCard}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded flex items-center"
        >
          <Plus className="mr-2" size={20} />
          Add a new Environment to Monitor
        </button>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <h3 className="font-bold mb-2">Errors occurred:</h3>
          <pre className="whitespace-pre-wrap">{error}</pre>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {cards?.map((card) => (
          <div key={card.id} className="bg-white shadow-md rounded-lg p-6">
            <div className="mb-4">
              <h3 className="text-xl font-semibold mb-2">{card.name}</h3>
              <p className="text-sm text-gray-600">
                {card.fromCommit} to {card.toCommit || "Latest"}
              </p>
              <div className="mt-2 flex space-x-2">
                <button
                  onClick={() => {
                    setSelectedCard(card);
                    setIsModalOpen(true);
                  }}
                  className="text-blue-600 hover:text-blue-800 p-1"
                >
                  <Edit2 size={20} />
                </button>
                <button
                  onClick={() => handleDeleteCard(card.id)}
                  className="text-red-600 hover:text-red-800 p-1"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
            {card.isLoading && (
              <div className="mt-4">
                <ProgressBar isLoading={true} />  
              </div>
            )}
            {!card.isLoading && card?.commits?.length > 0 && (
              <div>
                <InfoCardStreamlined
                  commitsCount={card.commits.length}
                  mergeRequestsCount={countMergeRequests(card.ticketInfo)}
                  generatedAt={new Date().toLocaleString()}
                />
                <div className="mt-4">
                  <ChangelogCardDetails
                    commits={card.commits}
                    ticketInfo={card.ticketInfo}
                    gitlabHost={gitlabHost}
                    repository={repository}
                    jiraHost={jiraHost}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {lastUpdated && (
        <p className="mt-8 text-gray-500">
          Last updated: {lastUpdated.toLocaleString()}
        </p>
      )}

      <CardModal
        isOpen={isModalOpen}
        card={selectedCard}
        onSave={handleSaveCard}
        onClose={handleCloseModal}
        tagsAndBranches={tagsAndBranches}  
      />
    </div>
  );
};

export default ChangelogCards;