/**
 * Fairness & Bias Monitoring — Pure computation helpers
 * Safe for both client-side preview and server-side submission.
 */

export type FairnessMetricType =
  | 'demographic_parity'
  | 'equal_opportunity'
  | 'equalised_odds'
  | 'predictive_parity'
  | 'disparate_impact';

export type FairnessMetricResult = {
  metricType: FairnessMetricType;
  value: number;
  threshold: number;
  passed: boolean;
  explanation: string;
};

// ---------------------------------------------------------------------------
// Demographic Parity: P(Positive | Group A) ≈ P(Positive | Group B)
// Threshold default: 0.1 (10% gap tolerance)
// ---------------------------------------------------------------------------

export function demographicParity(
  groupAPositiveRate: number,
  groupBPositiveRate: number,
  threshold = 0.1
): FairnessMetricResult {
  const gap = Math.abs(groupAPositiveRate - groupBPositiveRate);
  return {
    metricType: 'demographic_parity',
    value: gap,
    threshold,
    passed: gap <= threshold,
    explanation: `Gap between groups: ${(gap * 100).toFixed(2)}% (threshold: ${(threshold * 100).toFixed(2)}%)`,
  };
}

// ---------------------------------------------------------------------------
// Disparate Impact Ratio: min(rate_A, rate_B) / max(rate_A, rate_B)
// Threshold default: 0.8 (80% rule)
// ---------------------------------------------------------------------------

export function disparateImpactRatio(
  groupARate: number,
  groupBRate: number,
  threshold = 0.8
): FairnessMetricResult {
  const minRate = Math.min(groupARate, groupBRate);
  const maxRate = Math.max(groupARate, groupBRate);
  const ratio = maxRate === 0 ? 0 : minRate / maxRate;

  return {
    metricType: 'disparate_impact',
    value: ratio,
    threshold,
    passed: ratio >= threshold,
    explanation: `Disparate impact ratio: ${(ratio * 100).toFixed(2)}% (threshold: ${(threshold * 100).toFixed(2)}%)`,
  };
}

// ---------------------------------------------------------------------------
// Equal Opportunity: TPR_A ≈ TPR_B (True Positive Rates equal)
// Threshold default: 0.1 (10% gap tolerance)
// ---------------------------------------------------------------------------

export function equalOpportunity(
  tprA: number,
  tprB: number,
  threshold = 0.1
): FairnessMetricResult {
  const gap = Math.abs(tprA - tprB);
  return {
    metricType: 'equal_opportunity',
    value: gap,
    threshold,
    passed: gap <= threshold,
    explanation: `TPR gap between groups: ${(gap * 100).toFixed(2)}% (threshold: ${(threshold * 100).toFixed(2)}%)`,
  };
}

// ---------------------------------------------------------------------------
// Equalised Odds: both TPR and FPR equal across groups
// Computes average gap; threshold default: 0.1
// ---------------------------------------------------------------------------

export function equalisedOdds(
  tprA: number,
  tprB: number,
  fprA: number,
  fprB: number,
  threshold = 0.1
): FairnessMetricResult {
  const tprGap = Math.abs(tprA - tprB);
  const fprGap = Math.abs(fprA - fprB);
  const avgGap = (tprGap + fprGap) / 2;

  return {
    metricType: 'equalised_odds',
    value: avgGap,
    threshold,
    passed: avgGap <= threshold,
    explanation: `Avg TPR/FPR gap: ${(avgGap * 100).toFixed(2)}% (threshold: ${(threshold * 100).toFixed(2)}%)`,
  };
}

// ---------------------------------------------------------------------------
// Predictive Parity: PPV_A ≈ PPV_B (Positive Predictive Value / Precision)
// Threshold default: 0.1 (10% gap tolerance)
// ---------------------------------------------------------------------------

export function predictiveParity(
  ppvA: number,
  ppvB: number,
  threshold = 0.1
): FairnessMetricResult {
  const gap = Math.abs(ppvA - ppvB);
  return {
    metricType: 'predictive_parity',
    value: gap,
    threshold,
    passed: gap <= threshold,
    explanation: `PPV gap between groups: ${(gap * 100).toFixed(2)}% (threshold: ${(threshold * 100).toFixed(2)}%)`,
  };
}

// ---------------------------------------------------------------------------
// Overall Assessment: aggregate status from multiple metrics
// ---------------------------------------------------------------------------

export type OverallFairnessStatus = 'pass' | 'warn' | 'fail';

export function computeOverallStatus(metrics: FairnessMetricResult[]): OverallFairnessStatus {
  if (metrics.length === 0) return 'warn';

  const passCount = metrics.filter((m) => m.passed).length;
  const passRatio = passCount / metrics.length;

  // pass: all metrics pass
  if (passRatio === 1.0) return 'pass';
  // fail: half or more fail
  if (passRatio <= 0.5) return 'fail';
  // warn: some pass, some fail
  return 'warn';
}
