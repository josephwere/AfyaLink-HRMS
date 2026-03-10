from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from xml.sax.saxutils import escape

OUT_DIR = Path('/home/joseph-were/Downloads/AfyaLink-HRMS-main/proposals')
FOUNDER = {
    'name': 'JOSEPH OGWE WERE',
    'title': 'Founder & CEO',
    'phone': '0712462780',
    'email': 'werejosephogwe@gmail.com',
    'address': 'Nairobi, Kenya',
}
COMPANY = {
    'name': 'Goldege',
    'brandLine': 'AfyaLink by Goldege',
    'phone': '0740564077',
    'email': 'goldegelabs@gmail.com',
    'address': 'Nairobi, Kenya',
}
DECKS = [
    ('AfyaLink_Kenya_MOH_Pitch_Deck.md', 'AfyaLink_Kenya_MOH_Pitch_Deck.pptx', 'Kenya Ministry of Health Partnership', '#0F766E', '#14B8A6', '#0F172A'),
    ('AfyaLink_Teaching_Hospital_Partnership_Pitch_Deck.md', 'AfyaLink_Teaching_Hospital_Partnership_Pitch_Deck.pptx', 'Teaching Hospital / University Partnership', '#1D4ED8', '#60A5FA', '#0F172A'),
    ('AfyaLink_Investor_Pitch_Deck.md', 'AfyaLink_Investor_Pitch_Deck.pptx', 'Investor Pitch Deck', '#166534', '#4ADE80', '#0F172A'),
    ('AfyaLink_County_Government_Pitch_Deck.md', 'AfyaLink_County_Government_Pitch_Deck.pptx', 'County Government Partnership', '#7C2D12', '#FB923C', '#111827'),
]
CX = 12192000
CY = 6858000

def emu(n):
    return str(int(n))

def parse_deck(text):
    blocks = []
    for raw in text.replace('\r\n', '\n').split('\n'):
        line = raw.rstrip()
        if not line.strip():
            blocks.append(('space', ''))
        elif line.startswith('# '):
            blocks.append(('h1', line[2:]))
        elif line.startswith('## '):
            blocks.append(('h2', line[3:]))
        elif line.startswith('### '):
            blocks.append(('h3', line[4:]))
        elif line.startswith('- '):
            blocks.append(('bullet', line[2:]))
        else:
            blocks.append(('p', line))
    return blocks

def split_sections(blocks):
    sections = []
    current = {'title': 'Overview', 'items': []}
    title = next((text for typ, text in blocks if typ == 'h1'), 'AFYALINK')
    for typ, text in blocks:
        if typ == 'h1':
            continue
        if typ == 'h2':
            if current['items']:
                sections.append(current)
            current = {'title': text, 'items': []}
        elif typ in ('h3', 'bullet', 'p'):
            prefix = '• ' if typ == 'bullet' else ''
            current['items'].append((typ, prefix + text))
    if current['items']:
        sections.append(current)
    return title, sections

def chunk_section(section):
    slides = []
    current = []
    score = 0
    for typ, text in section['items']:
        weight = 2 if typ == 'h3' else 1
        extra = max(1, len(text) // 90)
        needed = weight + extra
        if current and score + needed > 7:
            slides.append(current)
            current = []
            score = 0
        current.append((typ, text))
        score += needed
    if current:
        slides.append(current)
    return slides or [[('p', '')]]

def text_box(shape_id, name, x, y, w, h, text, font_size, color='1F2937', bold=False):
    text = escape(text)
    bold_attr = ' b="1"' if bold else ''
    return f'''<p:sp>
<p:nvSpPr><p:cNvPr id="{shape_id}" name="{escape(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="{emu(x)}" y="{emu(y)}"/><a:ext cx="{emu(w)}" cy="{emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>
<p:txBody><a:bodyPr wrap="square" rtlCol="0" anchor="t"/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="{font_size*100}" dirty="0" smtClean="0"{bold_attr}><a:solidFill><a:srgbClr val="{color}"/></a:solidFill></a:rPr><a:t>{text}</a:t></a:r><a:endParaRPr lang="en-US" sz="{font_size*100}" dirty="0"/></a:p></p:txBody>
</p:sp>'''

def rect(shape_id, name, x, y, w, h, fill):
    return f'''<p:sp>
<p:nvSpPr><p:cNvPr id="{shape_id}" name="{escape(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="{emu(x)}" y="{emu(y)}"/><a:ext cx="{emu(w)}" cy="{emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="{fill}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr>
<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody>
</p:sp>'''

def slide_xml(shapes):
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    {''.join(shapes)}
  </p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>'''

def make_cover(title, subtitle, primary, secondary, dark):
    shapes = [
        rect(2, 'BG', 0, 0, CX, CY, 'F8FAFC'),
        rect(3, 'Hero', 530000, 420000, 11100000, 1700000, dark.replace('#','')),
        rect(4, 'Accent', 530000, 2600000, 11100000, 1200000, primary.replace('#','')),
        rect(5, 'RibbonBlack', 0, CY-260000, CX, 70000, '111111'),
        rect(6, 'RibbonRed', 0, CY-170000, CX, 70000, 'DC2626'),
        rect(7, 'RibbonGreen', 0, CY-80000, CX, 70000, '16A34A'),
        text_box(8, 'Brand', 900000, 700000, 2500000, 500000, 'AFYALINK', 24, 'FFFFFF', True),
        text_box(9, 'Title', 900000, 1150000, 9500000, 700000, title, 28, 'FFFFFF', True),
        text_box(10, 'Subtitle', 900000, 1800000, 9000000, 500000, subtitle, 17, 'CBD5E1', False),
        text_box(11, 'Deck', 900000, 2850000, 3000000, 400000, 'AfyaLink proposal deck', 16, 'FFFFFF', True),
        text_box(12, 'Founder', 900000, 4200000, 4500000, 700000, f"{FOUNDER['name']}\n{FOUNDER['title']}\n{FOUNDER['phone']}\n{FOUNDER['email']}", 14, '1F2937', False),
        text_box(13, 'Company', 6200000, 4200000, 4200000, 700000, f"{COMPANY['brandLine']}\n{COMPANY['phone']}\n{COMPANY['email']}\n{COMPANY['address']}", 14, '1F2937', False),
    ]
    return slide_xml(shapes)

def make_content_slide(deck_subtitle, section_title, items, primary, secondary, dark, page_num):
    shapes = [
        rect(2, 'BG', 0, 0, CX, CY, 'FFFFFF'),
        rect(3, 'HeaderDark', 0, 0, CX, 300000, dark.replace('#','')),
        rect(4, 'HeaderPrimary', 0, 300000, CX, 30000, primary.replace('#','')),
        text_box(5, 'HeaderBrand', 500000, 70000, 1800000, 180000, 'AFYALINK', 11, 'FFFFFF', True),
        text_box(6, 'HeaderSub', 2500000, 80000, 7000000, 180000, deck_subtitle, 10, 'E2E8F0', False),
        text_box(7, 'Section', 700000, 620000, 9000000, 450000, section_title, 24, primary.replace('#',''), True),
        rect(8, 'Divider', 700000, 1080000, 9800000, 50000, secondary.replace('#','')),
    ]
    y = 1400000
    sid = 9
    for typ, text in items:
        if typ == 'h3':
            shapes.append(text_box(sid, f'H3{sid}', 800000, y, 9800000, 260000, text, 16, dark.replace('#',''), True))
            y += 320000
        else:
            shapes.append(text_box(sid, f'Item{sid}', 900000, y, 9600000, 320000, text, 14, '334155', False))
            y += 360000
        sid += 1
    shapes += [
        rect(sid, 'RibbonBlack', 0, CY-250000, CX, 60000, '111111'),
        rect(sid+1, 'RibbonRed', 0, CY-170000, CX, 60000, 'DC2626'),
        rect(sid+2, 'RibbonGreen', 0, CY-90000, CX, 60000, '16A34A'),
        text_box(sid+3, 'Page', 5800000, CY-420000, 600000, 180000, str(page_num), 10, '64748B', False),
    ]
    return slide_xml(shapes)

def slide_rels():
    return '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>'''

def content_types(slide_count):
    overrides = ''.join([f'<Override PartName="/ppt/slides/slide{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>' for i in range(1, slide_count+1)])
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/>
  <Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/>
  <Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  {overrides}
</Types>'''

def root_rels():
    return '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>'''

def presentation_xml(slide_count):
    slide_ids = ''.join([f'<p:sldId id="{256+i}" r:id="rId{5+i}"/>' for i in range(slide_count)])
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>{slide_ids}</p:sldIdLst>
  <p:sldSz cx="{CX}" cy="{CY}" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
  <p:defaultTextStyle/>
</p:presentation>'''

def presentation_rels(slide_count):
    rels = [
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>',
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps" Target="presProps.xml"/>',
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" Target="viewProps.xml"/>',
        '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles" Target="tableStyles.xml"/>',
    ]
    for i in range(slide_count):
        rels.append(f'<Relationship Id="rId{5+i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide{i+1}.xml"/>')
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + ''.join(rels) + '</Relationships>'

def slide_master_xml():
    return '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld name="Master"><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></p:bgPr></p:bg></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>'''

def slide_master_rels():
    return '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>'''

def slide_layout_xml():
    return '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>'''

def slide_layout_rels():
    return '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>'''

def theme_xml():
    return '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="AfyaLink Theme"><a:themeElements><a:clrScheme name="Custom"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F2937"/></a:dk2><a:lt2><a:srgbClr val="F8FAFC"/></a:lt2><a:accent1><a:srgbClr val="0F766E"/></a:accent1><a:accent2><a:srgbClr val="14B8A6"/></a:accent2><a:accent3><a:srgbClr val="1D4ED8"/></a:accent3><a:accent4><a:srgbClr val="166534"/></a:accent4><a:accent5><a:srgbClr val="DC2626"/></a:accent5><a:accent6><a:srgbClr val="16A34A"/></a:accent6><a:hlink><a:srgbClr val="2563EB"/></a:hlink><a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink></a:clrScheme><a:fontScheme name="Office"><a:majorFont><a:latin typeface="Aptos"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle/></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>'''

def app_xml():
    return '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Microsoft Office PowerPoint</Application></Properties>'''

def core_xml():
    return '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>AfyaLink Proposal Deck</dc:title><dc:creator>OpenAI Codex</dc:creator></cp:coreProperties>'''

def simple_xml(tag):
    return f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:{tag} xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>'

def build_deck(md_name, pptx_name, subtitle, primary, secondary, dark):
    text = (OUT_DIR / md_name).read_text()
    blocks = parse_deck(text)
    title, sections = split_sections(blocks)
    slides = [make_cover(title, subtitle, primary, secondary, dark)]
    page = 2
    for section in sections:
        for chunk in chunk_section(section):
            slides.append(make_content_slide(subtitle, section['title'], chunk, primary, secondary, dark, page))
            page += 1
    out = OUT_DIR / pptx_name
    with ZipFile(out, 'w', ZIP_DEFLATED) as zf:
        zf.writestr('[Content_Types].xml', content_types(len(slides)))
        zf.writestr('_rels/.rels', root_rels())
        zf.writestr('docProps/app.xml', app_xml())
        zf.writestr('docProps/core.xml', core_xml())
        zf.writestr('ppt/presentation.xml', presentation_xml(len(slides)))
        zf.writestr('ppt/_rels/presentation.xml.rels', presentation_rels(len(slides)))
        zf.writestr('ppt/presProps.xml', simple_xml('presProps'))
        zf.writestr('ppt/viewProps.xml', simple_xml('viewProps'))
        zf.writestr('ppt/tableStyles.xml', simple_xml('tblStyleLst'))
        zf.writestr('ppt/slideMasters/slideMaster1.xml', slide_master_xml())
        zf.writestr('ppt/slideMasters/_rels/slideMaster1.xml.rels', slide_master_rels())
        zf.writestr('ppt/slideLayouts/slideLayout1.xml', slide_layout_xml())
        zf.writestr('ppt/slideLayouts/_rels/slideLayout1.xml.rels', slide_layout_rels())
        zf.writestr('ppt/theme/theme1.xml', theme_xml())
        for i, slide in enumerate(slides, start=1):
            zf.writestr(f'ppt/slides/slide{i}.xml', slide)
            zf.writestr(f'ppt/slides/_rels/slide{i}.xml.rels', slide_rels())

for deck in DECKS:
    build_deck(*deck)
print(f'Generated {len(DECKS)} AfyaLink PPTX decks in {OUT_DIR}')
