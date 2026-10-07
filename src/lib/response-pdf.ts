import {drawBiologyVisualPDF} from './biology-visual-pdf';
import type jsPDF from 'jspdf';
import {parseResponseDefinition} from './response-contract';
import type {ResponseQuestionView} from './response-view';
import {responseResources} from '../../supabase/functions/_shared/response-resources';

/** Vector answer areas. Never takes a student's response or a marking key. */
export function drawResponsePDF(doc: jsPDF, question: ResponseQuestionView, layout: {
  x: number; y: number; width: number; bottom: number; nextPage: () => number;
  text: (value: string) => string;
}): number {
  const d = parseResponseDefinition(question.response_definition);
  const resources = responseResources({diagram_config:{type:'response_context',resources:question.response_resources ?? []}},d);
  const {x,width,bottom,text} = layout;
  let y = layout.y;
  const font = (bold=false) => {doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(10);doc.setTextColor(30,30,30);doc.setDrawColor(140,140,140);};
  const space = (height: number) => {if(y+height>bottom){y=layout.nextPage();font();return true;}return false;};
  const lines = (value:string,w=width) => {font();return doc.splitTextToSize(text(value),w) as string[];};
  const paragraph = (value:string,bold=false) => {
    const wrapped=lines(value);font(bold);
    for(const line of wrapped){space(6);font(bold);doc.text(line,x,y);y+=6;}
    y+=2;
  };
  const blankLines=(count:number)=>{for(let i=0;i<count;i++){space(9);doc.line(x,y+5,x+width,y+5);y+=9;}y+=3;};
  // Headers repeat on each page. Wide data tables are split into labelled
  // column panels with their first (identifier) column repeated.
  const table=(headers:string[],rows:string[][],title:string,grid=false)=>{
    const panels:number[][]=[];
    for(let start=1;start<headers.length;start+=4)panels.push([0,...headers.slice(start,start+4).map((_,i)=>start+i)]);
    if(headers.length===1)panels.push([0]);
    for(const [panel,indices] of panels.entries()){
      const widths=indices.map((_,i)=>indices.length===1?width:i===0?width*.36:width*.64/(indices.length-1));
      const split=(cells:string[])=>cells.map((cell,i)=>lines(cell,widths[i]-5));
      const height=(cells:string[][])=>Math.max(1,...cells.map(c=>c.length))*5+5;
      const header=split(indices.map(i=>headers[i]));
      const row=(cells:string[][],h:number,head=false)=>{
        if(h>bottom-45)throw new Error('A response table cell is too long to print legibly.');
        let cx=x;font(head);
        cells.forEach((cell,i)=>{
          if(head){doc.setFillColor(238,238,242);doc.rect(cx,y,widths[i],h,'F');}
          doc.rect(cx,y,widths[i],h);
          if(grid&&!head&&i>0)doc.rect(cx+widths[i]/2-2,y+h/2-2,4,4);
          else cell.forEach((line,j)=>doc.text(line,cx+2,y+5+j*5));
          cx+=widths[i];
        });y+=h;
      };
      const heading=()=>{paragraph(title+(panels.length>1?` (columns ${panel*4+1}-${Math.min(panel*4+4,headers.length-1)})`:''),true);row(header,height(header),true);};
      space(height(header)+30);heading();
      for(const cells of rows){
        const wrapped=split(indices.map(i=>cells[i]));const h=height(wrapped);
        if(space(h)){heading();if(y+h>bottom)throw new Error('Response table row exceeds a printable page.');}
        row(wrapped,h);
      }
      y+=6;
    }
  };
  for(const r of resources){
    if(r.kind==='biology_visual'){y=drawBiologyVisualPDF(doc,r,{x,y,width,bottom,nextPage:layout.nextPage});font();}
    else if(r.kind==='text'){paragraph(r.title,true);paragraph(r.text);}
    else table(r.columns,r.rows,r.title);
  }
  if(d.kind==='choice'){
    paragraph(d.minSelections===d.maxSelections?`Tick ${d.maxSelections===1?'one':d.maxSelections===2?'two':d.maxSelections} ${d.maxSelections===1?'box':'boxes'}.`:`Tick between ${d.minSelections} and ${d.maxSelections} boxes.`,true);
    for(const option of d.options){
      const wrapped=lines(option.label,width-10);
      for(const [i,line] of wrapped.entries()){space(7);font();if(i===0)doc.rect(x,y-3,4,4);doc.text(line,x+9,y);y+=6;}y+=3;
    }
  }else if(d.kind==='grid'){
    paragraph(`Tick the correct cells in each row. ${d.minPerRow===d.maxPerRow?`Select ${d.maxPerRow} per row.`:`Select up to ${d.maxPerRow} per row.`}${d.minPerRow===0?' Write "none" beside a row if no cells apply.':''}`);
    table(['Property',...d.columns.map(c=>c.label)],d.rows.map(r=>[r.label,...d.columns.map(()=> '')]),'Answer grid',true);
  }else if(d.kind==='cloze'){
    // Word wrapping and blank boxes share one flowing line, never a separate
    // answer list that could detach a blank from its sentence.
    let cx=x;
    const newline=()=>{cx=x;y+=9;space(9);};
    space(10);font();
    for(const segment of d.segments){
      if('text' in segment){
        const tokens=text(segment.text).split(/(\s+)/);
        for(const token of tokens){
          if(!token)continue;
          if(/\n/.test(token)){newline();continue;}
          for(const word of doc.splitTextToSize(token,width) as string[]){
            const w=doc.getTextWidth(word);
            if(cx+w>x+width)newline();font();doc.text(word,cx,y);cx+=w;
          }
        }
      }else{
        const w=35;if(cx+w>x+width)newline();
        doc.line(cx+1,y+1,cx+w-1,y+1);cx+=w;
      }
    }
    y+=12;
    for(const field of d.fields)if(field.input==='select')paragraph(`${field.label} - choose from: ${field.options!.map(o=>o.label).join(' / ')}`);
  }else if(d.kind==='fields'){
    for(const field of d.fields){
      space(28);paragraph(field.label,true);
      if(field.input==='select')paragraph(`Choose from: ${field.options!.map(o=>o.label).join(' / ')}`);
      blankLines(2);
    }
  }else blankLines(5);
  return y+4;
}
