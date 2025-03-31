"use client"

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Edit2, Trash2, Plus } from "lucide-react";
import ProgressBar from "./ProgressBar";
import CardModal from "./CardModal";
import ChangelogCardDetails from "./ChangelogCardDetails";
import InfoCardStreamlined from "./InfoCardStreamlined";
import { Card, TicketInfoState } from "@/model/models";

// Extend Window interface to include our fetch timeout ID
declare global {
  interface Window {
    _fetchTimeoutId?: NodeJS.Timeout;
  }
}

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
  const [gitlabHost, setGitlabHost] = useState("gitlab.apps.ndia.gov.au");
  const [jiraRegex, setJiraRegex] = useState("(PSS-d+)|(P2B-d+)|(DIPMO-d+)|(P2CL-d+)|(GPO-d+)|(CS-d+)|(OCM-d+)|(OCM-d+)|(TS-d+)|");
  
  const [projectId, setProjectId] = useState<number | null>(null);
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const [error, setError] = useState("");
  const [tagsAndBranches, setTagsAndBranches] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const connectToRepository = useCallback(async () => {
    setIsConnecting(true);
    setError("");
    
    try {
      console.log(`Connecting to repository: ${gitlabHost}/${repository}`);
      const response = await fetch('/api/getRepository', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gitlabHost, repository }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to connect to repository');
      }

      const data = await response.json();
      setProjectId(data.projectId);
      setProjectPath(data.projectPath);
      
      // Store in localStorage
      localStorage.setItem("projectId", data.projectId.toString());
      localStorage.setItem("projectPath", data.projectPath);
      
      console.log(`Connected to project ID: ${data.projectId}`);
      // Don't fetch tags here - will be done by the useEffect
      
    } catch (error) {
      console.error('Error connecting to repository:', error);
      setError("Error connecting to repository. Please check your GitLab host and repository path.");
    }
    
    setIsConnecting(false);
  }, [gitlabHost, repository]);

  const fetchTagsAndBranches = useCallback(async (host: string, id: number) => {
    if (!id || !host) return;
    
    try {
      console.log(`Fetching tags and branches for project ${id} on ${host}`);
      // Fetch tags
      const tagsResponse = await fetch('/api/getTags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          gitlabHost: host,
          projectId: id
        }),
      });
      
      if (!tagsResponse.ok) {
        const errorData = await tagsResponse.json();
        throw new Error(errorData.error || 'Error fetching tags');
      }
      
      const tagsData = await tagsResponse.json();
      setTagsAndBranches(tagsData.tagsAndBranches || []);
      console.log(`Fetched ${tagsData.tagsAndBranches?.length || 0} tags and branches`);
    } catch (error) {
      console.error('Error fetching refs from GitLab API:', error);
      setError("Error fetching tags and branches from GitLab. Please check your connection and try again.");
    }
  }, []);

  const loadStoredData = useCallback(() => {
    const storedCards = localStorage.getItem("cards");
    const storedJiraHost = localStorage.getItem("jiraHost");
    const storedJiraRegex = localStorage.getItem("jiraRegex");
    const storedRepository = localStorage.getItem("repository");
    const storedGitlabHost = localStorage.getItem("gitlabHost");
    const storedProjectId = localStorage.getItem("projectId");
    const storedProjectPath = localStorage.getItem("projectPath");

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
    if (storedGitlabHost) setGitlabHost(storedGitlabHost);
    if (storedProjectPath) setProjectPath(storedProjectPath);

    // Check if we're in the envview page 
    const isEnvView = typeof window !== 'undefined' && 
      window.location.pathname.includes('/envview');
    
    // Set project ID last (since it might trigger data fetching)
    if (storedProjectId) {
      console.log("Setting project ID:", storedProjectId);
      setProjectId(parseInt(storedProjectId));
      // Don't call fetchTagsAndBranches here - let the useEffect handle it
    }
    
    setIsLoading(false);
  }, []);

  const fetchCardData = useCallback(async (card: Card) => {
    const { id, fromCommit, toCommit } = card;

    if (!projectId) {
      setError("Please connect to a repository first");
      return;
    }

    console.log(`Fetching data for card:`, card);
    setCards(prevCards =>
      prevCards.map(c => (c.id === id ? { ...c, isLoading: true } : c))
    );

    try {
      const [commitResponse, ticketResponse] = await Promise.all([
        fetch("/api/getCommits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            fromCommit, 
            toCommit, 
            gitlabHost, 
            projectId 
          }),
        }),
        fetch("/api/getTickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            fromCommit, 
            toCommit, 
            gitlabHost, 
            projectId, 
            jiraRegex 
          }),
        }),
      ]);

      if (!commitResponse.ok || !ticketResponse.ok) {
        throw new Error("Failed to fetch data");
      }

      const [commitData, ticketData] = await Promise.all([
        commitResponse.json(),
        ticketResponse.json(),
      ]);

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
  }, [projectId, gitlabHost, jiraRegex]);

  // On initial mount, load data from localStorage
  useEffect(() => {
    loadStoredData();
  }, [loadStoredData]);
  
  // When projectId changes, fetch tags and branches
  useEffect(() => {
    if (projectId && gitlabHost) {
      console.log(`Project ID changed to ${projectId}, fetching tags and branches`);
      fetchTagsAndBranches(gitlabHost, projectId);
    }
  }, [projectId, gitlabHost, fetchTagsAndBranches]);

  // Simplified function to fetch data for all cards in parallel
  const batchFetchAllCards = useCallback(async () => {
    // Safe access to current state values through function form
    if (!projectId) {
      console.error("Cannot fetch cards: No project ID available");
      return;
    }
    
    // To prevent infinite loops, check if we've recently fetched
    const lastFetchTime = sessionStorage.getItem("changelog_cards_last_fetch_time");
    const now = Date.now();
    
    if (lastFetchTime && now - parseInt(lastFetchTime) < 5000) { // 5 second cooldown
      console.log(`Skipping fetch, last fetch was too recent (${now - parseInt(lastFetchTime)}ms ago)`);
      return;
    }
    
    // Record this fetch attempt
    sessionStorage.setItem("changelog_cards_last_fetch_time", now.toString());
    
    console.log(`Fetching data for cards at ${new Date().toISOString()}...`);
    
    // Set all cards to loading state - use function form to reference latest state
    setCards(prevCards => {
      console.log(`Setting ${prevCards.length} cards to loading state`);
      return prevCards.map(card => ({ ...card, isLoading: true }));
    });

    try {
      // Get current cards state
      const currentCards = [...cards];
      console.log(`Processing ${currentCards.length} cards`);
      
      // Create an array of promises for all cards with valid from/to commits
      const fetchPromises = currentCards.map(async (card) => {
        const { id, fromCommit, toCommit, name } = card;
        
        // Skip cards without proper commit references
        if (!fromCommit || !toCommit) {
          console.log(`Skipping fetch for card ${id} (${name}) - missing commit references`);
          return { 
            id, 
            success: false, 
            message: "Missing commit references"
          };
        }
        
        console.log(`Fetching data for card ${id} (${name}): ${fromCommit} to ${toCommit}`);
        
        try {
          const [commitResponse, ticketResponse] = await Promise.all([
            fetch("/api/getCommits", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                fromCommit, 
                toCommit, 
                gitlabHost, 
                projectId 
              }),
            }),
            fetch("/api/getTickets", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                fromCommit, 
                toCommit, 
                gitlabHost, 
                projectId, 
                jiraRegex 
              }),
            }),
          ]);

          if (!commitResponse.ok || !ticketResponse.ok) {
            throw new Error("Failed to fetch data");
          }

          const [commitData, ticketData] = await Promise.all([
            commitResponse.json(),
            ticketResponse.json(),
          ]);
          
          console.log(`Fetched ${commitData.commits.length} commits for card ${id} (${name})`);

          return {
            id,
            commits: commitData.commits,
            ticketInfo: ticketData.ticketInfo,
            success: true
          };
        } catch (error) {
          console.error(`Error fetching data for card ${id} (${name}):`, error);
          return { id, success: false, message: String(error) };
        }
      });

      // Wait for all fetches to complete
      const results = await Promise.all(fetchPromises);

      // Update all cards at once with the results
      setCards(prevCards => {
        const updatedCards = [...prevCards];
        
        results.forEach(result => {
          if (result.success) {
            const index = updatedCards.findIndex(c => c.id === result.id);
            if (index !== -1) {
              updatedCards[index] = {
                ...updatedCards[index],
                commits: result.commits,
                ticketInfo: result.ticketInfo,
                isLoading: false
              };
            }
          } else {
            const index = updatedCards.findIndex(c => c.id === result.id);
            if (index !== -1) {
              updatedCards[index] = {
                ...updatedCards[index],
                isLoading: false
              };
            }
          }
        });
        
        return updatedCards;
      });
      
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error in batch fetch:", error);
      setCards(prevCards => 
        prevCards.map(card => ({ ...card, isLoading: false }))
      );
    }
  }, [projectId]);

  // Keep track of fetches to prevent duplicates
  const hasFetchedRef = useRef(false);
  
  // Memoized callback to prevent re-renders
  const fetchDataWithDelay = useCallback(() => {
    // Only fetch if we have a project ID
    if (!projectId) return;
    
    console.log(`Scheduled data fetch for projectId: ${projectId}`);
    batchFetchAllCards();
  }, [projectId, batchFetchAllCards]);
  
  // Use a stable reference to the fetchDataWithDelay function
  const fetchDataRef = useRef(fetchDataWithDelay);
  
  // Update the ref when the callback changes
  useEffect(() => {
    fetchDataRef.current = fetchDataWithDelay;
  }, [fetchDataWithDelay]);
    
  // Simple fetching logic - run only once when we get projectId
  useEffect(() => {
    console.log("Fetch effect check - Loading:", isLoading, "ProjectID:", projectId);
    
    // Only proceed if we have a project ID and loading is complete
    if (isLoading || !projectId) {
      return;
    }
    
    console.log("Initial fetch triggered with projectId:", projectId);
    
    // Check if we've already initialized fetching this component instance
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      
      // Wait a short time to ensure all state is updated
      const timeoutId = setTimeout(() => {
        fetchDataRef.current();
      }, 500);
      
      // Set up interval for refreshing data (using the ref to avoid stale closures)
      const refreshInterval = setInterval(() => {
        console.log("Refresh interval triggered");
        fetchDataRef.current();
      }, 300000); // Every 5 minutes
      
      return () => {
        clearTimeout(timeoutId);
        clearInterval(refreshInterval);
        console.log("Fetch effect cleanup");
      };
    } else {
      console.log("Skipping fetch - already fetched in this component instance");
    }
  }, [isLoading, projectId]);

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

      <div className="mb-6">
        {!projectId ? (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 p-4 rounded mb-4">
            <p>No repository connected. Connecting to repository...</p>
            <div className="mt-2">
              <ProgressBar isLoading={isConnecting} />
            </div>
          </div>
        ) : (
          <div className="bg-green-100 border border-green-400 text-green-700 p-4 rounded mb-4">
            <p>✓ Connected to Project ID: {projectId}</p>
            <p className="text-sm">Repository: {projectPath}</p>
          </div>
        )}
      </div>

      <div className="mb-8">
        <button
          onClick={handleAddCard}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded flex items-center"
          disabled={!projectId}
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