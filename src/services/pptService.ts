import PizZip from 'pizzip';
import { saveAs } from 'file-saver';
import type { CandidateData } from '../types';

/**
 * Escapes special characters for inclusion in XML content.
 */
function escapeXml(text: string): string {
  if (text === null || text === undefined) {
    return '';
  }
  return text
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Escapes special characters for use in a regular expression.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const createPresentation = async (candidates: CandidateData[], templateContent: ArrayBuffer): Promise<void> => {
  try {
    const zip = new PizZip(templateContent);
    const templateData: { [key: string]: any } = {};
    const MAX_CANDIDATES = 60; // Support up to 60 candidates

    // A special marker for soft line breaks that we'll convert to XML tags.
    const LINE_BREAK_MARKER = '{{--PPT_LINE_BREAK--}}';

    candidates.slice(0, MAX_CANDIDATES).forEach((candidate, index) => {
      const i = index + 1; // Placeholder indices are 1-based

      templateData[`NAME_${i}`] = candidate.name.toUpperCase();

      // Format work history as a single string with line break markers.
      // This is the key to making "Shrink text on overflow" work correctly.
      const workHistoryText = candidate.workHistory.slice(0, 5).map(job =>
        `• ${job.company} • ${job.jobTitle}${job.dates ? ` · ${job.dates}` : ''}`
      ).join(LINE_BREAK_MARKER);

      if (workHistoryText) {
        templateData[`WORK_HISTORY_TEXT_${i}`] = workHistoryText;
      }

      // Format education as a single string for the same reasons.
      const educationText = candidate.education.map(edu =>
        `• ${edu.institution} • ${edu.degree}${edu.dates ? ` · ${edu.dates}` : ''}`
      ).join(LINE_BREAK_MARKER);

      if (educationText) {
        templateData[`EDUCATION_TEXT_${i}`] = educationText;
      }
    });

    // Process all slide files in the presentation
    const slideFiles = Object.keys(zip.files).filter(name => name.match(/^ppt\/slides\/slide\d+\.xml$/));
    
    slideFiles.forEach(slideFile => {
      const initialSlideXml = zip.file(slideFile)?.asText();
      if (!initialSlideXml) {
        return;
      }
      
      let processedXml = initialSlideXml;

      // --- Main Placeholder Replacement Logic ---
      Object.keys(templateData).forEach(key => {
        const placeholder = `{{${key}}}`;
        const value = templateData[key];

        if (typeof value === 'string' && value.includes(LINE_BREAK_MARKER)) {
          // --- Advanced Replacement for Text with Line Breaks ---
          const parts = value.split(LINE_BREAK_MARKER);
          
          // Regex to find the entire <a:r> (run) element containing our placeholder.
          const runRegex = new RegExp(`<a:r( [^>]*)?>[\\s\\S]*?${escapeRegex(placeholder)}[\\s\\S]*?<\/a:r>`, 'g');
          
          processedXml = processedXml.replace(runRegex, (match) => {
            // Preserve the original run's properties (<a:rPr>) to maintain formatting.
            const rPrMatch = match.match(/<a:rPr[^>]*>[\s\\S]*?<\/a:rPr>/);
            const rPr = rPrMatch ? rPrMatch[0] : '';
            
            // Create a new set of runs: one for each line of text, and one for each line break.
            return parts.map((part, index) => {
              const textRun = `<a:r>${rPr}<a:t>${escapeXml(part)}</a:t></a:r>`;
              const breakRun = index < parts.length - 1 ? `<a:r>${rPr}<a:br/></a:r>` : '';
              return textRun + breakRun;
            }).join('');
          });

        } else if (value !== undefined) {
          // --- Simple Replacement for text without line breaks ---
          processedXml = processedXml.replace(new RegExp(escapeRegex(placeholder), 'g'), escapeXml(String(value)));
        }
      });
      
      // --- Conditional Block Processing ---
      // This runs AFTER main replacements to hide sections for which there is no data.
      // It removes the entire block from {?KEY} to {/?KEY}.
      processedXml = processedXml.replace(/\{\?([A-Z0-9_]+)\}([\s\S]*?)\{\/\?\1\}/g, (_match, key, content) => {
          return templateData[key] ? content : '';
      });
      
      // After all replacements, clean up any remaining empty placeholders.
      processedXml = processedXml.replace(/\{\{[A-Z0-9_]+\}\}/g, '');


      zip.file(slideFile, processedXml);
    });

    // Generate the final PowerPoint file as a blob
    const out = zip.generate({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });

    saveAs(out, "Candidate_Summary_Generated.pptx");

  } catch (error) {
    console.error('Error generating presentation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to generate presentation: ${errorMessage}`);
  }
};