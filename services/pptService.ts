import PptxGenJS from 'pptxgenjs';
import type { CandidateData, WorkExperience, Education } from '../types';

// Helper to chunk an array into smaller arrays
function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
    arr.slice(i * size, i * size + size)
  );
}

export const createPresentation = async (candidates: CandidateData[]): Promise<void> => {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';

  // --- Title Slide (Replicating style from user's PDF) ---
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: 'FDD803' };
  // Add decorative shapes to mimic the design
  titleSlide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w:'30%', h:'100%', fill: { color: 'FFFFFF', transparency: 70 } });
  titleSlide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w:'25%', h:'100%', fill: { color: 'FFFFFF' } });
  titleSlide.addText('Candidate Longlist Summary', {
    x: 0.5, y: 1.5, w: 8, h: 2, fontSize: 44, bold: true, color: '333333', align: 'center'
  });
  titleSlide.addText(`Generated on: ${new Date().toLocaleDateString()}`, {
    x: 0.5, y: 3.5, w: 8, h: 1, fontSize: 18, color: '666666', align: 'center'
  });
  
  // --- Candidate Slides ---
  const candidatePages = chunk(candidates, 4);

  for (const page of candidatePages) {
    const slide = pptx.addSlide();
    slide.background = { color: 'FFFFFF' };
    
    // Add header logo text
    slide.addText([
      { text: 'suorahaku-', options: { fontSize: 12, color: 'FDD803', bold: true } },
      { text: 'toimisto', options: { fontSize: 12, color: '333333', bold: true } }
    ], { x: 11.5, y: 0.25, w: 1.5, h: 0.5, align: 'right' });


    page.forEach((candidate, index) => {
      const y = 0.75 + index * 1.7;

      // Add alternating background color
      if (index % 2 !== 0) {
        slide.addShape(pptx.ShapeType.rect, {
          x: 0, y: y - 0.1, w: '100%', h: 1.7, fill: { color: 'FFFBEA' }
        });
      }

      // Education (Left Column)
      const educationText: PptxGenJS.TextProps[] = [];
      candidate.education.forEach((edu, eduIndex) => {
        if (eduIndex > 0) educationText.push({ text: '', options: { breakLine: true } });
        const institutionLine = edu.dates ? `${edu.institution} ${edu.dates}` : edu.institution;
        educationText.push({ text: institutionLine, options: { bold: true, fontSize: 11 } });
        educationText.push({ text: edu.degree, options: { fontSize: 10, bullet: true, indentLevel: 1 } });
      });
      slide.addText(educationText, { x: 0.5, y: y, w: 5, h: 1.5, valign: 'top' });

      // Name & Work History (Right Column)
      const workHistoryText: PptxGenJS.TextProps[] = [];
      workHistoryText.push({ text: candidate.name.toUpperCase(), options: { bold: true, fontSize: 12, color: '000000' } });
      workHistoryText.push({ text: '', options: { breakLine: true } }); // Spacer
      
      candidate.workHistory.forEach((job) => {
        const jobLine = job.dates ? `${job.company} - ${job.jobTitle} ${job.dates}` : `${job.company} - ${job.jobTitle}`;
        workHistoryText.push({ text: jobLine, options: { fontSize: 10, bullet: true } });
      });
      slide.addText(workHistoryText, { x: 6.5, y: y, w: 6.5, h: 1.5, valign: 'top' });
    });
  }

  await pptx.writeFile({ fileName: 'Candidate_Summary.pptx' });
};