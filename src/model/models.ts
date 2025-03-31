export interface Commit {
    hash: string;
    message: string;
}

export interface TicketInfo {
    tickets: string[];
    mrIds: string[];
}

export interface TicketInfoState {
    [hash: string]: TicketInfo;
}

export interface Card {
    id: string;
    name: string;
    fromCommit: string;
    toCommit: string;
    commits: Commit[];
    ticketInfo: TicketInfoState;
    isLoading: boolean;
}

export interface CardDetailsProps {
    commits: Commit[];
    ticketInfo: TicketInfoState;
    gitlabHost: string;
    repository: string;
    jiraHost: string;
  }