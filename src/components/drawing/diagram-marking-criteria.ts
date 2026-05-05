import type { MarkingCriterion } from './DiagramMarkingChecklist';

export const generateMarkingCriteria = (
  questionText: string,
  diagramCategory: string,
  totalMarks: number,
): MarkingCriterion[] => {

  const lower = questionText.toLowerCase();

  if (diagramCategory === 'economics') {

    if (/ppf|production\s+possibility/i.test(lower)) {
      const c: MarkingCriterion[] = [
        { id: 'axes', description: 'Both axes labelled with the two goods', marks: 1 },
        { id: 'curve', description: 'PPF drawn as a concave curve bowing outward from origin', marks: 1, hint: 'Should bow away from the origin — not a straight line' },
        { id: 'label', description: 'Curve labelled PPF or PPF₁', marks: 1 },
      ];
      if (/inside|inefficient|unemployed/.test(lower)) {
        c.push({ id: 'inside', description: 'Point inside the frontier labelled showing unemployed resources', marks: 1 });
      }
      if (/outside|unattainable/.test(lower)) {
        c.push({ id: 'outside', description: 'Point outside the frontier labelled as unattainable', marks: 1 });
      }
      if (/on the frontier|efficient|on the curve/.test(lower)) {
        c.push({ id: 'on-curve', description: 'Point on the frontier labelled showing productive efficiency', marks: 1 });
      }
      if (/opportunity cost/.test(lower)) {
        c.push({ id: 'two-points', description: 'Two points A and B on the PPF with dashed lines to both axes', marks: 1 });
        c.push({ id: 'tradeoff', description: 'Trade-off shown — moving A to B gains one good and sacrifices the other', marks: 1 });
      }
      if (/economic growth|outward shift/.test(lower)) {
        c.push({ id: 'ppf2', description: 'New PPF₂ drawn further from origin than PPF₁', marks: 1 });
        c.push({ id: 'ppf2-label', description: 'New frontier clearly labelled PPF₂', marks: 1 });
      }
      return c.slice(0, totalMarks);
    }

    if (/lorenz/.test(lower)) {
      return [
        { id: 'axes', description: 'Axes labelled — cumulative % population (x) and cumulative % income (y)', marks: 1 },
        { id: 'equality', description: 'Line of equality drawn as 45° diagonal and labelled', marks: 1, hint: 'Straight line from bottom-left to top-right' },
        { id: 'lorenz', description: 'Lorenz curve drawn below the line of equality, bowing toward bottom-right', marks: 1 },
        { id: 'lorenz-label', description: 'Lorenz curve labelled', marks: 1 },
        { id: 'ab', description: 'Regions A (between curves) and B (below Lorenz) identified', marks: 1, hint: 'Gini coefficient = A / (A + B)' },
      ].slice(0, totalMarks);
    }

    if (/break.?even/.test(lower)) {
      const c: MarkingCriterion[] = [
        { id: 'axes', description: 'Axes labelled — cost/revenue (£) vertical, output (units) horizontal', marks: 1 },
        { id: 'fc', description: 'Fixed cost line drawn horizontally from y-axis, labelled FC', marks: 1, hint: 'Fixed costs do not change with output' },
        { id: 'tc', description: 'Total cost line starts at the fixed cost on y-axis and slopes upward, labelled TC', marks: 1 },
        { id: 'tr', description: 'Total revenue line starts at origin (0,0) and slopes upward, labelled TR', marks: 1 },
        { id: 'be-point', description: 'Break-even point marked clearly where TR and TC lines cross', marks: 1 },
      ];
      if (/margin of safety/.test(lower)) {
        c.push({ id: 'current-output', description: 'Current output level marked on x-axis beyond break-even', marks: 1 });
        c.push({ id: 'mos', description: 'Margin of safety shown as horizontal distance between break-even and current output', marks: 1 });
      }
      return c.slice(0, totalMarks);
    }

    const c: MarkingCriterion[] = [
      { id: 'supply', description: 'Supply curve drawn sloping upward left to right, labelled S', marks: 1 },
      { id: 'demand', description: 'Demand curve drawn sloping downward left to right, labelled D', marks: 1 },
      { id: 'eq', description: 'Original equilibrium E1 marked where S and D intersect', marks: 1 },
      { id: 'axes', description: 'Axes labelled — Price (P) vertical, Quantity (Q) horizontal', marks: 1 },
    ];
    if (/increase in demand|demand shifts right/.test(lower)) {
      c.push({ id: 'd2', description: 'New demand curve D2 drawn to the right of D1', marks: 1 });
      c.push({ id: 'eq2', description: 'New equilibrium E2 at higher price P2 and higher quantity Q2', marks: 1 });
    }
    if (/decrease in demand|demand shifts left/.test(lower)) {
      c.push({ id: 'd2', description: 'New demand curve D2 drawn to the left of D1', marks: 1 });
      c.push({ id: 'eq2', description: 'New equilibrium E2 at lower price and lower quantity', marks: 1 });
    }
    if (/indirect tax|specific tax/.test(lower)) {
      c.push({ id: 'tax-curve', description: 'S+tax curve drawn above and left of original S', marks: 1 });
      c.push({ id: 'tax-wedge', description: 'Tax wedge shown as vertical gap between S and S+tax at new equilibrium', marks: 1 });
      c.push({ id: 'eq2', description: 'New equilibrium E2 at higher consumer price and lower quantity', marks: 1 });
    }
    if (/price floor|minimum price/.test(lower)) {
      c.push({ id: 'floor', description: 'Price floor line drawn above equilibrium and labelled Pmin', marks: 1 });
      c.push({ id: 'surplus', description: 'Surplus shown as gap between Qs and Qd at the floor price', marks: 1, hint: 'At Pmin, quantity supplied exceeds quantity demanded' });
    }
    if (/negative externality|social cost/.test(lower)) {
      c.push({ id: 'mpc', description: 'Original S curve relabelled S (MPC)', marks: 1 });
      c.push({ id: 'msc', description: 'MSC curve drawn above MPC and labelled MSC', marks: 1 });
      c.push({ id: 'qstar', description: 'Socially optimal output Q* shown where MSC meets demand curve', marks: 1 });
      c.push({ id: 'dwl', description: 'Deadweight welfare loss triangle shown between Q* and Qm', marks: 1 });
    }
    if (/subsidy/.test(lower)) {
      c.push({ id: 's2', description: 'New supply curve S2 drawn below and right of S1', marks: 1 });
      c.push({ id: 'eq2', description: 'New equilibrium E2 at lower price and higher quantity', marks: 1 });
    }
    return c.slice(0, totalMarks);
  }

  return [
    { id: 'drawn', description: 'A diagram has been drawn', marks: 1 },
    { id: 'labelled', description: 'Key elements are labelled', marks: 1 },
    { id: 'accurate', description: 'The diagram is accurate', marks: totalMarks - 2 },
  ].filter(c => c.marks > 0).slice(0, totalMarks);
};
