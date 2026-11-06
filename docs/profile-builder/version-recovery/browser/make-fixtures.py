from pathlib import Path
import hashlib,json
root=Path(__file__).parent
filler='A synthetic study note describes measurements and experimental records. This text is original fixture material and carries no assessment rules.'
source_version='Version 1.4 July 2026'

def pdf(path,pages):
    objects=[b'<< /Type /Catalog /Pages 2 0 R >>',b'',b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
    kids=[]
    for lines in pages:
        page_id=len(objects)+1; stream_id=page_id+1;kids.append(f'{page_id} 0 R')
        objects.append(f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents {stream_id} 0 R >>'.encode())
        esc=lambda x:x.replace('\\','\\\\').replace('(','\\(').replace(')','\\)')
        stream=('BT /F1 10 Tf 42 752 Td 14 TL '+' '.join(('T* ' if i else '')+'('+esc(line)+') Tj' for i,line in enumerate(lines))+' ET').encode('ascii')
        objects.append(b'<< /Length '+str(len(stream)).encode()+b' >>\nstream\n'+stream+b'\nendstream')
    objects[1]=f'<< /Type /Pages /Kids [{" ".join(kids)}] /Count {len(pages)} >>'.encode()
    data=bytearray(b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');offsets=[0]
    for i,obj in enumerate(objects,1):
        offsets.append(len(data));data.extend(f'{i} 0 obj\n'.encode()+obj+b'\nendobj\n')
    xref=len(data);data.extend(f'xref\n0 {len(objects)+1}\n0000000000 65535 f \n'.encode())
    for offset in offsets[1:]:data.extend(f'{offset:010d} 00000 n \n'.encode())
    data.extend(f'trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode())
    path.write_bytes(data)
    return {'pages':len(pages),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}

def long_assessment(paper=1,as_only=False,missing_dates=False):
    pages=[]
    for page in range(1,97):
        pages.append([f'Original synthetic study material - physical page {page}']+[f'{n+1}. '+filler[:106] for n in range(25)])
    pages[0]=['Synthetic qualification source for software verification','AQA Physics','AS' if as_only else 'A-level',('Course 7407' if as_only else 'Course 7408'),f'Specification version: {source_version}',('For teaching from onwards; first exams onwards' if missing_dates else 'First teaching 2015, first exams 2017'),'This original synthetic document is not an official AQA assessment.']
    pages[89]=(['AS','Paper 1 (7407/1)','70 marks; 90 minutes.','AS-only introductory material.','A-level'] if not as_only else ['AS'])+[
        f'Paper {paper} (7408/{paper})' if not as_only else 'Paper 1 (7407/1)',
        f'Course {7407 if as_only else 7408}. Specification version: {source_version}.',
        'This assessment is untiered. 85 marks; 120 minutes.',
        'Topics: Measurements and their errors; Particles and radiation.',
        'Short structured answers. Answer all questions. Calculator allowed.',
        'Original synthetic fixture rules; no official question content is copied.'
    ]
    return pages

report={}
for name,pages in [('physics-paper1-96-pages.pdf',long_assessment()),('physics-paper2-96-pages.pdf',long_assessment(2)),('physics-missing-dates-96-pages.pdf',long_assessment(missing_dates=True)),('physics-as-only-96-pages.pdf',long_assessment(as_only=True))]:
    report[name]=pdf(root/name,pages)
(root/'physics-option.txt').write_text('AQA A-level Physics\nCourse 7408\nA-level\nPaper 3 Section B Option A - Astrophysics (7408/3BA)\nSpecification version: Version 1.4 July 2026\nThis assessment is untiered.\nAstrophysics\n35 marks; 60 minutes.\nShort structured answers. Answer all questions. Calculator allowed.\n')
(root/'fixtures.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
