from pathlib import Path
import hashlib,json
root=Path(__file__).parent
filler='Original software test notes discuss measurement records and experimental practice without asserting assessment rules.'
VERSION='Version 1.4 July 2026'
TOPICS='Sections 1 to 5 and 6.1'
MATHS='At least 40% of the overall assessment uses mathematical skills at Level 2 or above, equivalent to higher GCSE mathematics.'

def pdf(path,pages):
    objects=[b'<< /Type /Catalog /Pages 2 0 R >>',b'',b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];kids=[]
    for lines in pages:
        page_id=len(objects)+1;stream_id=page_id+1;kids.append(f'{page_id} 0 R')
        objects.append(f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents {stream_id} 0 R >>'.encode())
        esc=lambda x:x.replace('\\','\\\\').replace('(','\\(').replace(')','\\)')
        stream=('BT /F1 10 Tf 42 752 Td 14 TL '+' '.join(('T* ' if i else '')+'('+esc(line)+') Tj' for i,line in enumerate(lines))+' ET').encode('ascii')
        objects.append(b'<< /Length '+str(len(stream)).encode()+b' >>\nstream\n'+stream+b'\nendstream')
    objects[1]=f'<< /Type /Pages /Kids [{" ".join(kids)}] /Count {len(pages)} >>'.encode()
    data=bytearray(b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');offsets=[0]
    for i,obj in enumerate(objects,1):
        offsets.append(len(data));data.extend(f'{i} 0 obj\n'.encode()+obj+b'\nendobj\n')
    xref=len(data);data.extend(f'xref\n0 {len(objects)+1}\n0000000000 65535 f \n'.encode())
    for off in offsets[1:]:data.extend(f'{off:010d} 00000 n \n'.encode())
    data.extend(f'trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode());path.write_bytes(data)
    return {'pages':len(pages),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}

def physics(paper=1):
    pages=[[f'Original synthetic notes - physical page {p}']+[f'{n+1}. '+filler[:105] for n in range(25)] for p in range(1,97)]
    pages[0]=['Original combined qualification fixture for software verification','AQA AS and A-level Physics','AS 7407 and A-level 7408',f'Specification version: {VERSION}','First teaching 2015, first exams 2017','No official question or answer is copied in this fixture.']
    pages[1]=['AS Physics','Course 7407','Paper 1 (7407/1)', 'AS-only sentinel: 70 marks; 90 minutes.', 'Waves at AS depth.']
    pages[89]=['A-level Physics',f'Paper {paper} (7408/{paper})',f'Course 7408. Specification version: {VERSION}.',"What's assessed",TOPICS+'.','Assessed','Written exam: 2 hours','85 marks','Questions','60 marks of short and long answer questions and 25 multiple-choice questions on content.']
    pages[89]+=['Answer all questions.','A scientific calculator is allowed.']
    if paper==3:pages[89]+=['Section A is compulsory.','Section B: answer one optional topic.','Astrophysics 7408/3BA']
    pages[90]=['Mathematical skills','At least 40% of the overall assessment','uses mathematical skills','at Level 2','or above,','equivalent to','higher GCSE mathematics.','A worked numerical example may use a calculator to process a percentage.']
    return pages
report={}
ambiguous=[['AQA AS and A-level Physics','AS 7407 | A-level 7408','Assessment overview','Paper 1 | Paper 1','7407/1 | 7408/1','70 marks | 85 marks','90 minutes | 120 minutes','AS-only topics | A-level topics']]
report['unpartitioned-combined.pdf']=pdf(root/'unpartitioned-combined.pdf',ambiguous)
page_choice=physics();page_choice[1]=ambiguous[0][1:]
report['page-choice-combined-96-pages.pdf']=pdf(root/'page-choice-combined-96-pages.pdf',page_choice)
for name,pages in [('combined-physics-96-pages.pdf',physics()),('paper2-physics-96-pages.pdf',physics(2)),('physics-optional-96-pages.pdf',physics(3))]:
    report[name]=pdf(root/name,pages)
text='Example University BIO101 Final assessment. Version 2026. This assessment is untiered. 6 marks; 30 minutes. Cells and Enzymes. Short structured answers. Answer all questions. Mathematical skills example: use a calculator to evaluate a percentage.'
(root/'institution-maths-only.txt').write_text(text+'\n')
(root/'fixtures.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
