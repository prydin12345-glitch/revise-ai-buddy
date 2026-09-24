// Regression examples reconstructed from the user's report; biomass values are synthetic.
export const mouseText = 'A heterozygous black mouse (Bb) is crossed with a white mouse (bb). Calculate the expected percentage of offspring with black fur.';
export const parentTable = {type: 'data_table', headers: ['Parent', 'Genotype'], rows: [['Black mouse', 'Bb'], ['White mouse', 'bb']],
  biology_calculation: {kind: 'monohybrid_percentage', parent1: 'Bb', parent2: 'bb', target: 'dominant'}};
export const mouseQuestion = {question_number: '4(c)', root_question_number: '4', question_type: 'written', marks: 3,
  question_text: mouseText, correct_answer: 'Two of four offspring genotypes are Bb. (2 / 4) × 100 = 50%. Final answer: 50%.', diagram_config: parentTable};
export const blankCross = {type: 'punnett_square' as const, crossType: 'monohybrid' as const, parent1: 'Bb', parent2: 'bb', showGametes: false};
export const lakeOrganisms = ['Algae', 'Water fleas', 'Small fish', 'Large fish'];
export const lakeText = 'The freshwater food chain is Algae → Water fleas → Small fish → Large fish. Use the table to calculate the percentage of biomass transferred from Algae to Water fleas.';
export const lakeTable = {type: 'data_table', headers: ['Organism', 'Biomass (g/m²)'], rows: [['Algae', 1200], ['Water fleas', 180], ['Small fish', 18], ['Large fish', 1.8]],
  biology_calculation: {kind: 'biomass_transfer', from: 'Algae', to: 'Water fleas', organismColumn: 0, valueColumn: 1, unit: 'g/m²'}};
export const lakeQuestion = {question_number: '9(c)', root_question_number: '9', question_type: 'written', marks: 3,
  question_text: lakeText, correct_answer: 'Use recipient / source × 100. 180 / 1200 × 100 = 15%. Final answer: 15%.', diagram_config: lakeTable};
export const relayQuestion = {question_number: '1(b)', root_question_number: '1', question_type: 'written', marks: 2,
  question_text: 'A student studies a reflex arc. Describe the function of a relay neurone.',
  correct_answer: 'It carries an impulse between a sensory and a motor neurone in the central nervous system.'};
