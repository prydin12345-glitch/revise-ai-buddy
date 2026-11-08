from pathlib import Path
import hashlib,json,re,subprocess
import fitz
root=Path(__file__).parent
reports=[]
for theme in ['light','dark']:
    pdf=root/f'physics-{theme}.pdf'
    info=subprocess.run(['pdfinfo',str(pdf)],check=True,capture_output=True,text=True).stdout
    pages=int(re.search(r'^Pages:\s+(\d+)',info,re.M)[1])
    out=root/f'physics-{theme}.txt'
    subprocess.run(['pdftotext','-layout',str(pdf),str(out)],check=True)
    text=out.read_text()
    assert pages>=3, 'A complete PDF was not produced.'
    for expected in ['Heater measurements','Absolute uncertainty','12.0','2.00','Question 5','Question 6','Question 7','tesla','ohm']:
        assert expected in text, f'Missing PDF content: {expected}'
    assert not re.search(r'Correct answer|Expected answer|Worked solution|PRIVATE_KEY_SENTINEL',text,re.I), 'Private answer disclosed.'
    for label in 'ABCD':
        assert len(re.findall(r'^\s*'+label+r'\)',text,re.M))==1, f'Option {label} is missing or duplicated.'
    assert 'm^{-1}' not in text, 'A raw exponent remains in the PDF option.'
    captures=json.loads((root/f'pdf-capture-{theme}.json').read_text())['captures']
    assert len(captures)==3, 'A decorative or completed-answer circuit entered the PDF.'
    assert any('Time / s' in c['text'] and 'Potential difference / V' in c['text'] and c['hasSvg'] for c in captures)
    assert any('Time / ms' in c['text'] and 'Flux linkage / mWb' in c['text'] and c['hasSvg'] for c in captures)
    reports.append({'theme':theme,'pages':pages,'numberedBodyPages':pages-1,'bytes':pdf.stat().st_size,'sha256':hashlib.sha256(pdf.read_bytes()).hexdigest(),'tableTextPresent':True,'fourOptionsExactlyOnce':True,'rawExponentAbsent':True,'privateAnswersAbsent':True,'labelledGraphSvgCaptures':True,'decorativeAndDrawingCircuitsAbsent':True})
options_page=next(i+1 for i,text in enumerate((root/'physics-light.txt').read_text().split('\f')) if 'Question 5' in text)
rasters=[]
document=fitz.open(root/'physics-light.pdf')
for physical_page,name in [(1,'pdf-first-page'),(2,'pdf-graph-page'),(options_page,'pdf-options-page')]:
    page=document[physical_page-1];scale=1600/max(page.rect.width,page.rect.height)
    page.get_pixmap(matrix=fitz.Matrix(scale,scale),alpha=False).save(root/(name+'.png'))
    rasters.append({'file':name+'.png','sha256':hashlib.sha256((root/(name+'.png')).read_bytes()).hexdigest(),'sourcePdf':'physics-light.pdf','sourcePdfSha256':reports[0]['sha256'],'physicalPage':physical_page,'bodyPage':physical_page-1 if physical_page>1 else None,'numberedBodyPages':reports[0]['pages']-1})
document.close()
result={'status':'PASS','verificationDate':'2026-11-08','pdfs':reports,'rasters':rasters,'rasterizer':{'name':'MuPDF / PyMuPDF','version':fitz.VersionBind},'pagination':'The cover is included in physical page totals; printed body footers exclude the cover.','diagnostics':['The installed Poppler rasterizer emitted fontconfig cache warnings and showed different standard-font spacing; review rasters use MuPDF. The underlying PDF text and MuPDF rendering retain normal spaces.'],'limitations':['Graphs are raster images inside the PDF; axis labels are checked in capture DOM and visual raster review.','No private saved paper, provider call or live persistence is exercised.']}
(root/'pdf-verification.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'status':'PASS','pdfs':len(reports),'pages':[r['pages'] for r in reports]}))
