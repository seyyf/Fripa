// One tracked visitor session (keyed by the shopper's anonymous userId).
export interface PresenceEntry {
  lastSeen: number; // ms epoch of the last heartbeat
  governorate: string; // resolved once, then cached
  page: string; // e.g. "home" | "catalogue" | "piece" | "cart"
  pieceId?: string; // set when page === "piece"
  hasCart: boolean;
}

// Payload sent by the shopper heartbeat.
export interface PingContext {
  page: string;
  pieceId?: string;
  hasCart: boolean;
  swipesSincePing: number;
}

export interface GovernorateCount {
  name: string;
  count: number;
}

export interface TopPiece {
  pieceId: string;
  title: string;
  count: number;
}

// What the admin live panel renders.
export interface PresenceSnapshot {
  online: number;
  byGovernorate: GovernorateCount[];
  topPieces: TopPiece[];
  activeCarts: number;
  swipeRatePerMin: number;
}

export interface VisitorHistoryPoint {
  hour: string; // ISO
  peakOnline: number;
  avgOnline: number;
}
