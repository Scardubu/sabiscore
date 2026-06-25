"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { getTeamData, LEAGUE_CONFIG, resolveTeamName } from "@/components/team-display";
import { CountryFlag, TeamLogo } from "@/components/ui/cached-logo";
import { resolveTeamLogo } from "@/lib/assets/logo-resolver";
import { cn } from "@/lib/utils";
import {
  hashMatchup,
  loadStoredPoll,
  loadSwipeChoices,
  persistPoll,
  persistSwipeChoice,
  INTERSTITIAL_SWIPE_QUESTIONS,
} from "@/lib/interstitial-storage";
import {
  Trophy,
  TrendingUp,
  Users,
  Target,
  Zap,
  BarChart3,
  Star,
  Shield,
  Activity,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Check,
} from "lucide-react";

interface TeamStats {
  form: string;
  goalsScored: number;
  goalsConceded: number;
  cleanSheets: number;
  position: number;
}

interface MatchLoadingExperienceProps {
  homeTeam: string;
  awayTeam: string;
  league: string;
  matchupId?: string;
  onExperienceComplete?: () => void;
}

// ============================================================================
// DATA CONSTANTS
// ============================================================================

const FUN_FACTS = [
  "The first ever international football match was played between Scotland and England in 1872.",
  "Closing line value (CLV) is the most reliable indicator of long-term betting success.",
  "xG (Expected Goals) measures the quality of chances created, not just shots taken.",
  "Professional bettors typically achieve 53-55% win rates for consistent profit.",
  "The Kelly Criterion helps optimize stake sizing based on edge and bankroll.",
  "PPDA (Passes Per Defensive Action) measures pressing intensity.",
  "Home advantage is worth approximately 0.4 goals per match on average.",
  "Weather conditions can significantly impact over/under totals.",
  "Sharp money typically moves lines 15-30 minutes before kickoff.",
  "A 2% edge consistently exploited yields ~20% annual ROI.",
  "xA (Expected Assists) measures the quality of key passes.",
  "Deep completions track passes into the penalty area.",
];

const LOADING_FACTS = [
  { icon: Trophy, text: "Analyzing historical head-to-head records..." },
  { icon: TrendingUp, text: "Processing recent form data..." },
  { icon: Users, text: "Evaluating squad strength and injuries..." },
  { icon: Target, text: "Computing expected goals (xG) metrics..." },
  { icon: Zap, text: "Calculating Pinnacle closing line value..." },
  { icon: BarChart3, text: "Running ensemble prediction models..." },
  { icon: Star, text: "Assessing key player impact ratings..." },
  { icon: Shield, text: "Analyzing defensive organization..." },
  { icon: Activity, text: "Processing live odds movements..." },
];

const SWIPE_QUESTIONS = INTERSTITIAL_SWIPE_QUESTIONS;

const FLAG_SIZE_HEADER = 16;
const FLAG_SIZE_COMPACT = 14;
const FLAG_SIZE_TINY = 12;
const FLAG_CLASS_HEADER = "rounded-sm h-4 w-4 flex-shrink-0";
const FLAG_CLASS_COMPACT = "rounded-sm h-3.5 w-3.5 flex-shrink-0";
const FLAG_CLASS_TINY = "rounded-sm h-3 w-3 flex-shrink-0";

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateMockStats(teamName: string): TeamStats {
  const seed = teamName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const random = (offset: number) => ((seed + offset) % 100) / 100;

  return {
    form: ["W", "D", "L", "W", "W"].sort(() => random(1) - 0.5).slice(0, 5).join(""),
    goalsScored: Math.floor(random(10) * 30) + 15,
    goalsConceded: Math.floor(random(20) * 25) + 10,
    cleanSheets: Math.floor(random(30) * 10) + 2,
    position: Math.floor(random(40) * 18) + 1,
  };
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Particle burst effect for milestone celebrations
 */
function ParticleBurst({ trigger }: { trigger: number }) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; color: string }>>([]);

  useEffect(() => {
    if (trigger === 0) return;
    
    const newParticles = Array.from({ length: 12 }, (_, i) => ({
      id: Date.now() + i,
      x: (Math.random() - 0.5) * 200,
      y: (Math.random() - 0.5) * 200,
      color: ["#818cf8", "#a78bfa", "#34d399", "#fbbf24"][Math.floor(Math.random() * 4)],
    }));
    setParticles(newParticles);

    const timer = setTimeout(() => setParticles([]), 1000);
    return () => clearTimeout(timer);
  }, [trigger]);

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
          animate={{ x: p.x, y: p.y, scale: 0, opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute h-2 w-2 rounded-full"
          style={{ backgroundColor: p.color }}
        />
      ))}
    </div>
  );
}

/**
 * Form indicator badges (W/D/L)
 */
function FormIndicator({ form }: { form: string }) {
  return (
    <div className="flex gap-1">
      {form.split("").map((result, i) => (
        <span
          key={i}
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
            result === "W" && "bg-green-500/20 text-green-400",
            result === "D" && "bg-yellow-500/20 text-yellow-400",
            result === "L" && "bg-red-500/20 text-red-400"
          )}
        >
          {result}
        </span>
      ))}
    </div>
  );
}

/**
 * Mini team stats card
 */
function TeamStatsMini({ 
  teamName, 
  stats, 
  align,
  teamData 
}: { 
  teamName: string; 
  stats: TeamStats; 
  align: "left" | "right";
  teamData: ReturnType<typeof getTeamData>;
}) {
  const flagCode = teamData.countryCode;

  return (
    <motion.div
      initial={{ opacity: 0, x: align === "left" ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 }}
      className={cn(
        "flex-1 rounded-lg border border-slate-700/50 bg-slate-800/30 p-3",
        align === "right" && "text-right"
      )}
    >
      <div className={cn("mb-2 flex items-center gap-2", align === "right" && "flex-row-reverse")}>
        {flagCode ? (
          <CountryFlag countryCode={flagCode} size={FLAG_SIZE_COMPACT} className={FLAG_CLASS_COMPACT} />
        ) : (
          <span className="text-lg">{teamData.flag}</span>
        )}
        <span className="text-xs font-medium text-slate-400 truncate">{teamName}</span>
      </div>
      
      <div className="space-y-1.5">
        <div className={cn("flex items-center gap-2", align === "right" && "flex-row-reverse")}>
          <span className="text-[10px] text-slate-500">Form:</span>
          <FormIndicator form={stats.form} />
        </div>
        
        <div className={cn("flex gap-3 text-xs", align === "right" && "justify-end")}>
          <span className="text-slate-400">
            <span className="text-green-400">{stats.goalsScored}</span> GF
          </span>
          <span className="text-slate-400">
            <span className="text-red-400">{stats.goalsConceded}</span> GA
          </span>
        </div>
        
        <div className="text-[10px] text-slate-500">
          Position: <span className="font-medium text-slate-300">#{stats.position}</span>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Progressive confidence meter with milestones
 */
function ProgressiveConfidenceMeter({ 
  progress, 
  onMilestone 
}: { 
  progress: number;
  onMilestone?: (milestone: number) => void;
}) {
  const milestonesRef = useRef(new Set<number>());

  useEffect(() => {
    MILESTONES.forEach((m) => {
      if (progress >= m && !milestonesRef.current.has(m)) {
        milestonesRef.current.add(m);
        onMilestone?.(m);
      }
    });
  }, [progress, onMilestone]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">AI Analysis Progress</span>
        <span className="font-medium text-indigo-400">{Math.round(progress)}%</span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-slate-800">
        <motion.div
          className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 bg-[length:200%_100%]"
          initial={{ width: 0 }}
          animate={{ 
            width: `${progress}%`,
            backgroundPosition: ["0% 0%", "100% 0%"]
          }}
          transition={{
            width: { duration: 0.5, ease: "easeOut" },
            backgroundPosition: { duration: 2, repeat: Infinity, ease: "linear" }
          }}
        />
        {/* Milestone markers */}
        {MILESTONES.map((m, i) => (
          <div
            key={m}
            className={cn(
              "absolute top-0 h-full w-0.5 transition-colors duration-300",
              progress >= m ? "bg-white/50" : "bg-slate-600/30",
              i === 0 && "left-[25%]",
              i === 1 && "left-[50%]",
              i === 2 && "left-[75%]",
              i === 3 && "left-[100%]"
            )}
          />
        ))}
      </div>
      {/* Milestone labels */}
      <div className="flex justify-between text-[10px] text-slate-500">
        <span>Data</span>
        <span>Models</span>
        <span>Confidence</span>
        <span>Ready</span>
      </div>
    </div>
  );
}

/**
 * Quick prediction poll (who will win)
 */
function QuickPredictionPoll({
  homeTeam,
  awayTeam,
  matchupId,
  onVote,
}: {
  homeTeam: string;
  awayTeam: string;
  matchupId: string;
  onVote?: (choice: string) => void;
}) {
  const [voted, setVoted] = useState<string | null>(null);
  const [votes, setVotes] = useState({ home: 45, draw: 25, away: 30 });
  const [isRestored, setIsRestored] = useState(false);

  // Restore from localStorage
  useEffect(() => {
    const stored = loadStoredPoll(matchupId);
    if (stored) {
      setVoted(stored.choice);
      setVotes(stored.votes as typeof votes);
      setIsRestored(true);
    }
  }, [matchupId]);

  const handleVote = useCallback((choice: string) => {
    if (voted) return;
    
    const newVotes = {
      ...votes,
      [choice]: votes[choice as keyof typeof votes] + 1,
    };
    
    setVoted(choice);
    setVotes(newVotes);
    persistPoll(matchupId, { choice, votes: newVotes, timestamp: Date.now() });
    onVote?.(choice);
  }, [voted, votes, matchupId, onVote]);

  const total = votes.home + votes.draw + votes.away;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-4"
    >
      <div className="mb-3 flex items-center justify-center gap-2">
        <Target className="h-4 w-4 text-indigo-400" />
        <p className="text-sm font-medium text-slate-300">
          Quick Prediction - Who will win?
        </p>
        {isRestored && voted && (
          <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] text-green-400">
            <Check className="mr-1 inline h-3 w-3" />
            Voted
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { key: "home", label: homeTeam, color: "indigo" },
          { key: "draw", label: "Draw", color: "slate" },
          { key: "away", label: awayTeam, color: "emerald" },
        ].map(({ key, label, color }) => (
          <motion.button
            key={key}
            onClick={() => handleVote(key)}
            disabled={!!voted}
            whileHover={!voted ? { scale: 1.02 } : undefined}
            whileTap={!voted ? { scale: 0.98 } : undefined}
            className={cn(
              "relative overflow-hidden rounded-lg border p-3 text-center transition-all",
              voted === key
                ? `border-${color}-500 bg-${color}-500/20 ring-2 ring-${color}-500/50`
                : voted
                ? "border-slate-700 bg-slate-800/50 opacity-60"
                : "border-slate-700 bg-slate-800/50 hover:border-indigo-500/50 hover:bg-slate-800"
            )}
          >
            {voted && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(votes[key as keyof typeof votes] / total) * 100}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className={cn(
                  "absolute inset-0",
                  key === "home" && "bg-indigo-500/20",
                  key === "draw" && "bg-slate-500/20",
                  key === "away" && "bg-emerald-500/20"
                )}
              />
            )}
            <span className="relative z-10 block text-xs font-medium text-slate-300 truncate">
              {label}
            </span>
            {voted && (
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative z-10 mt-1 block text-xs font-bold text-slate-400"
              >
                {Math.round((votes[key as keyof typeof votes] / total) * 100)}%
              </motion.span>
            )}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

/**
 * Swipe prediction card (Tinder-style)
 */
function SwipePredictionCard({
  question,
  leftLabel,
  rightLabel,
  centerLabel,
  matchupId,
  questionId,
  onSwipe,
}: {
  question: string;
  leftLabel: string;
  rightLabel: string;
  centerLabel?: string;
  matchupId: string;
  questionId: string;
  onSwipe?: (direction: "left" | "right" | "center") => void;
}) {
  const [answered, setAnswered] = useState<"left" | "right" | "center" | null>(null);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-150, 0, 150], [-15, 0, 15]);
  const leftOpacity = useTransform(x, [-150, 0], [1, 0]);
  const rightOpacity = useTransform(x, [0, 150], [0, 1]);

  // Restore from localStorage
  useEffect(() => {
    const stored = loadSwipeChoices(matchupId);
    if (stored && stored[questionId]) {
      setAnswered(stored[questionId] as "left" | "right" | "center");
    }
  }, [matchupId, questionId]);

  const handleDragEnd = useCallback((_: never, info: PanInfo) => {
    if (answered) return;
    
    if (info.offset.x < -100) {
      setAnswered("left");
      persistSwipeChoice(matchupId, questionId, "left");
      onSwipe?.("left");
    } else if (info.offset.x > 100) {
      setAnswered("right");
      persistSwipeChoice(matchupId, questionId, "right");
      onSwipe?.("right");
    }
  }, [answered, matchupId, questionId, onSwipe]);

  const handleCenterTap = useCallback(() => {
    if (answered || !centerLabel) return;
    setAnswered("center");
    persistSwipeChoice(matchupId, questionId, "center");
    onSwipe?.("center");
  }, [answered, centerLabel, matchupId, questionId, onSwipe]);

  if (answered) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex items-center justify-center rounded-xl border border-green-500/30 bg-green-500/10 p-4"
      >
        <Check className="mr-2 h-4 w-4 text-green-400" />
        <span className="text-sm text-green-400">
          {answered === "left" ? leftLabel : answered === "right" ? rightLabel : centerLabel}
        </span>
      </motion.div>
    );
  }

  return (
    <div className="relative">
      {/* Direction hints */}
      <motion.div 
        style={{ opacity: leftOpacity }}
        className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-red-500/20 px-3 py-1"
      >
        <span className="text-xs font-bold text-red-400">{leftLabel}</span>
      </motion.div>
      <motion.div 
        style={{ opacity: rightOpacity }}
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-green-500/20 px-3 py-1"
      >
        <span className="text-xs font-bold text-green-400">{rightLabel}</span>
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.5}
        onDragEnd={handleDragEnd}
        style={{ x, rotate }}
        whileDrag={{ cursor: "grabbing" }}
        className="cursor-grab rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 p-4"
      >
        <div className="text-center">
          <p className="mb-2 text-sm font-medium text-slate-300">{question}</p>
          <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <ChevronLeft className="h-3 w-3" />
              Swipe {leftLabel}
            </span>
            {centerLabel && (
              <button 
                onClick={handleCenterTap}
                className="rounded-full bg-slate-700/50 px-3 py-1 text-slate-400 transition-colors hover:bg-slate-700"
              >
                Tap: {centerLabel}
              </button>
            )}
            <span className="flex items-center gap-1">
              Swipe {rightLabel}
              <ChevronRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Rotating loading tips display
 */
function LoadingTips() {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % LOADING_FACTS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const CurrentIcon = LOADING_FACTS[tipIndex].icon;

  return (
    <div className="h-6 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={tipIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="flex items-center justify-center gap-2 text-xs text-indigo-400/80"
        >
          <CurrentIcon className="h-3.5 w-3.5" />
          {LOADING_FACTS[tipIndex].text}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * Fun fact card that rotates
 */
function FunFactCard() {
  const [factIndex, setFactIndex] = useState(() => Math.floor(Math.random() * FUN_FACTS.length));

  useEffect(() => {
    const interval = setInterval(() => {
      setFactIndex((prev) => (prev + 1) % FUN_FACTS.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.7 }}
      className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3"
    >
      <div className="mb-1 flex items-center gap-1.5">
        <Sparkles className="h-3 w-3 text-amber-400" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-amber-400/80">
          Did you know?
        </span>
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={factIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="text-xs leading-relaxed text-slate-400"
        >
          {FUN_FACTS[factIndex]}
        </motion.p>
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const MILESTONES = [25, 50, 75, 90];

/**
 * MatchLoadingExperience V2
 * 
 * Enhanced loading interstitial with:
 * - Progressive confidence meter with milestone celebrations
 * - Quick prediction poll (persisted to localStorage)
 * - Swipe prediction cards (Tinder-style interactions)
 * - Team stats preview
 * - Rotating facts and tips
 * - Particle effects on milestones
 * 
 * Feature flagged under: PREDICTION_INTERSTITIAL_V2
 */
export function MatchLoadingExperience({
  homeTeam,
  awayTeam,
  league,
  matchupId,
  onExperienceComplete,
}: MatchLoadingExperienceProps) {
  const [progress, setProgress] = useState(0);
  const [particleTrigger, setParticleTrigger] = useState(0);
  const [swipeIndex, setSwipeIndex] = useState(0);
  const completionRef = useRef(false);

  const matchupKey = useMemo(() => matchupId ?? hashMatchup(homeTeam, awayTeam), [homeTeam, awayTeam, matchupId]);
  
  const homeTeamData = useMemo(() => getTeamData(homeTeam), [homeTeam]);
  const awayTeamData = useMemo(() => getTeamData(awayTeam), [awayTeam]);
  const homeCanonical = useMemo(() => resolveTeamName(homeTeam), [homeTeam]);
  const awayCanonical = useMemo(() => resolveTeamName(awayTeam), [awayTeam]);
  const homeLogoMeta = useMemo(() => resolveTeamLogo(homeCanonical), [homeCanonical]);
  const awayLogoMeta = useMemo(() => resolveTeamLogo(awayCanonical), [awayCanonical]);
  const leagueConfig = useMemo(() => LEAGUE_CONFIG[league], [league]);
  const homeStats = useMemo(() => generateMockStats(homeTeam), [homeTeam]);
  const awayStats = useMemo(() => generateMockStats(awayTeam), [awayTeam]);
  const homeCountryCode = homeTeamData.countryCode || leagueConfig?.countryCode;
  const awayCountryCode = awayTeamData.countryCode || leagueConfig?.countryCode;

  // Simulate progress (in production, this would be driven by actual loading state)
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev;
        // Accelerate at start, slow near end for suspense
        const increment = prev < 30 ? 8 : prev < 60 ? 5 : prev < 80 ? 3 : 1;
        return Math.min(prev + increment, 95);
      });
    }, 200);
    return () => clearInterval(interval);
  }, []);

  // Handle completion
  useEffect(() => {
    if (progress >= 95 && !completionRef.current) {
      completionRef.current = true;
      // Small delay for final animation
      setTimeout(() => {
        setProgress(100);
        setTimeout(() => onExperienceComplete?.(), 500);
      }, 800);
    }
  }, [progress, onExperienceComplete]);

  const handleMilestone = useCallback((milestone: number) => {
    setParticleTrigger((p) => p + 1);
    
    // Show next swipe question at certain milestones
    if (milestone === 50 || milestone === 75) {
      setSwipeIndex((i) => Math.min(i + 1, SWIPE_QUESTIONS.length - 1));
    }
  }, []);

  return (
    <div className="mx-auto max-h-[calc(100vh-4rem)] max-w-lg space-y-4 overflow-y-auto overscroll-contain p-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700">
      {/* Main card with team matchup */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm"
      >
        <ParticleBurst trigger={particleTrigger} />

        {/* Header with league */}
        <div className="border-b border-slate-700/50 bg-slate-800/50 px-4 py-2">
          <div className="flex items-center justify-between">
            {leagueConfig ? (
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-400">
                {leagueConfig.countryCode ? (
                  <CountryFlag countryCode={leagueConfig.countryCode} size={FLAG_SIZE_HEADER} className={FLAG_CLASS_HEADER} />
                ) : (
                  <span>{leagueConfig.flag}</span>
                )}
                {leagueConfig.fullName}
              </span>
            ) : (
              <span className="text-sm font-medium text-slate-400">{league}</span>
            )}
            <span className="flex items-center gap-1.5 text-xs text-indigo-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
              Generating AI Insights
            </span>
          </div>
        </div>

        <div className="space-y-4 p-4">
          {/* Team matchup with entrance animation */}
          <div className="flex items-center justify-center gap-3">
            <motion.div
              initial={{ opacity: 0, x: -30, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="flex flex-col items-center text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-full shadow-lg ring-1 ring-white/10 bg-slate-800/60 overflow-hidden",
                  homeTeamData.bgColor
                )}
              >
                <TeamLogo
                  teamName={homeCanonical}
                  logoUrl={homeLogoMeta.url}
                  fallbackUrls={homeLogoMeta.fallbackUrls}
                  placeholder={homeLogoMeta.placeholder}
                  colors={homeLogoMeta.colors || homeTeamData.colors}
                  size={72}
                  className="h-full w-full"
                  priority
                />
              </motion.div>
              <span className="mt-2 max-w-20 truncate text-sm font-bold text-white">{homeTeam}</span>
              <span className="flex items-center gap-1 text-[10px] text-slate-500">
                {homeCountryCode ? (
                  <CountryFlag countryCode={homeCountryCode} size={FLAG_SIZE_TINY} className={FLAG_CLASS_TINY} />
                ) : (
                  <span>{homeTeamData.flag}</span>
                )}
                HOME
              </span>
            </motion.div>

            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="relative"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-blue-600 shadow-lg">
                <span className="text-xs font-bold text-white">VS</span>
              </div>
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 rounded-full border-2 border-purple-500"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="flex flex-col items-center text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-full shadow-lg ring-1 ring-white/10 bg-slate-800/60 overflow-hidden",
                  awayTeamData.bgColor
                )}
              >
                <TeamLogo
                  teamName={awayCanonical}
                  logoUrl={awayLogoMeta.url}
                  fallbackUrls={awayLogoMeta.fallbackUrls}
                  placeholder={awayLogoMeta.placeholder}
                  colors={awayLogoMeta.colors || awayTeamData.colors}
                  size={72}
                  className="h-full w-full"
                  priority
                />
              </motion.div>
              <span className="mt-2 max-w-20 truncate text-sm font-bold text-white">{awayTeam}</span>
              <span className="flex items-center gap-1 text-[10px] text-slate-500">
                {awayCountryCode ? (
                  <CountryFlag countryCode={awayCountryCode} size={FLAG_SIZE_TINY} className={FLAG_CLASS_TINY} />
                ) : (
                  <span>{awayTeamData.flag}</span>
                )}
                AWAY
              </span>
            </motion.div>
          </div>

          {/* Progressive confidence meter */}
          <ProgressiveConfidenceMeter progress={progress} onMilestone={handleMilestone} />

          {/* Loading tips ticker */}
          <LoadingTips />

          {/* Team stats mini cards */}
          <div className="flex gap-3">
            <TeamStatsMini teamName={homeTeam} stats={homeStats} align="left" teamData={homeTeamData} />
            <TeamStatsMini teamName={awayTeam} stats={awayStats} align="right" teamData={awayTeamData} />
          </div>

          {/* Skeleton preview of prediction layout */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: progress > 70 ? 0.5 : 0 }}
            className="space-y-2 rounded-xl border border-slate-700/30 bg-slate-900/50 p-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-28 bg-slate-700/50" />
              <Skeleton className="h-3 w-16 rounded-full bg-slate-700/50" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-6 w-full bg-slate-700/40" />
                  <Skeleton className="h-2 w-full bg-slate-700/30" />
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Quick prediction poll */}
      <QuickPredictionPoll
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        matchupId={matchupKey}
      />

      {/* Swipe prediction cards */}
      <AnimatePresence mode="wait">
        {swipeIndex < SWIPE_QUESTIONS.length && (
          <motion.div
            key={SWIPE_QUESTIONS[swipeIndex].id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <SwipePredictionCard
              question={SWIPE_QUESTIONS[swipeIndex].question}
              leftLabel={SWIPE_QUESTIONS[swipeIndex].left}
              rightLabel={SWIPE_QUESTIONS[swipeIndex].right}
              centerLabel={"center" in SWIPE_QUESTIONS[swipeIndex] ? SWIPE_QUESTIONS[swipeIndex].center : undefined}
              matchupId={matchupKey}
              questionId={SWIPE_QUESTIONS[swipeIndex].id}
              onSwipe={() => setSwipeIndex((i) => i + 1)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fun fact card */}
      <FunFactCard />

      {/* Footer disclaimer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="text-center text-[10px] text-slate-600"
      >
        Powered by ensemble ML models • 8 data sources • Updated every 5 min
      </motion.p>
    </div>
  );
}

/**
 * Skeleton version for SSR
 */
export function MatchLoadingExperienceSkeleton() {
  return (
    <div className="mx-auto max-h-[calc(100vh-4rem)] max-w-lg space-y-4 overflow-y-auto p-4">
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-4">
        {/* Header skeleton */}
        <div className="mb-4 flex justify-between">
          <Skeleton className="h-5 w-32 bg-slate-700/50" />
          <Skeleton className="h-5 w-24 bg-slate-700/50" />
        </div>

        {/* Team matchup skeleton */}
        <div className="mb-4 flex items-center justify-center gap-4">
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="h-14 w-14 rounded-full bg-slate-700/50" />
            <Skeleton className="h-4 w-16 bg-slate-700/50" />
          </div>
          <Skeleton className="h-10 w-10 rounded-full bg-slate-700/50" />
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="h-14 w-14 rounded-full bg-slate-700/50" />
            <Skeleton className="h-4 w-16 bg-slate-700/50" />
          </div>
        </div>

        {/* Progress bar skeleton */}
        <Skeleton className="mb-4 h-3 w-full rounded-full bg-slate-700/50" />

        {/* Stats cards skeleton */}
        <div className="flex gap-3">
          <Skeleton className="h-24 flex-1 rounded-lg bg-slate-700/30" />
          <Skeleton className="h-24 flex-1 rounded-lg bg-slate-700/30" />
        </div>
      </div>

      {/* Poll skeleton */}
      <Skeleton className="h-28 w-full rounded-xl bg-slate-700/30" />
    </div>
  );
}

export default MatchLoadingExperience;
