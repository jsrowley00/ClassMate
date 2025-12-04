import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

interface DetectedChapter {
  title: string;
  startPage: number;
  endPage?: number;
  pageRange?: string;
}

interface ChapterDetectionResult {
  chapters: DetectedChapter[];
  totalPages: number;
  detectionMethod: 'toc' | 'heuristics' | 'none';
  confidence: 'high' | 'medium' | 'low';
}

const chapterPatterns = [
  /^chapter\s+(\d+|[ivxlcdm]+)[\s:.\-]+(.+)/i,
  /^(\d+)\.\s+(.+)/,
  /^unit\s+(\d+|[ivxlcdm]+)[\s:.\-]+(.+)/i,
  /^part\s+(\d+|[ivxlcdm]+)[\s:.\-]+(.+)/i,
  /^section\s+(\d+|[ivxlcdm]+)[\s:.\-]+(.+)/i,
  /^module\s+(\d+|[ivxlcdm]+)[\s:.\-]+(.+)/i,
  /^lesson\s+(\d+|[ivxlcdm]+)[\s:.\-]+(.+)/i,
];

const tocPatterns = [
  /table\s+of\s+contents/i,
  /contents/i,
  /^toc$/i,
];

function isTocLine(line: string): boolean {
  const trimmed = line.trim().toLowerCase();
  return tocPatterns.some(pattern => pattern.test(trimmed));
}

function extractChapterFromLine(line: string): { title: string; pageNumber?: number } | null {
  const trimmed = line.trim();
  if (trimmed.length < 3 || trimmed.length > 200) return null;
  
  for (const pattern of chapterPatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      const pageMatch = trimmed.match(/[\s.]+(\d+)\s*$/);
      const pageNumber = pageMatch ? parseInt(pageMatch[1], 10) : undefined;
      
      let title = trimmed;
      if (pageMatch) {
        title = trimmed.slice(0, -pageMatch[0].length).trim();
      }
      
      return { title, pageNumber };
    }
  }
  
  return null;
}

function detectChaptersFromToc(text: string): DetectedChapter[] {
  const lines = text.split('\n');
  const chapters: DetectedChapter[] = [];
  let inToc = false;
  let tocEndIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (isTocLine(line)) {
      inToc = true;
      tocEndIndex = i + 50;
      continue;
    }
    
    if (inToc && i < tocEndIndex) {
      const chapter = extractChapterFromLine(line);
      if (chapter) {
        chapters.push({
          title: chapter.title,
          startPage: chapter.pageNumber || chapters.length + 1,
        });
      }
      
      if (chapters.length > 0 && line.trim() === '' && lines[i + 1]?.trim() === '') {
        break;
      }
    }
    
    if (inToc && i >= tocEndIndex) {
      break;
    }
  }
  
  for (let i = 0; i < chapters.length - 1; i++) {
    chapters[i].endPage = chapters[i + 1].startPage - 1;
    chapters[i].pageRange = `${chapters[i].startPage}-${chapters[i].endPage}`;
  }
  
  return chapters;
}

function detectChaptersFromHeuristics(text: string): DetectedChapter[] {
  const lines = text.split('\n');
  const chapters: DetectedChapter[] = [];
  let currentPage = 1;
  
  const pageBreaks: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('\f') || lines[i].includes('---PAGE BREAK---')) {
      pageBreaks.push(i);
      currentPage++;
    }
  }
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line || line.length < 5 || line.length > 150) continue;
    
    for (const pattern of chapterPatterns) {
      if (pattern.test(line)) {
        const prevLine = i > 0 ? lines[i - 1].trim() : '';
        const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';
        
        const isLikelyHeader = 
          prevLine === '' || 
          line === line.toUpperCase() ||
          line.length < 80;
        
        if (isLikelyHeader) {
          let pageNum = 1;
          for (let j = 0; j < pageBreaks.length; j++) {
            if (pageBreaks[j] < i) {
              pageNum = j + 2;
            } else {
              break;
            }
          }
          
          chapters.push({
            title: line,
            startPage: pageNum,
          });
        }
        break;
      }
    }
  }
  
  for (let i = 0; i < chapters.length - 1; i++) {
    chapters[i].endPage = chapters[i + 1].startPage - 1;
    chapters[i].pageRange = `${chapters[i].startPage}-${chapters[i].endPage}`;
  }
  
  return chapters;
}

export async function detectChapters(pdfBuffer: Buffer): Promise<ChapterDetectionResult> {
  try {
    const data = await pdfParse(pdfBuffer);
    const text = data.text;
    const totalPages = data.numpages;
    
    const tocChapters = detectChaptersFromToc(text);
    if (tocChapters.length >= 3) {
      if (tocChapters[tocChapters.length - 1]) {
        tocChapters[tocChapters.length - 1].endPage = totalPages;
        tocChapters[tocChapters.length - 1].pageRange = 
          `${tocChapters[tocChapters.length - 1].startPage}-${totalPages}`;
      }
      
      return {
        chapters: tocChapters,
        totalPages,
        detectionMethod: 'toc',
        confidence: 'high',
      };
    }
    
    const heuristicChapters = detectChaptersFromHeuristics(text);
    if (heuristicChapters.length >= 2) {
      if (heuristicChapters[heuristicChapters.length - 1]) {
        heuristicChapters[heuristicChapters.length - 1].endPage = totalPages;
        heuristicChapters[heuristicChapters.length - 1].pageRange = 
          `${heuristicChapters[heuristicChapters.length - 1].startPage}-${totalPages}`;
      }
      
      return {
        chapters: heuristicChapters,
        totalPages,
        detectionMethod: 'heuristics',
        confidence: 'medium',
      };
    }
    
    return {
      chapters: [{
        title: 'Full Textbook',
        startPage: 1,
        endPage: totalPages,
        pageRange: `1-${totalPages}`,
      }],
      totalPages,
      detectionMethod: 'none',
      confidence: 'low',
    };
  } catch (error) {
    console.error('Error parsing PDF for chapter detection:', error);
    throw error;
  }
}

export async function extractTextFromPdfPages(
  pdfBuffer: Buffer, 
  startPage: number, 
  endPage: number
): Promise<string> {
  try {
    const data = await pdfParse(pdfBuffer, {
      pagerender: function(pageData: any) {
        const pageNum = pageData.pageIndex + 1;
        if (pageNum >= startPage && pageNum <= endPage) {
          return pageData.getTextContent().then((textContent: any) => {
            return textContent.items.map((item: any) => item.str).join(' ');
          });
        }
        return Promise.resolve('');
      }
    });
    
    return data.text;
  } catch (error) {
    console.error('Error extracting text from PDF pages:', error);
    const data = await pdfParse(pdfBuffer);
    return data.text;
  }
}

export function parseManualChapters(
  chapterDefinitions: Array<{ title: string; startPage: number; endPage: number }>
): DetectedChapter[] {
  return chapterDefinitions.map(def => ({
    title: def.title,
    startPage: def.startPage,
    endPage: def.endPage,
    pageRange: `${def.startPage}-${def.endPage}`,
  }));
}
