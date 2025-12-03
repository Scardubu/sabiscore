export const INTERSTITIAL_POLL_STORAGE_KEY = "sabiscore.interstitial.polls";
export const INTERSTITIAL_SWIPE_STORAGE_KEY = "sabiscore.interstitial.swipe";

export type InterstitialSwipeDirection = "left" | "right" | "center";

export interface InterstitialPollState {
  choice: string;
  votes: Record<string, number>;
  timestamp: number;
}

export type InterstitialSwipeChoices = Record<string, InterstitialSwipeDirection>;

export const INTERSTITIAL_SWIPE_QUESTIONS = [
  { id: "winner", question: "Who will win?", left: "Home", right: "Away", center: "Draw" },
  { id: "goals", question: "Over 2.5 goals?", left: "Under", right: "Over" },
  { id: "btts", question: "Both teams to score?", left: "No", right: "Yes" },
] as const;

export function hashMatchup(homeTeam: string, awayTeam: string): string {
  return `${homeTeam.toLowerCase().trim()}_vs_${awayTeam.toLowerCase().trim()}`;
}

export function loadStoredPoll(matchupId?: string): InterstitialPollState | null {
  if (!matchupId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${INTERSTITIAL_POLL_STORAGE_KEY}:${matchupId}`);
    if (!raw) return null;
    return JSON.parse(raw) as InterstitialPollState;
  } catch {
    return null;
  }
}

export function persistPoll(matchupId: string, payload: InterstitialPollState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${INTERSTITIAL_POLL_STORAGE_KEY}:${matchupId}`, JSON.stringify(payload));
  } catch {
    // best-effort persistence only
  }
}

export function loadSwipeChoices(matchupId?: string): InterstitialSwipeChoices | null {
  if (!matchupId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${INTERSTITIAL_SWIPE_STORAGE_KEY}:${matchupId}`);
    if (!raw) return null;
    return JSON.parse(raw) as InterstitialSwipeChoices;
  } catch {
    return null;
  }
}

export function persistSwipeChoice(
  matchupId: string,
  questionId: string,
  choice: InterstitialSwipeDirection
) {
  if (typeof window === "undefined") return;
  try {
    const existing = loadSwipeChoices(matchupId) ?? {};
    existing[questionId] = choice;
    window.localStorage.setItem(`${INTERSTITIAL_SWIPE_STORAGE_KEY}:${matchupId}`, JSON.stringify(existing));
  } catch {
    // Ignore storage quota issues
  }
}
