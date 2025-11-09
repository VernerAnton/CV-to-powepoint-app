import PizZip from 'pizzip';
import { saveAs } from 'file-saver';
import type { CandidateData } from '../types';

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const createPresentation = async (candidates: CandidateData[], templateContent: ArrayBuffer): Promise<void> => {
  try {
    const zip = new PizZip(templateContent);
    const templateData: { [key: string]: any } = {};
    const MAX_CANDIDATES = 60;

    candidates.slice(0, MAX_CANDIDATES).forEach((candidate, index) => {
      const i = index + 1;

      templateData[`NAME_${i}`] = candidate.name.toUpperCase();

      // Format work history as a single string with line breaks
      const workHistoryLines = candidate.workHistory.slice(0, 5).map(job =>
        `• ${job.company} • ${job.jobTitle}${job.dates ? ` · ${job.dates}` : ''}`
      );
      templateData[`WORK_HISTORY_TEXT_${i}`] = workHistoryLines.join('\n');

      // Format education as a single string with line breaks
      const educationLines = candidate.education.map(edu =>
        `• ${edu.institution} • ${edu.degree}${edu.dates ? ` · ${edu.dates}` : ''}`
      );
      templateData[`EDUCATION_TEXT_${i}`] = educationLines.join('\n');
    });

    // Process all slides
    const slideFiles = Object.keys(zip.files).filter(name => name.match(/^ppt\/slides\/slide\d+\.xml$/));
    
    slideFiles.forEach(slideFile => {
      let slideXml = zip.file(slideFile)?.asText();
      if (!slideXml) return;

      // Replace all placeholders with their values
      Object.keys(templateData).forEach(key => {
        const placeholder = `{{${key}}}`;
        const value = templateData[key];
        
        if (value !== undefined && value !== null) {
          const escapedValue = escapeXml(String(value));
          slideXml = slideXml!.replace(
            new RegExp(escapeRegex(placeholder), 'g'),
            escapedValue
          );
        }
      });

      // Handle conditional blocks {?KEY}...{/?KEY}
      slideXml = slideXml.replace(/\{\?([A-Z0-9_]+)\}([\s\S]*?)\{\/\?\1\}/g, (_match, key, content) => {
        return templateData[key] ? content : '';
      });

      // Clean up any remaining placeholders
      slideXml = slideXml.replace(/\{\{[A-Z0-9_]+\}\}/g, '');

      zip.file(slideFile, slideXml);
    });

    // Generate output
    const out = zip.generate({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });

    saveAs(out, "Candidate_Summary_Generated.pptx");
    console.log('✅ PowerPoint generated successfully!');

  } catch (error) {
    console.error('Error generating presentation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to generate presentation: ${errorMessage}`);
  }
};