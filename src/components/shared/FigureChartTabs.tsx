import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BiologyFigurePanel, detectBiologyDiagram } from '@/components/biology';
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

/**
 * If a question has BOTH a biology figure AND a chart/data table,
 * render them in a tab switcher so the student can flip between them.
 * Returns null when this combo isn't present — caller falls back to its
 * existing separate figure & chart blocks.
 */
export const FigureChartTabs: React.FC<Props> = ({ question, isExam = false, className = '' }) => {
  const bioConfig = detectBiologyDiagram(question?.question_text, (question as any)?.subject);
  const chartData = getChartData(question);
  if (!bioConfig || !chartData) return null;

  return (
    <Tabs defaultValue="figure" className={`w-full mt-3 mb-4 ${className}`}>
      <TabsList className="h-8 mb-2">
        <TabsTrigger value="figure" className="text-[12px] h-7 px-4">Figure</TabsTrigger>
        <TabsTrigger value="data" className="text-[12px] h-7 px-4">Data</TabsTrigger>
      </TabsList>
      <TabsContent value="figure" className="mt-0">
        <BiologyFigurePanel config={bioConfig} isExam={isExam} />
      </TabsContent>
      <TabsContent value="data" className="mt-0">
        {renderChart(chartData, 'mb-0')}
      </TabsContent>
    </Tabs>
  );
};

/** Helper for caller: should the page suppress its standalone bio + chart blocks? */
export const hasFigureAndChart = (question: any): boolean => {
  const bioConfig = detectBiologyDiagram(question?.question_text, (question as any)?.subject);
  const chartData = getChartData(question);
  return !!(bioConfig && chartData);
};

export default FigureChartTabs;
