import {afterEach, describe, expect, it} from 'vitest';
import {cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import {AssessmentBiologyFigure} from '@/components/biology/AssessmentBiologyFigure';
import {FigureChartTabs, hasFigureAndChart, QuestionChart} from '@/components/shared/FigureChartTabs';
import {PunnettSquareDiagram} from '@/components/biology/diagrams/PunnettSquareDiagram';
import {FoodWebDiagram} from '@/components/biology/diagrams/FoodWebDiagram';
import {resolveDiagramSignal} from '@/components/ai-tutor/diagram-lookup';
import {blankCross, mouseQuestion, lakeQuestion, lakeTable, lakeOrganisms, relayQuestion} from '../../supabase/tests/fixtures/biology-resource-cases';

afterEach(() => {cleanup();document.documentElement.classList.remove('dark');});

describe('Biology assessment resources', () => {
  it('does not manufacture diagrams for a prose-only relay-neurone question', () => {
    const {container}=render(<AssessmentBiologyFigure question={relayQuestion}/>);
    expect(container).toBeEmptyDOMElement();
  });
  it('keeps given parent data without adding a solved cross', () => {
    render(<><QuestionChart question={mouseQuestion}/><AssessmentBiologyFigure question={mouseQuestion}/></>);
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.getByText('Bb')).toBeVisible();
    expect(screen.getByText('bb')).toBeVisible();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('50%');
  });
  it.each(['light','dark'])('shows a blank cross in %s assessment mode, including zoom', async theme => {
    if(theme==='dark') document.documentElement.classList.add('dark');
    const question={...mouseQuestion,diagram_config:{...blankCross,mode:'solution',offspring:[['Bb','bb']],phenotypeRatio:'1:1'}};
    render(<AssessmentBiologyFigure question={question}/>);
    const grid=screen.getByRole('img',{name:'Blank Punnett square'});
    expect(grid.querySelectorAll('g rect')).toHaveLength(4);
    expect(grid).not.toHaveTextContent(/50%|1:1|3:1|dominant|recessive/);
    // Configuration supplied by the model cannot reveal the solution.
    expect(grid.querySelectorAll('text')).toHaveLength(6);
    fireEvent.click(grid);
    expect(await screen.findByLabelText('Close diagram')).toBeInTheDocument();
    for(const copy of screen.getAllByRole('img',{name:'Blank Punnett square'}))
      expect(copy).not.toHaveTextContent(/50%|1:1|3:1|dominant|recessive/);
  });
  it('shows the correct worked cross only when the caller releases solutions', () => {
    const {rerender}=render(<AssessmentBiologyFigure question={{...mouseQuestion,diagram_config:blankCross}}/>);
    expect(screen.queryByRole('img',{name:'Worked monohybrid cross'})).not.toBeInTheDocument();
    rerender(<AssessmentBiologyFigure question={{...mouseQuestion,diagram_config:blankCross}} solutionsReleased/>);
    const grid=screen.getByRole('img',{name:'Worked monohybrid cross'});
    expect(grid).toHaveTextContent('Dominant : recessive = 1:1');
    expect(grid).toHaveTextContent('50% dominant; 50% recessive');
    expect(grid).not.toHaveTextContent('3:1');
  });
  it('does not substitute another cross when a saved figure disagrees', () => {
    render(<AssessmentBiologyFigure question={{...mouseQuestion,diagram_config:{...blankCross,parent2:'Bb'}}}/>);
    expect(screen.getByRole('alert')).toHaveTextContent('inconsistent');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
  it('shows the required biomass table without a Figure/Data tab or inferred food chain', () => {
    expect(hasFigureAndChart(lakeQuestion)).toBe(false);
    render(<><QuestionChart question={lakeQuestion}/><AssessmentBiologyFigure question={lakeQuestion}/></>);
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(within(screen.getByRole('table')).getByText('1200')).toBeVisible();
    expect(within(screen.getByRole('table')).getByText('180')).toBeVisible();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/Grass|Rabbit|Fox|15%/);
  });
  it('shows an explicit food chain and required table together, once each', () => {
    const q={...lakeQuestion,diagram_config:{type:'food_chain',organisms:lakeOrganisms},chart_data:lakeTable};
    expect(hasFigureAndChart(q)).toBe(true);
    render(<FigureChartTabs question={q} isExam/>);
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.getByRole('img',{name:'Food chain'})).toBeVisible();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/Grass|Rabbit|Fox/);
  });
  it('draws only the saved food-web links with unique SVG marker identities', () => {
    const config={type:'food_web' as const,organisms:lakeOrganisms,
      feedingLinks:[{from:'Algae',to:'Water fleas'},{from:'Small fish',to:'Large fish'}]};
    const {container}=render(<><FoodWebDiagram config={config}/><FoodWebDiagram config={config}/></>);
    const markers=[...container.querySelectorAll('marker')].map(m=>m.id);
    expect(new Set(markers).size).toBe(2);
    for(const figure of screen.getAllByRole('img',{name:'Food web'})) {
      expect([...figure.querySelectorAll('line title')].map(t=>t.textContent)).toEqual(['Algae → Water fleas','Small fish → Large fish']);
    }
  });
  it('rejects unsupported genetics instead of applying a monohybrid shortcut', () => {
    render(<PunnettSquareDiagram config={{type:'punnett_square',parent1:'AaBb',parent2:'AaBb',crossType:'dihybrid'}}/>);
    expect(screen.getByRole('alert')).toHaveTextContent('valid parent genotypes');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
  it('preserves explicit food-chain teaching examples without exposing them to assessment inference', () => {
    const signal=resolveDiagramSignal('food_chain')!;
    render(<FoodWebDiagram config={{type:'food_chain',...signal.config}}/>);
    expect(screen.getByRole('img',{name:'Food chain'})).toHaveTextContent('Grass');
    expect(hasFigureAndChart(lakeQuestion)).toBe(false);
  });
});
