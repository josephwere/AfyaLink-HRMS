const fs = require('fs');
const path = require('path');
const PDFDocument = require('/home/joseph-were/Downloads/AfyaLink-HRMS-main/backend/node_modules/pdfkit');

const outDir = __dirname;
const logoPath = '/home/joseph-were/Downloads/AfyaLink-HRMS-main/frontend/public/logo.png';
const founder = {
  name: 'JOSEPH OGWE WERE',
  title: 'Founder & CEO',
  phone: '0712462780',
  email: 'werejosephogwe@gmail.com',
  address: 'Nairobi, Kenya',
};
const company = {
  name: 'Goldege',
  brandLine: 'AfyaLink by Goldege',
  phone: '0740564077',
  email: 'goldegelabs@gmail.com',
  address: 'Nairobi, Kenya',
};

const decks = [
  {
    input: path.join(outDir, 'AfyaLink_Kenya_MOH_Pitch_Deck.md'),
    output: path.join(outDir, 'AfyaLink_Kenya_MOH_Pitch_Deck.pdf'),
    subtitle: 'Kenya Ministry of Health Partnership',
    theme: 'public',
  },
  {
    input: path.join(outDir, 'AfyaLink_Teaching_Hospital_Partnership_Pitch_Deck.md'),
    output: path.join(outDir, 'AfyaLink_Teaching_Hospital_Partnership_Pitch_Deck.pdf'),
    subtitle: 'Teaching Hospital / University Partnership',
    theme: 'academic',
  },
  {
    input: path.join(outDir, 'AfyaLink_Investor_Pitch_Deck.md'),
    output: path.join(outDir, 'AfyaLink_Investor_Pitch_Deck.pdf'),
    subtitle: 'Investor Pitch Deck',
    theme: 'investor',
  },
  {
    input: path.join(outDir, 'AfyaLink_County_Government_Pitch_Deck.md'),
    output: path.join(outDir, 'AfyaLink_County_Government_Pitch_Deck.pdf'),
    subtitle: 'County Government Partnership',
    theme: 'county',
  },
];

const palettes = {
  public: {
    primary: '#0F766E',
    secondary: '#14B8A6',
    accent: '#CCFBF1',
    dark: '#0F172A',
    kenyaRed: '#B91C1C',
    kenyaGreen: '#166534',
  },
  academic: {
    primary: '#1D4ED8',
    secondary: '#60A5FA',
    accent: '#DBEAFE',
    dark: '#0F172A',
    kenyaRed: '#DC2626',
    kenyaGreen: '#15803D',
  },
  investor: {
    primary: '#166534',
    secondary: '#4ADE80',
    accent: '#DCFCE7',
    dark: '#0F172A',
    kenyaRed: '#B91C1C',
    kenyaGreen: '#14532D',
  },
  county: {
    primary: '#7C2D12',
    secondary: '#FB923C',
    accent: '#FFEDD5',
    dark: '#111827',
    kenyaRed: '#B91C1C',
    kenyaGreen: '#166534',
  },
};

function parseDeck(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      blocks.push({ type: 'space' });
    } else if (line.startsWith('# ')) {
      blocks.push({ type: 'h1', text: line.slice(2) });
    } else if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', text: line.slice(3) });
    } else if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', text: line.slice(4) });
    } else if (line.startsWith('- ')) {
      blocks.push({ type: 'bullet', text: line.slice(2) });
    } else {
      blocks.push({ type: 'p', text: line });
    }
  }
  return blocks;
}

function drawKenyaRibbon(doc, palette, y, width) {
  const stripeHeight = 8;
  doc.rect(0, y, width, stripeHeight).fill('#111111');
  doc.rect(0, y + stripeHeight, width, 2).fill('#FFFFFF');
  doc.rect(0, y + stripeHeight + 2, width, stripeHeight).fill(palette.kenyaRed);
  doc.rect(0, y + stripeHeight + 10, width, 2).fill('#FFFFFF');
  doc.rect(0, y + stripeHeight + 12, width, stripeHeight).fill(palette.kenyaGreen);
}

function drawLogo(doc, x, y, size) {
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, x, y, { fit: [size, size] });
  } else {
    doc.circle(x + size / 2, y + size / 2, size / 2).fill('#CBD5E1');
  }
}

function drawContactCard(doc, palette, x, y, width) {
  doc.roundedRect(x, y, width, 138, 16).fill('#FFFFFF');
  doc.roundedRect(x, y, 8, 138, 6).fill(palette.primary);
  doc.fillColor(palette.dark).font('Helvetica-Bold').fontSize(12).text('Contact', x + 24, y + 14);
  doc.fillColor(palette.dark).font('Helvetica-Bold').fontSize(11).text(founder.name, x + 24, y + 34);
  doc.fillColor('#64748B').font('Helvetica').fontSize(9).text(founder.title, x + 24, y + 49);
  doc.fillColor('#334155').font('Helvetica').fontSize(10).text(
    `Phone: ${founder.phone}\nEmail: ${founder.email}\nAddress: ${founder.address}`,
    x + 24,
    y + 66,
    { width: width - 48, lineGap: 2 }
  );
  doc.fillColor(palette.dark).font('Helvetica-Bold').fontSize(10).text(company.brandLine, x + 24, y + 104);
  doc.fillColor('#475569').font('Helvetica').fontSize(9).text(
    `${company.name} | Phone: ${company.phone} | Email: ${company.email} | Address: ${company.address}`,
    x + 24,
    y + 118,
    { width: width - 48, lineGap: 2 }
  );
}

function drawCover(doc, deck, palette, title) {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;

  doc.rect(0, 0, pageWidth, pageHeight).fill('#F8FAFC');
  doc.circle(pageWidth - 40, 78, 120).fillOpacity(0.08).fill(palette.secondary).fillOpacity(1);
  doc.circle(pageWidth - 10, 165, 84).fillOpacity(0.12).fill(palette.primary).fillOpacity(1);
  doc.roundedRect(36, 36, pageWidth - 72, pageHeight - 72, 28).lineWidth(1).strokeColor('#E2E8F0').stroke();
  drawKenyaRibbon(doc, palette, pageHeight - 40, pageWidth);

  doc.roundedRect(58, 60, pageWidth - 116, 180, 22).fill(palette.dark);
  drawLogo(doc, 78, 84, 78);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(28).text(title, 172, 94, {
    width: pageWidth - 250,
  });
  doc.fillColor('#E2E8F0').font('Helvetica').fontSize(16).text(deck.subtitle, 172, 154, {
    width: pageWidth - 250,
  });
  doc.fillColor('#CBD5E1').fontSize(10).text('AfyaLink proposal deck', 172, 200, {
    width: pageWidth - 250,
  });

  doc.roundedRect(58, 275, pageWidth - 116, 172, 22).fill('#FFFFFF');
  doc.roundedRect(58, 275, 12, 172, 8).fill(palette.primary);
  doc.fillColor(palette.primary).font('Helvetica-Bold').fontSize(15).text('Platform themes', 92, 296);

  const themes = [
    'Unified hospital administration, workforce, and operational control',
    'Clinical, diagnostics, pharmacy, billing, and continuity workflows',
    'Governance, observability, resilience, and interoperability readiness',
  ];
  let y = 332;
  themes.forEach((item, index) => {
    doc.circle(100, y + 7, 4).fill(index === 1 ? palette.kenyaRed : palette.secondary);
    doc.fillColor('#334155').font('Helvetica').fontSize(11).text(item, 114, y, {
      width: pageWidth - 180,
      lineGap: 2,
    });
    y += 36;
  });

  drawContactCard(doc, palette, 58, 468, pageWidth - 116);

  doc.fillColor(palette.primary).font('Helvetica-Bold').fontSize(11).text('AFYALINK', 58, pageHeight - 72);
  doc.fillColor('#64748B').font('Helvetica').fontSize(9).text(deck.subtitle, 132, pageHeight - 71);
}

function drawHeader(doc, deck, palette, pageNumber) {
  doc.save();
  doc.rect(0, 0, doc.page.width, 30).fill(palette.dark);
  doc.rect(0, 30, doc.page.width, 3).fill(palette.primary);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10).text('AFYALINK', 50, 11, { lineBreak: false });
  doc.font('Helvetica').fontSize(9).text(deck.subtitle, 122, 12, {
    width: doc.page.width - 210,
    lineBreak: false,
  });
  doc.fillColor(palette.primary).font('Helvetica-Bold').fontSize(9).text(String(pageNumber), doc.page.width - 65, 12, {
    width: 20,
    align: 'right',
    lineBreak: false,
  });
  doc.restore();
}

function drawSectionDivider(doc, palette, text) {
  const top = doc.y;
  doc.roundedRect(50, top, doc.page.width - 100, 30, 12).fill(palette.accent);
  doc.rect(50, top, 10, 30).fill(palette.primary);
  doc.fillColor(palette.primary).font('Helvetica-Bold').fontSize(15).text(text, 74, top + 8, {
    width: doc.page.width - 148,
    lineBreak: false,
  });
  doc.moveTo(74, top + 38).lineTo(doc.page.width - 50, top + 38).lineWidth(1).strokeColor('#E2E8F0').stroke();
  doc.y = top + 44;
}

function drawFooter(doc, palette, pageNumber) {
  drawKenyaRibbon(doc, palette, doc.page.height - 24, doc.page.width);
  doc.fillColor('#64748B').font('Helvetica').fontSize(8).text(String(pageNumber), 0, doc.page.height - 38, {
    width: doc.page.width,
    align: 'center',
    lineBreak: false,
  });
}

function drawClosingContact(doc, palette) {
  const boxY = doc.page.height - 132;
  doc.roundedRect(50, boxY, doc.page.width - 100, 70, 16).fill(palette.accent);
  doc.fillColor(palette.dark).font('Helvetica-Bold').fontSize(12).text('Contact and partnership follow-up', 70, boxY + 14);
  doc.fillColor('#334155').font('Helvetica').fontSize(9).text(
    `${founder.name} — ${founder.title} | ${founder.phone} | ${founder.email} | ${founder.address}`,
    70,
    boxY + 34,
    { width: doc.page.width - 140, lineGap: 2 }
  );
  doc.fillColor('#475569').text(
    `${company.brandLine} | ${company.phone} | ${company.email} | ${company.address}`,
    70,
    boxY + 50,
    { width: doc.page.width - 140, lineGap: 2 }
  );
}

function renderDeck(deck) {
  const palette = palettes[deck.theme] || palettes.public;
  const blocks = parseDeck(fs.readFileSync(deck.input, 'utf8'));
  const title = blocks.find((block) => block.type === 'h1')?.text || 'AFYALINK';
  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
  const stream = fs.createWriteStream(deck.output);
  doc.pipe(stream);

  function addContentPage() {
    doc.addPage();
    doc.y = 56;
  }

  function ensureSpace(minSpace = 70) {
    if (doc.y > doc.page.height - doc.page.margins.bottom - minSpace) {
      addContentPage();
    }
  }

  drawCover(doc, deck, palette, title);
  addContentPage();

  let previousType = null;
  let closingInserted = false;
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (block.type === 'h1') {
      previousType = block.type;
      continue;
    }

    if (block.type === 'space') {
      if (previousType && previousType !== 'space') {
        doc.moveDown(0.18);
      }
      previousType = block.type;
      continue;
    }

    if (block.type === 'h2') {
      ensureSpace(88);
      drawSectionDivider(doc, palette, block.text);
      previousType = block.type;
      continue;
    }

    if (block.type === 'h3') {
      ensureSpace(60);
      doc.fillColor(palette.dark).font('Helvetica-Bold').fontSize(12).text(block.text);
      doc.moveDown(0.12);
      previousType = block.type;
      continue;
    }

    if (block.type === 'bullet') {
      ensureSpace(46);
      const startY = doc.y;
      doc.circle(62, startY + 6, 3.2).fill(palette.primary);
      doc.fillColor('#334155').font('Helvetica').fontSize(10.5).text(block.text, 74, startY, {
        width: doc.page.width - 132,
        lineGap: 1,
      });
      doc.moveDown(0.25);
      previousType = block.type;
    } else {
      ensureSpace(50);
      doc.fillColor('#334155').font('Helvetica').fontSize(10.5).text(block.text, {
        lineGap: 1,
        paragraphGap: 2,
      });
      previousType = block.type;
    }

    const isLastContent = index === blocks.length - 1;
    if (isLastContent && !closingInserted) {
      ensureSpace(92);
      drawClosingContact(doc, palette);
      closingInserted = true;
    }
  }

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(i);
    if (i === 0) {
      drawFooter(doc, palette, 1);
    } else {
      drawHeader(doc, deck, palette, i + 1);
      drawFooter(doc, palette, i + 1);
    }
  }

  doc.end();
  return new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

(async () => {
  for (const deck of decks) {
    await renderDeck(deck);
  }
  console.log(`Generated ${decks.length} premium AfyaLink pitch deck PDFs in ${outDir}`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
