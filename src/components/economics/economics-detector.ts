import type { EconomicsDiagramConfig } from './types';

const has = (text: string, ...terms: string[]) =>
  terms.some(t => text.toLowerCase().includes(t.toLowerCase()));

export const detectEconomicsDiagram = (
  questionText: string,
  subject?: string,
): EconomicsDiagramConfig | null => {
  const text = questionText ?? '';
  const lower = text.toLowerCase();
  const subj = (subject ?? '').toLowerCase();

  const isEconomicsSubject =
    /economics|economic|commerce|business|micro|macro|finance|accounting|management|marketing|entrepreneurship|enterprise/i.test(subj) ||
    subj === '';

  if (!isEconomicsSubject) return null;

  // Suppress economics diagrams on biology-content questions when subject is not economics
  const hasBiologyContent =
    /\b(prokaryot|eukaryot|mitosis|meiosis|chromosome|organelle|mitochondri|chloroplast|ribosome|photosynthesis|respiration|enzyme.substrate|punnett|allele|genotype|phenotype|food web|food chain|trophic|dna|rna|amino acid|cell membrane|nucleus|gamete)\b/i.test(lower);
  if (hasBiologyContent && !/economics|business|commerce/i.test(subj)) {
    return null;
  }

  const isDescriptiveOnly =
    /^(explain|describe|outline|discuss|evaluate|assess|state (two|three|one|four|five|\d+)|give (two|three|one)|what (is|are|do|does)|why (is|are|do|does)|define|distinguish between|compare|contrast|list (two|three|one|\d+))/i.test(lower.trim()) &&
    !/\b(draw|sketch|diagram|show on|indicate on|label|construct|plot|illustrate|the diagram shows|the figure shows|using the diagram|from the diagram)\b/i.test(lower);

  const isAlwaysVisual =
    has(lower, 'supply and demand diagram', 'supply-demand diagram') ||
    has(lower, 'draw a supply', 'sketch a supply', 'draw the supply') ||
    has(lower, 'draw a demand', 'sketch a demand') ||
    has(lower, 'production possibility frontier', 'production possibility curve', 'ppf', 'ppc', 'production possibilities') ||
    has(lower, 'lorenz curve', 'gini coefficient') ||
    has(lower, 'break-even chart', 'breakeven chart', 'break even chart', 'break-even diagram', 'break even diagram') ||
    has(lower, 'on the diagram below', 'on the graph below', 'the diagram shows', 'the graph shows');

  if (isDescriptiveOnly && !isAlwaysVisual) return null;

  // Supply and Demand
  if (
    has(lower, 'supply and demand', 'supply & demand', 'supply-demand') ||
    (has(lower, 'supply curve', 'demand curve') && has(lower, 'equilibrium', 'price', 'quantity')) ||
    (has(lower, 'supply', 'demand') && has(lower, 'shift', 'increase', 'decrease') && has(lower, 'equilibrium', 'price', 'quantity')) ||
    has(lower, 'excess demand', 'excess supply', 'shortage', 'surplus') ||
    has(lower, 'price mechanism', 'market mechanism', 'market clearing') ||
    has(lower, 'price floor', 'minimum price', 'price support', 'minimum wage diagram') ||
    has(lower, 'price ceiling', 'maximum price', 'rent control') ||
    has(lower, 'indirect tax', 'specific tax', 'ad valorem', 'tax incidence') ||
    has(lower, 'subsidy diagram', 'production subsidy') ||
    has(lower, 'negative externality', 'positive externality', 'market failure', 'social cost', 'private cost', 'marginal social cost', 'deadweight loss', 'welfare loss') ||
    has(lower, 'labour market diagram', 'labor market diagram', 'wage diagram', 'demand for labour', 'supply of labour') ||
    has(lower, 'market price diagram', 'price determination diagram') ||
    has(lower, 'law of demand diagram', 'law of supply diagram', 'demand schedule diagram', 'supply schedule diagram')
  ) {
    return buildSupplyDemandConfig(lower);
  }

  // PPF
  if (
    has(lower, 'production possibility frontier', 'production possibility curve', 'production possibilities frontier', 'production possibilities curve') ||
    has(lower, 'ppf', 'ppc') ||
    (has(lower, 'opportunity cost') && has(lower, 'production', 'guns', 'butter', 'capital', 'consumer', 'goods', 'diagram', 'draw', 'sketch', 'curve')) ||
    has(lower, 'economic growth diagram', 'productive capacity diagram') ||
    has(lower, 'comparative advantage diagram', 'absolute advantage diagram') ||
    has(lower, 'production frontier', 'production boundary') ||
    has(lower, 'production possibility schedule') ||
    has(lower, 'choice and opportunity cost diagram', 'scarcity diagram')
  ) {
    return buildPPFConfig(lower);
  }

  // Lorenz Curve
  if (
    has(lower, 'lorenz curve', 'lorenz-curve') ||
    has(lower, 'gini coefficient', 'gini index') ||
    has(lower, 'income inequality diagram', 'wealth inequality diagram') ||
    (has(lower, 'line of equality') && has(lower, 'income', 'distribution', 'diagram')) ||
    has(lower, 'income distribution curve') ||
    has(lower, 'income inequality graph', 'distribution of income diagram') ||
    has(lower, 'inequality diagram', 'income disparity diagram')
  ) {
    return buildLorenzConfig(lower);
  }

  // Break-Even
  if (
    has(lower, 'break-even chart', 'break even chart', 'breakeven chart', 'break-even diagram', 'break even diagram', 'breakeven diagram') ||
    has(lower, 'break-even point', 'break even point', 'breakeven point') ||
    (has(lower, 'total revenue', 'total cost', 'fixed cost') && has(lower, 'diagram', 'chart', 'graph', 'draw', 'sketch', 'plot')) ||
    has(lower, 'margin of safety diagram', 'margin of safety chart') ||
    has(lower, 'contribution analysis diagram') ||
    (has(lower, 'profit diagram', 'loss diagram') && has(lower, 'output', 'cost'))
  ) {
    return buildBreakEvenConfig(lower);
  }

  return null;
};

const buildSupplyDemandConfig = (lower: string): EconomicsDiagramConfig => {
  const supplyIncrease = has(lower, 'supply increases', 'increase in supply', 'supply shifts right', 'rightward shift in supply', 'supply curve shifts right', 'boost in supply', 'improvement in supply', 'fall in cost of production');
  const supplyDecrease = has(lower, 'supply decreases', 'decrease in supply', 'supply shifts left', 'leftward shift in supply', 'supply curve shifts left', 'reduction in supply', 'rise in cost of production');
  const demandIncrease = has(lower, 'demand increases', 'increase in demand', 'demand shifts right', 'rightward shift in demand', 'demand curve shifts right', 'rise in demand', 'boost in demand', 'higher demand');
  const demandDecrease = has(lower, 'demand decreases', 'decrease in demand', 'demand shifts left', 'leftward shift in demand', 'demand curve shifts left', 'fall in demand', 'lower demand');

  const showTax = has(lower, 'indirect tax', 'specific tax', 'ad valorem', 'tax on producers', 'excise tax', 'sales tax diagram');
  const showSubsidy = has(lower, 'subsidy', 'production subsidy');
  const showPriceFloor = has(lower, 'price floor', 'minimum price', 'price support', 'minimum wage');
  const showPriceCeiling = has(lower, 'price ceiling', 'maximum price', 'rent control');
  const showExternality = has(lower, 'externality', 'social cost', 'marginal social cost', 'deadweight');
  const externalityType: 'positive' | 'negative' =
    has(lower, 'negative externality', 'social cost exceeds private', 'overproduction') ? 'negative' : 'positive';

  const showWelfare = has(lower, 'consumer surplus', 'producer surplus', 'welfare', 'deadweight loss', 'deadweight welfare loss');

  const goodMatch = lower.match(/\b(oil|petrol|gasoline|wheat|rice|housing|rent|labour|labor|steel|coffee|cocoa|cotton|sugar|copper|gold|cars|vehicles|smartphones|computers|medicines|drugs|electricity|water|land|capital)\b/i);

  const currency =
    has(lower, 'dollar', 'usd', '$') ? '$' :
    has(lower, 'euro', 'eur', '€') ? '€' :
    has(lower, 'rupee', 'inr', '₹') ? '₹' :
    has(lower, 'naira', 'ngn', '₦') ? '₦' :
    has(lower, 'rand', 'zar') ? 'R' :
    has(lower, 'yen', 'jpy', '¥') ? '¥' :
    '£';

  return {
    type: 'supply_demand',
    good: goodMatch?.[1] ?? undefined,
    currency,
    supplyShift: supplyIncrease ? 'increase' : supplyDecrease ? 'decrease' : null,
    demandShift: demandIncrease ? 'increase' : demandDecrease ? 'decrease' : null,
    showTax,
    showSubsidy,
    showPriceFloor,
    showPriceCeiling,
    showExternality,
    externalityType,
    showConsumerSurplus: showWelfare,
    showProducerSurplus: showWelfare,
    showDeadweightLoss: has(lower, 'deadweight'),
    variant: has(lower, 'labour market', 'labor market', 'wage') ? 'labour_market' : 'standard',
  };
};

const buildPPFConfig = (lower: string): EconomicsDiagramConfig => {
  const showShift = has(lower, 'economic growth', 'outward shift', 'shift outward', 'expand', 'increase in productive capacity', 'technological progress');
  const shiftInward = has(lower, 'inward shift', 'shift inward', 'recession', 'decrease in productive capacity', 'war', 'natural disaster');

  const goodRe = /\b(capital goods?|consumer goods?|guns?|butter|wheat|rice|manufactured goods?|agricultural goods?|health care|education|defence|defense)\b/i;
  const good1Match = lower.match(goodRe);
  const good2Match = good1Match ? lower.replace(good1Match[0], '').match(goodRe) : null;

  return {
    type: 'ppf',
    good1: good1Match?.[1] ?? 'Capital Goods',
    good2: good2Match?.[1] ?? 'Consumer Goods',
    showShift,
    shiftDirection: shiftInward ? 'inward' : 'outward',
    showOpportunityCost: has(lower, 'opportunity cost'),
    showAttainablePoint: has(lower, 'attainable', 'inside', 'within'),
    showUnattainablePoint: has(lower, 'unattainable', 'outside', 'beyond'),
    showInefficientPoint: has(lower, 'inefficient', 'unemployed', 'underemployed'),
    shape: has(lower, 'straight line ppf', 'linear ppf', 'constant opportunity cost') ? 'straight' : 'concave',
  };
};

const buildLorenzConfig = (lower: string): EconomicsDiagramConfig => {
  const giniMatch = lower.match(/gini.{0,20}(\d+(?:\.\d+)?)/i);
  const giniValue = giniMatch ? parseFloat(giniMatch[1]) : undefined;

  const countryMatch = lower.match(/\b(uk|united kingdom|us|usa|united states|india|china|brazil|germany|france|nigeria|ghana|kenya|south africa|australia|japan|mexico|canada|russia)\b/i);

  return {
    type: 'lorenz_curve',
    giniValue,
    showGiniCoefficient: has(lower, 'gini'),
    country: countryMatch?.[1]?.toUpperCase() ?? undefined,
    showComparison: has(lower, 'compare', 'comparison', 'two countries', 'before and after', 'over time'),
    dataPoints: [
      { population: 0, income: 0 },
      { population: 20, income: 5 },
      { population: 40, income: 14 },
      { population: 60, income: 30 },
      { population: 80, income: 55 },
      { population: 100, income: 100 },
    ],
    comparisonPoints: [
      { population: 0, income: 0 },
      { population: 20, income: 10 },
      { population: 40, income: 24 },
      { population: 60, income: 44 },
      { population: 80, income: 68 },
      { population: 100, income: 100 },
    ],
  };
};

const buildBreakEvenConfig = (lower: string): EconomicsDiagramConfig => {
  const fixedMatch = lower.match(/fixed costs?\s*(?:of|=|:)?\s*[£$€₹₦]?\s*(\d[\d,]*)/i);
  const priceMatch = lower.match(/(?:selling price|price per unit|revenue per unit)\s*(?:of|=|:)?\s*[£$€₹₦]?\s*(\d[\d,]*)/i);
  const varMatch = lower.match(/(?:variable cost|unit cost|cost per unit)\s*(?:of|=|:)?\s*[£$€₹₦]?\s*(\d[\d,]*)/i);
  const outputMatch = lower.match(/(?:current output|actual output|planned output|output of)\s*(?:of|=|:)?\s*(\d[\d,]*)/i);

  const currency =
    has(lower, 'dollar', 'usd', '$') ? '$' :
    has(lower, 'euro', 'eur', '€') ? '€' :
    has(lower, 'rupee', 'inr', '₹') ? '₹' :
    has(lower, 'naira', 'ngn', '₦') ? '₦' :
    '£';

  const fixedCosts = fixedMatch ? parseFloat(fixedMatch[1].replace(/,/g, '')) : 50000;
  const sellingPrice = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 20;
  const variableUnitCost = varMatch ? parseFloat(varMatch[1].replace(/,/g, '')) : 10;
  const currentOutput = outputMatch ? parseFloat(outputMatch[1].replace(/,/g, '')) : undefined;

  const breakEvenQuantity = sellingPrice > variableUnitCost ? fixedCosts / (sellingPrice - variableUnitCost) : 0;

  return {
    type: 'break_even',
    fixedCosts,
    sellingPrice,
    variableUnitCost,
    breakEvenQuantity,
    breakEvenRevenue: breakEvenQuantity * sellingPrice,
    showMarginOfSafety: has(lower, 'margin of safety') && !!currentOutput,
    currentOutput,
    currency,
    outputLabel: has(lower, 'units') ? 'Units' : 'Output',
  };
};
