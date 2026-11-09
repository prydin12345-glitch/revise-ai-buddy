import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {act} from 'react';
import ReactDOM from 'react-dom/client';
import jsPDF from 'jspdf';
import {AssessmentPhysicsFigure} from '@/components/physics/AssessmentPhysicsFigure';
import {AssessmentBiologyFigure} from '@/components/biology/AssessmentBiologyFigure';
import {QuestionChart} from '@/components/shared/FigureChartTabs';
import {getCircuitConfig} from '@/components/circuit/getCircuitConfig';
import {ResponseEditor} from '@/components/responses/ResponseEditor';
import {responseFixture} from '../../supabase/tests/response-foundation-fixtures';
import {parsePhysicsDiagramConfig} from '../../supabase/functions/_shared/physics-diagram-contract';

const capture = vi.hoisted(() => ({html: [] as string[]}));
vi.mock('html2canvas', () => ({default: async (element: HTMLElement) => {
  capture.html.push(element.innerHTML);
  return {width: 600, height: 400, toDataURL: () => ''};
}}));
import {generateExamPDF} from '@/lib/exam-pdf-generator';

const circuit = {type: 'circuit', gridSpacing: 90, showLabels: true,
  nodes: [{id: 'a', col: 0, row: 0}, {id: 'b', col: 2, row: 0}, {id: 'c', col: 2, row: 2}, {id: 'd', col: 0, row: 2}],
  wires: [{from: 'a', to: 'b', component: 'resistor', label: 'R'}, {from: 'b', to: 'c', component: 'wire'},
    {from: 'c', to: 'd', component: 'battery', label: 'V'}, {from: 'd', to: 'a', component: 'wire'}]};
const lift = {type: 'vertical_lift', mass: 7, height: 'h', time: 6, unknowns: ['GPE']};
const mechanics: {name: string; config: any}[] = [
  {name: 'slope', config: {type: 'slope', angle: 27, mass: 7, surface: 'rough', showNormal: true, showWeight: true, showFriction: true, showComponents: false, showLabels: true}},
  {name: 'free_body', config: {type: 'free_body', angle: 0, mass: 7, appliedForce: 'P', surface: 'rough', unknowns: ['appliedForce'], showLabels: true}},
  {name: 'conical_pendulum', config: {type: 'conical_pendulum', stringLength: 1.2, angle: 27, mass: 7, omega: 'ω', showTension: true, showWeight: true, showRadius: true, unknowns: ['tension'], showLabels: true}},
  {name: 'vertical_motion', config: {type: 'vertical_motion', initialSpeed: 18, direction: 'up', mass: 7, unknowns: ['time', 'maxHeight'], showLabels: true}},
  {name: 'pulley', config: {type: 'pulley', angle: 0, masses: {hanging: 3, onSurface: 7}, surface: 'smooth', showLabels: true, showForces: false, friction: false}},
  {name: 'beam', config: {type: 'beam', length: 5, pivot: {type: 'support', position: 0}, loads: [{position: 3, magnitude: 12, label: '12 N'}], reactions: [{position: 0, label: 'R', isUnknown: true}], endLabels: {left: 'A', right: 'B'}, showLabels: true}},
  {name: 'projectile', config: {type: 'projectile', speed: 'u', angle: 'α', launchHeight: 0, targetX: 40, targetY: 0, showComponents: false, showLabels: true, unknowns: ['range']}},
  {name: 'rod', config: {type: 'rod', angle: 55, mass: 7, length: 'L', wallType: 'smooth', floorType: 'rough', showForces: false, showLabels: true}},
  {name: 'vertical_lift', config: lift},
  {name: 'phasor_diagram', config: {type: 'phasor_diagram', phasors: [{magnitude: 2, angleDeg: 0, label: 'V1 / V'}, {magnitude: 3, angleDeg: 90, label: 'V2 / V'}]}},
  {name: 'delta_wye_comparison', config: {type: 'delta_wye_comparison'}},
  {name: 'connected_particles', config: {type: 'connected_particles', massA: 7, massB: 3, angle: 27, surface: 'smooth'}},
  {name: 'spring_mass', config: {type: 'spring_mass', mass: 7, extension: 0.2, naturalLength: 0.6, orientation: 'vertical'}},
  {name: 'collision', config: {type: 'collision', massA: 7, massB: 3, uA: 6, uB: 0, vA: null, vB: null, collisionType: 'collision'}},
  {name: 'dual', config: {type: 'dual', left: circuit, right: lift}},
  {name: 'circuit', config: circuit},
];
const nuclearParents = [
  {parentSymbol: 'U', parentMassNumber: 238, parentAtomicNumber: 92},
  {parentSymbol: 'C', parentMassNumber: 14, parentAtomicNumber: 6},
  {parentSymbol: 'F', parentMassNumber: 18, parentAtomicNumber: 9},
  {parentSymbol: 'Tc', parentMassNumber: 99, parentAtomicNumber: 43},
];
const variants = [
  ...['converging_lens', 'diverging_lens', 'flat_mirror', 'refraction_block', 'prism_dispersion', 'optical_fibre'].map(variant => ({
    name: `ray_diagram/${variant}`, config: {type: 'ray_diagram', variant, objectPosition: 'at_2f', showConstruction: false, showImage: false},
  })),
  ...['transverse', 'longitudinal', 'superposition', 'standing_wave'].map(variant => ({
    name: `wave_diagram/${variant}`, config: {type: 'wave_diagram', variant, amplitude: 0.8, showAmplitudeLabel: true, showWavelengthLabel: true, harmonicNumber: 2},
  })),
  ...['bar_magnet', 'two_bar_magnets_attract', 'two_bar_magnets_repel', 'current_straight_wire', 'current_solenoid', 'motor_effect'].map(variant => ({
    name: `magnetic_field/${variant}`, config: {type: 'magnetic_field', variant, currentDirection: variant === 'motor_effect' ? 'down' : 'out_of_page', showArrows: false, showForceArrow: false},
  })),
  ...['alpha_decay', 'beta_minus_decay', 'beta_plus_decay', 'gamma_decay'].map((variant, index) => ({
    name: `nuclear_decay/${variant}`, config: {type: 'nuclear_decay', variant, ...nuclearParents[index], daughterSymbol: '?'},
  })),
  {name: 'electromagnetic_spectrum', config: {type: 'electromagnetic_spectrum', highlightRegion: 'visible', showUses: false, showFrequency: false, showWavelength: false}},
];
const figures = [...mechanics, ...variants];
const newPhysicsSnapshot = {resolved_by: 'server', context_version: 2, physics_generation_version: 1, subject_name: 'Physics'};
const marked = (config: any) => ({...config, physics_figure_version: 1, diagram_intent: 'setup'});
const stems: Record<string, string> = {
  slope: 'A 7 kg block rests on a rough slope inclined at 27°. Explain the motion using the diagram shown.',
  free_body: 'A 7 kg block rests on a rough horizontal surface with an applied force P. Explain the motion using the diagram shown.',
  conical_pendulum: 'A 7 kg particle moves as a conical pendulum with a 1.2 m string at 27° to the vertical and angular speed ω. Explain the motion.',
  vertical_motion: 'A particle of mass 7 kg is projected vertically upwards at 18 m/s. Determine its maximum height and the time taken.',
  pulley: 'The diagram shown contains a 7 kg block on a smooth horizontal table connected over a pulley to a 3 kg hanging block. Explain the motion.',
  beam: 'The diagram shown contains a beam of length 5 m with a 12 N load placed 3 m from A. Explain the equilibrium.',
  projectile: 'A ball is projected with speed u at angle α to the horizontal. Explain its motion using the diagram shown.',
  rod: 'The diagram shown contains a rod of length L at 55° to a rough floor, leaning against a smooth wall. Explain its equilibrium.',
  vertical_lift: 'A 7 kg load is raised through height h in 6 s. Explain the energy transfer using the diagram shown.',
  phasor_diagram: 'The diagram shown contains two voltage phasors with magnitudes 2 V and 3 V and a relative phase angle of 90°. Explain their relationship.',
  connected_particles: 'A 7 kg particle on a smooth slope inclined at 27° is connected over a pulley to a 3 kg hanging particle. Explain the motion.',
  spring_mass: 'A 7 kg load is attached to a vertical spring. Explain the equilibrium using the diagram shown.',
  collision: 'A 7 kg particle travelling at 6 m/s collides with a stationary 3 kg particle. Determine the final velocities.',
  dual: 'The circuit shown contains a cell, motor and resistor connected in series. The motor raises a 7 kg load through height h in 6 s. Explain the energy transfer.',
  circuit: 'The circuit shown contains a cell and resistor connected in series. Explain the transfer of energy.',
};
const question = (config: any, index = 0) => ({id: `figure-${index}`, question_number: String(index + 1),
  question_type: 'short_answer', marks: 2,
  question_text: config.type === 'nuclear_decay'
    ? `The nuclide ${config.parentSymbol}-${config.parentMassNumber}, with atomic number ${config.parentAtomicNumber}, undergoes ${config.variant.replaceAll('_', ' ')}. Determine its daughter nuclide.`
    : stems[config.type] ?? 'Use the saved setup figure to explain an observation.',
  diagram_config: marked(config), correct_answer: 'PRIVATE_SOLUTION_729'});
const svgText = (root: ParentNode) => [...root.querySelectorAll('svg text')].map(node => node.textContent);

beforeEach(() => {
  capture.html = [];
  const createRoot = ReactDOM.createRoot.bind(ReactDOM);
  vi.spyOn(ReactDOM, 'createRoot').mockImplementation((container, options) => {
    const root = createRoot(container, options);
    return {render: children => act(() => root.render(children)), unmount: () => act(() => root.unmount())};
  });
  vi.spyOn(jsPDF.API as unknown as Pick<jsPDF, 'addImage'>, 'addImage').mockImplementation(function () { return this; });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('saved structured Physics setup screen rendering', () => {
  it('covers all twenty-one renderer types', () => {
    expect(new Set(figures.map(figure => figure.config.type)).size).toBe(21);
  });
  it.each(figures)('shows $name during an exam using its validated saved config', ({config}) => {
    expect(parsePhysicsDiagramConfig(marked(config)).success).toBe(true);
    const {container} = render(<AssessmentPhysicsFigure question={question(config)} subject="Physics" isExam/>);
    expect(screen.getAllByRole('figure', {name: 'Saved Physics setup figure'})).toHaveLength(1);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('svg path, svg line, svg rect, svg circle')).not.toBeNull();
    expect(container.innerHTML).not.toMatch(/NaN|undefined|not rendered|PRIVATE_SOLUTION/);
  });
  it('keeps the saved geometry and symbols when the prose would infer different values', () => {
    const q = {...question(mechanics[0].config), diagram_config: mechanics[0].config, question_text: 'A 99 kg block lies on a smooth slope at 60°. Explain its motion.'};
    const {container} = render(<AssessmentPhysicsFigure question={q} subject="Physics" isExam/>);
    expect(container).toHaveTextContent('27°');
    expect(container).toHaveTextContent('rough');
    expect(container).not.toHaveTextContent(/60°|99/);
  });
  it.each(['none', 'student_draws'])('honours explicit %s without adding a detected setup', diagram_intent => {
    const q = {question_text: diagram_intent === 'student_draws' ? 'Draw a free-body diagram for a block on a rough slope.' : 'Define acceleration.', diagram_config: {type: 'physics_no_figure', physics_figure_version: 1, diagram_intent}};
    const {container} = render(<AssessmentPhysicsFigure question={q} subject="Physics" isExam/>);
    expect(container).toBeEmptyDOMElement();
  });
  it.each([
    {type: 'slope', physics_figure_version: 1, diagram_intent: 'setup'},
    {...marked(mechanics[0].config), angle: 'unknown'},
    {...marked(mechanics[0].config), physics_figure_version: 2},
  ])('shows a controlled missing-resource message for a malformed new figure', diagram_config => {
    render(<AssessmentPhysicsFigure question={{question_text: 'A 99 kg block lies on a slope at 60°.', diagram_config}} subject="Physics" isExam/>);
    expect(screen.getByRole('alert')).toHaveTextContent('saved Physics figure is unavailable');
    expect(screen.queryByRole('figure')).not.toBeInTheDocument();
  });
  it('shows a controlled missing-resource message when a new generation snapshot has lost the saved contract', () => {
    render(<AssessmentPhysicsFigure question={{...question(mechanics[0].config), diagram_config: null}}
      subject="Physics" generationContext={newPhysicsSnapshot} isExam/>);
    expect(screen.getByRole('alert')).toHaveTextContent('saved Physics figure is unavailable');
    expect(screen.queryByRole('figure')).not.toBeInTheDocument();
  });
  it('retains detector rendering for an unmarked legacy mechanics question', () => {
    const {container} = render(<AssessmentPhysicsFigure question={{question_text: 'A block of mass 5 kg rests on a rough inclined plane at 30°.'}} subject="Physics"/>);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('[data-physics-figure="saved"]')).toBeNull();
  });
  it('leaves charts and Biology figures with their existing renderers and owns a versioned circuit only once', () => {
    const chart = {question_text: 'Use the table.', diagram_config: {type: 'data_table', headers: ['Time / s', 'Mass / kg'], rows: [[0, 7], [1, 6]], physics_figure_version: 1, diagram_intent: 'graph'}};
    const {unmount} = render(<><QuestionChart question={chart}/><AssessmentPhysicsFigure question={chart} subject="Physics"/></>);
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.queryByRole('figure', {name: 'Saved Physics setup figure'})).not.toBeInTheDocument();
    unmount();
    const biology = {question_text: 'Identify the labelled cell structures.', diagram_config: {type: 'plant_cell'}};
    const bio = render(<AssessmentBiologyFigure question={biology}/>);
    const biologyCount = bio.container.querySelectorAll('svg').length;
    expect(biologyCount).toBeGreaterThan(0);
    bio.rerender(<><AssessmentBiologyFigure question={biology}/><AssessmentPhysicsFigure question={biology} subject="Biology"/></>);
    expect(bio.container.querySelectorAll('svg')).toHaveLength(biologyCount);
    bio.unmount();
    const q = question(circuit);
    expect(getCircuitConfig(q, 'Physics')).toBeNull();
    render(<AssessmentPhysicsFigure question={q} subject="Physics" isExam/>);
    expect(screen.getAllByRole('figure', {name: 'Saved Physics setup figure'})).toHaveLength(1);
  });
  it('shows the saved setup exactly once in the structured response editor without a private key', () => {
    const response = responseFixture('text');
    response.definition.resourceIds = [];
    const q = {...question(mechanics.find(item => item.name === 'projectile')!.config),
      response_definition: response.definition, response_resources: [], response_key: response.key};
    const drafts = {get: () => ({response: null, status: 'saved'}), error: () => null,
      update: vi.fn(), flush: vi.fn(), useSaved: vi.fn()} as any;
    const {container} = render(<ResponseEditor question={q} drafts={drafts}
      setupFigure={<AssessmentPhysicsFigure question={q} subject="Physics" isExam/>}/>);
    expect(screen.getAllByRole('figure', {name: 'Saved Physics setup figure'})).toHaveLength(1);
    expect(container.querySelector('textarea')).toHaveValue('');
    expect(container).not.toHaveTextContent(/PRIVATE|ANSWER KEY|PRIVATE_SOLUTION/);
  });
});

describe('structured Physics PDF rendering', () => {
  it('captures the same saved setup labels as the screen for every supported type and faithful variant', async () => {
    const expected = figures.map(({config}) => {
      const view = render(<AssessmentPhysicsFigure question={question(config)} subject="Physics" isExam/>);
      const labels = svgText(view.container);
      view.unmount();
      return labels;
    });
    const pdf = await generateExamPDF({title: 'Original structured Physics fixtures', subject: 'Physics',
      questions: figures.map(({config}, index) => question(config, index))}, {includeWorkingSpace: false});
    expect(capture.html).toHaveLength(figures.length);
    for (const [index, html] of capture.html.entries()) {
      const resource = document.createElement('div');
      resource.innerHTML = html;
      expect(svgText(resource), figures[index].name).toEqual(expected[index]);
      expect(html, figures[index].name).not.toMatch(/NaN|undefined|not rendered|PRIVATE_SOLUTION|Mass number:|Atomic number:|Resultant|constructive interference|destructive interference/);
    }
    expect(pdf.output()).not.toContain('PRIVATE_SOLUTION_729');
  });
  it('exports symbolic unknowns without computed nuclear daughters, collision answers or projectile values', async () => {
    const selected = [mechanics.find(item => item.name === 'projectile')!, mechanics.find(item => item.name === 'collision')!, variants.find(item => item.name === 'nuclear_decay/alpha_decay')!];
    await generateExamPDF({title: 'Unknown quantities', subject: 'Physics', questions: selected.map(({config}, index) => question(config, index))}, {includeWorkingSpace: false});
    expect(capture.html[0]).toContain('α');
    expect(capture.html[0]).toContain('>u</text>');
    expect(capture.html[1]).toContain('v_A = ?');
    expect(capture.html[1]).toContain('v_B = ?');
    expect(capture.html[2]).not.toMatch(/>234<|>90<|Mass number:|Atomic number:/);
  });
  it('omits explicit no-figure intents from the printable paper', async () => {
    const questions = ['none', 'student_draws'].map((diagram_intent, index) => ({...question(mechanics[0].config, index), question_text: diagram_intent === 'student_draws' ? 'Draw a free-body diagram for a block on a rough slope.' : 'Define acceleration.', diagram_config: {type: 'physics_no_figure', physics_figure_version: 1, diagram_intent}}));
    await generateExamPDF({title: 'Explicit figure decisions', subject: 'Physics', questions}, {includeWorkingSpace: false});
    expect(capture.html).toHaveLength(0);
  });
  it('rejects a malformed versioned figure instead of exporting an inferred replacement', async () => {
    const q = {...question(mechanics[0].config), diagram_config: {type: 'slope', physics_figure_version: 1, diagram_intent: 'setup'}};
    await expect(generateExamPDF({title: 'Missing Physics resource', subject: 'Physics', questions: [q]}, {includeWorkingSpace: false})).rejects.toThrow(/saved Physics figure is unavailable/);
    expect(capture.html).toHaveLength(0);
  });
  it('rejects a new generation snapshot whose saved figure contract is missing', async () => {
    const q = {...question(mechanics[0].config), diagram_config: null};
    await expect(generateExamPDF({title: 'Missing new Physics resource', subject: 'Physics',
      generation_context: newPhysicsSnapshot, questions: [q]}, {includeWorkingSpace: false})).rejects.toThrow(/saved Physics figure is unavailable/);
    expect(capture.html).toHaveLength(0);
  });
  it('prints a structured-response question with its saved setup and blank answer area only', async () => {
    const response = responseFixture('text');
    response.definition.resourceIds = [];
    const q = {...question(mechanics.find(item => item.name === 'projectile')!.config),
      response_definition: response.definition, response_resources: [], response_key: response.key};
    const pdf = await generateExamPDF({title: 'Structured Physics response', subject: 'Physics', questions: [q]}, {includeWorkingSpace: false});
    expect(capture.html).toHaveLength(1);
    expect(capture.html[0]).toContain('α');
    expect(capture.html[0]).toContain('>u</text>');
    expect(capture.html[0]).not.toMatch(/PRIVATE|ANSWER KEY|PRIVATE_SOLUTION/);
    expect(pdf.output()).not.toMatch(/PRIVATE|ANSWER KEY|PRIVATE_SOLUTION/);
  });
});
