/**
 * Naira (₦) Currency Utilities for SabiScore Edge v3.0 Frontend
 * 
 * All financial metrics use Nigerian Naira:
 * - Base bankroll: ₦10,000
 * - Exchange rate: ₦1,580 = $1 USD (Nov 2025)
 * - Kelly fraction: ⅛ (0.125)
 * - Minimum edge: ₦66 (4.2%)
 */

// Currency Constants
export const NGN_PER_USD = 1580.0; // Nigerian Naira to USD exchange rate (Nov 2025)
export const BASE_BANKROLL_NGN = 10_000; // Base betting unit in Naira
export const KELLY_FRACTION = 0.125; // ⅛ Kelly (conservative)
export const MIN_EDGE_NGN = 66; // Minimum edge threshold (₦66 = 4.2% of ₦10k)

interface FormatOptions {
  decimals?: number;
  showSymbol?: boolean;
  compact?: boolean;
}

/**
 * Format amount in Nigerian Naira with proper localization
 * 
 * @param amount - Amount in Naira
 * @param options - Formatting options
 * @returns Formatted string like "₦1,580" or "₦1.58M"
 * 
 * @example
 * formatNaira(1580000) // "₦1,580,000"
 * formatNaira(1580000, { compact: true }) // "₦1.58M"
 * formatNaira(66.5, { decimals: 1 }) // "₦66.5"
 */
export function formatNaira(
  amount: number,
  options: FormatOptions = {}
): string {
  const { decimals = 0, showSymbol = true, compact = false } = options;
  const symbol = showSymbol ? "₦" : "";

  if (compact && Math.abs(amount) >= 1_000_000) {
    // Millions
    const value = amount / 1_000_000;
    return `${symbol}${value.toFixed(2)}M`;
  } else if (compact && Math.abs(amount) >= 1_000) {
    // Thousands
    const value = amount / 1_000;
    return `${symbol}${value.toFixed(1)}K`;
  } else {
    // Standard formatting with comma separators
    const formatted = amount.toLocaleString("en-NG", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return `${symbol}${formatted}`;
  }
}

/**
 * Format edge value with proper sign
 * 
 * @param edge - Edge value in Naira
 * @param showSign - Include + for positive edges
 * @returns Formatted string like "+₦186" or "-₦42"
 * 
 * @example
 * formatEdge(186) // "+₦186"
 * formatEdge(-42) // "-₦42"
 */
export function formatEdge(edge: number, showSign = true): string {
  const sign = edge >= 0 && showSign ? "+" : "";
  return `${sign}${formatNaira(edge)}`;
}

/**
 * Calculate and format Kelly stake
 * 
 * @param bankroll - Total bankroll in Naira
 * @param edge - Edge percentage (e.g., 0.093 for 9.3%)
 * @param kellyFraction - Fraction of Kelly to use (default: 0.125 = ⅛)
 * @returns Formatted stake like "₦53,720"
 * 
 * @example
 * formatKellyStake(1580000, 0.093) // "₦18,404"
 * formatKellyStake(1000000, 0.042, 0.25) // "₦10,500"
 */
export function formatKellyStake(
  bankroll: number,
  edge: number,
  kellyFraction: number = KELLY_FRACTION
): string {
  const stake = bankroll * kellyFraction * edge;
  return formatNaira(stake);
}

/**
 * Calculate ROI as percentage
 * 
 * @param profit - Profit/loss in Naira
 * @param stake - Total staked in Naira
 * @returns ROI as percentage (e.g., 18.4 for +18.4%)
 * 
 * @example
 * calculateRoiPercent(18400, 100000) // 18.4
 */
export function calculateRoiPercent(profit: number, stake: number): number {
  if (stake === 0) return 0;
  return (profit / stake) * 100;
}

/**
 * Convert Naira to USD
 * 
 * @param amountNgn - Amount in Naira
 * @returns Amount in USD
 * 
 * @example
 * nairaToUsd(1580) // 1.0
 * nairaToUsd(79000) // 50.0
 */
export function nairaToUsd(amountNgn: number): number {
  return amountNgn / NGN_PER_USD;
}

/**
 * Convert USD to Naira
 * 
 * @param amountUsd - Amount in USD
 * @returns Amount in Naira
 * 
 * @example
 * usdToNaira(1) // 1580.0
 * usdToNaira(50) // 79000.0
 */
export function usdToNaira(amountUsd: number): number {
  return amountUsd * NGN_PER_USD;
}

/**
 * Format Closing Line Value
 * 
 * @param clv - CLV in Naira (positive = beat closing line)
 * @returns Formatted CLV like "+₦60" (average target)
 * 
 * @example
 * formatClv(60) // "+₦60"
 * formatClv(-15) // "-₦15"
 */
export function formatClv(clv: number): string {
  return formatEdge(clv, true);
}

/**
 * Check if edge meets minimum threshold
 * 
 * @param edgeNgn - Edge in Naira
 * @param minThreshold - Minimum edge threshold (default: ₦66)
 * @returns True if edge >= threshold
 * 
 * @example
 * isValidEdge(186) // true
 * isValidEdge(50) // false
 */
export function isValidEdge(
  edgeNgn: number,
  minThreshold: number = MIN_EDGE_NGN
): boolean {
  return edgeNgn >= minThreshold;
}

/**
 * Calculate edge percentage and edge in Naira
 * 
 * @param fairProb - Fair probability from model (e.g., 0.563)
 * @param impliedProb - Implied probability from odds (e.g., 0.510)
 * @param stake - Stake size in Naira (default: ₦10,000)
 * @returns Tuple of [edgePercent, edgeNgn]
 * 
 * @example
 * calculateEdgePercent(0.563, 0.510) // [10.4, 520.0]
 */
export function calculateEdgePercent(
  fairProb: number,
  impliedProb: number,
  stake: number = BASE_BANKROLL_NGN
): [number, number] {
  const edgePct = ((fairProb - impliedProb) / impliedProb) * 100;
  const edgeNgn = (fairProb - impliedProb) * stake;
  return [edgePct, edgeNgn];
}

interface MetricBox {
  label: string;
  value: string;
  raw: number;
}

/**
 * Format metric for dashboard display
 * 
 * @param label - Metric label (e.g., "Average CLV")
 * @param value - Metric value
 * @param isCurrency - Format as Naira
 * @param isPercentage - Format as percentage
 * @returns Dictionary with formatted metric
 * 
 * @example
 * formatMetricBox("Average CLV", 60, true, false)
 * // { label: "Average CLV", value: "₦60", raw: 60 }
 * 
 * formatMetricBox("ROI", 18.4, false, true)
 * // { label: "ROI", value: "18.4%", raw: 18.4 }
 */
export function formatMetricBox(
  label: string,
  value: number,
  isCurrency = false,
  isPercentage = false
): MetricBox {
  let formatted: string;

  if (isCurrency) {
    formatted = formatNaira(value);
  } else if (isPercentage) {
    formatted = `${value.toFixed(1)}%`;
  } else {
    formatted = value.toLocaleString("en-NG", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  return {
    label,
    value: formatted,
    raw: value,
  };
}

/**
 * Format percentage with sign
 * 
 * @param percent - Percentage value (e.g., 18.4)
 * @param decimals - Number of decimal places
 * @returns Formatted percentage like "+18.4%"
 * 
 * @example
 * formatPercent(18.4) // "+18.4%"
 * formatPercent(-5.2) // "-5.2%"
 */
export function formatPercent(percent: number, decimals = 1): string {
  const sign = percent >= 0 ? "+" : "";
  return `${sign}${percent.toFixed(decimals)}%`;
}
