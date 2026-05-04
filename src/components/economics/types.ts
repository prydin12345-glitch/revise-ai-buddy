export type EconomicsDiagramType =
  | 'supply_demand'
  | 'ppf'
  | 'lorenz_curve'
  | 'break_even'
  | 'aggregate_demand_supply'
  | 'market_failure'
  | 'circular_flow';

export interface SupplyDemandConfig {
  type: 'supply_demand';
  supplyShift?: 'increase' | 'decrease' | null;
  demandShift?: 'increase' | 'decrease' | null;
  good?: string;
  priceLabel?: string;
  quantityLabel?: string;
  currency?: string;
  showSurplus?: boolean;
  showDeadweightLoss?: boolean;
  showTax?: boolean;
  showSubsidy?: boolean;
  showPriceFloor?: boolean;
  showPriceCeiling?: boolean;
  taxAmount?: number;
  priceControlLevel?: number;
  variant?: 'standard' | 'ad_as' | 'labour_market';
  showWelfareAnalysis?: boolean;
  showConsumerSurplus?: boolean;
  showProducerSurplus?: boolean;
  showExternality?: boolean;
  externalityType?: 'positive' | 'negative';
}

export interface PPFConfig {
  type: 'ppf';
  good1?: string;
  good2?: string;
  showAttainablePoint?: boolean;
  showUnattainablePoint?: boolean;
  showInefficientPoint?: boolean;
  showShift?: boolean;
  shiftDirection?: 'outward' | 'inward';
  showOpportunityCost?: boolean;
  shape?: 'concave' | 'straight';
  variant?: 'standard' | 'with_growth' | 'with_labels';
}

export interface LorenzCurveConfig {
  type: 'lorenz_curve';
  dataPoints?: Array<{ population: number; income: number }>;
  showGiniCoefficient?: boolean;
  giniValue?: number;
  showComparison?: boolean;
  comparisonLabel?: string;
  comparisonPoints?: Array<{ population: number; income: number }>;
  country?: string;
  year?: string;
}

export interface BreakEvenConfig {
  type: 'break_even';
  fixedCosts?: number;
  variableUnitCost?: number;
  sellingPrice?: number;
  breakEvenQuantity?: number;
  breakEvenRevenue?: number;
  showMarginOfSafety?: boolean;
  currentOutput?: number;
  showProfit?: boolean;
  showLoss?: boolean;
  currency?: string;
  outputLabel?: string;
}

export type EconomicsDiagramConfig =
  | SupplyDemandConfig
  | PPFConfig
  | LorenzCurveConfig
  | BreakEvenConfig;
