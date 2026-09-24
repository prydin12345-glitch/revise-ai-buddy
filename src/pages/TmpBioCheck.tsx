// TEMPORARY verification page — remove after checks.
import { AssessmentBiologyFigure } from '@/components/biology/AssessmentBiologyFigure';
import { QuestionChart } from '@/components/shared/FigureChartTabs';
import { blankCross, mouseQuestion, parentTable, lakeQuestion, relayQuestion } from '../../supabase/tests/fixtures/biology-resource-cases';
import { generateExamPDF } from '@/lib/exam-pdf-generator';

const forged = { ...mouseQuestion, diagram_config: { ...blankCross, mode: 'solution', offspring: [['Bb', 'bb']], phenotypeRatio: '1:1' } };
const bad = { ...mouseQuestion, diagram_config: { type: 'punnett_square', parent1: 'Zz', parent2: 'bb' } };

export default function TmpBioCheck() {
  const pdf = async (key: boolean) => {
    const exam = { title: 'Bio check', subject: 'Biology', questions: [
      { ...mouseQuestion, id: 'm', diagram_config: blankCross, table_data: JSON.stringify([parentTable.headers, ...parentTable.rows]) },
      { ...lakeQuestion, id: 'l' }] } as any;
    const doc = await generateExamPDF(exam, { includeAnswerKey: key });
    (window as any).__pdf = doc.output('datauristring');
    doc.save(key ? 'check-key.pdf' : 'check.pdf');
  };
  const S = ({ id, children }: any) => <section data-case={id} className="border border-border p-4 my-4 bg-card text-card-foreground"><h2 className="font-bold">{id}</h2>{children}</section>;
  return <main className="p-4 max-w-3xl mx-auto bg-background text-foreground">
    <S id="relay"><p>{relayQuestion.question_text as string}</p><AssessmentBiologyFigure question={relayQuestion} /></S>
    <S id="cross-forged"><QuestionChart question={forged} /><AssessmentBiologyFigure question={forged} /></S>
    <S id="cross-unreleased"><AssessmentBiologyFigure question={{ ...mouseQuestion, diagram_config: blankCross }} /></S>
    <S id="cross-released"><AssessmentBiologyFigure question={{ ...mouseQuestion, diagram_config: blankCross }} solutionsReleased /></S>
    <S id="lake"><p>{lakeQuestion.question_text as string}</p><QuestionChart question={lakeQuestion} /><AssessmentBiologyFigure question={lakeQuestion} /></S>
    <S id="inconsistent"><AssessmentBiologyFigure question={bad} /></S>
    <button id="pdf" onClick={() => pdf(false)}>PDF</button> <button id="pdfkey" onClick={() => pdf(true)}>PDF key</button>
  </main>;
}
