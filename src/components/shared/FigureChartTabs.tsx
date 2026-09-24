import React from 'react';
import { AssessmentBiologyFigure } from '@/components/biology/AssessmentBiologyFigure';
import { savedBiologyDiagram } from '@/lib/biology-assessment-resources';
import {
  BoxPlotChart, isBoxPlotQuestion,
  HistogramChart, isHistogramQuestion,
  DataTableChart, isDataTableQuestion,
  BarChart, isBarChartQuestion,
  PieChart, isPieChartQuestion,
  CumulativeFrequencyChart, isCumulativeFrequencyQuestion,
  FrequencyPolygonChart, isFrequencyPolygonQuestion,
  ClimateChart, isClimateChartQuestion,
  LineChart, isLineChartQuestion,
} from '@/components/graph';
import { getChartData } from '@/utils/chartData';

interface Props {
  question: any;
  isExam?: boolean;
  className?: string;
}

const renderChart = (chartData: any, className: string) => {
  if (!chartData) return null;
  return (
    <>
      {isBoxPlotQuestion(chartData) && <BoxPlotChart chartData={chartData} className={className} />}
      {isHistogramQuestion(chartData) && <HistogramChart chartData={chartData} className={className} />}
      {isDataTableQuestion(chartData) && <DataTableChart chartData={chartData} className={className} />}
      {isBarChartQuestion(chartData) && <BarChart chartData={chartData} className={className} />}
      {isPieChartQuestion(chartData) && <PieChart chartData={chartData} className={className} />}
      {isCumulativeFrequencyQuestion(chartData) && <CumulativeFrequencyChart chartData={chartData} className={className} />}
      {isFrequencyPolygonQuestion(chartData) && <FrequencyPolygonChart chartData={chartData} className={className} />}
      {isClimateChartQuestion(chartData) && <ClimateChart chartData={chartData} className={className} />}
      {isLineChartQuestion(chartData) && <LineChart chartData={chartData} className={className} />}
    </>
  );
};

/** Required data is always visible. Keep this export for existing page imports. */
export const FigureChartTabs: React.FC<Props> = ({ question, isExam = false, className = '' }) => {
  const bioConfig = savedBiologyDiagram(question ?? {});
  const chartData = getChartData(question);
  if (!bioConfig || !chartData) return null;

  return (
    <div className={`w-full mt-3 mb-4 space-y-4 ${className}`}>
      {renderChart(chartData, 'mb-0')}
      <AssessmentBiologyFigure question={question} />
    </div>
  );
};

/** Helper for caller: should the page suppress its standalone bio + chart blocks? */
export const hasFigureAndChart = (question: any): boolean => {
  const bioConfig = savedBiologyDiagram(question ?? {});
  const chartData = getChartData(question);
  return !!(bioConfig && chartData);
};

/** For review surfaces that did not previously render stored chart data. */
export const QuestionChart = ({question, className = ''}: Props) => renderChart(getChartData(question), className);

export default FigureChartTabs;
