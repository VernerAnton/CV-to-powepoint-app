import PizZip from 'pizzip';
import { saveAs } from 'file-saver';
import type { CandidateData } from '../types';

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Process loops in PowerPoint XML
 */
function processLoops(xml: string, data: { [key: string]: any }): string {
  let result = xml;

  // Process each loop in the template
  Object.keys(data).forEach(key => {
    const value = data[key];
    
    if (Array.isArray(value)) {
      // Handle array loops: {?KEY}{#KEY}...{/KEY}{/?KEY}
      const loopRegex = new RegExp(
        `\\{\\?${key}\\}[\\s\\S]*?\\{#${key}\\}([\\s\\S]*?)\\{\\/${key}\\}[\\s\\S]*?\\{\/\\?${key}\\}`,
        'g'
      );

      result = result.replace(loopRegex, (match, loopContent) => {
        if (value.length === 0) {
          return ''; // Empty array = remove the whole section
        }

        // Repeat the loop content for each item
        return value.map(item => {
          let itemContent = loopContent;
          
          // Replace placeholders in loop content
          Object.keys(item).forEach(itemKey => {
            const placeholder = `{{${itemKey}}}`;
            const itemValue = item[itemKey] || '';
            itemContent = itemContent.replace(new RegExp(escapeRegex(placeholder), 'g'), escapeXml(String(itemValue)));
          });
          
          return itemContent;
        }).join('');
      });
    } else {
      // Handle simple string replacements
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(escapeRegex(placeholder), 'g'), escapeXml(String(value)));
    }
  });

  return result;
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

    // Prepare data for all candidates
    const templateData: { [key: string]: any } = {};
    
    const MAX_CANDIDATES = 20;
    candidates.slice(0, MAX_CANDIDATES).forEach((candidate, index) => {
      const i = index + 1;

      templateData[`NAME_${i}`] = candidate.name.toUpperCase();

      templateData[`WORK_HISTORY_${i}`] = candidate.workHistory.slice(0, 5).map(job => ({
        JOB_TITLE: job.jobTitle,
        COMPANY: job.company,
        DATES: job.dates || ''
      }));
      
      templateData[`EDUCATION_${i}`] = candidate.education.map(edu => ({
        INSTITUTION: edu.institution,
        DEGREE: edu.degree,
        DATES: edu.dates || ''
      }));
    });

    // Process all slides
    const slideFiles = Object.keys(zip.files).filter(name => name.match(/^ppt\/slides\/slide\d+\.xml$/));
    
    slideFiles.forEach(slideFile => {
      const slideXml = zip.file(slideFile)?.asText();
      if (slideXml) {
        const processedXml = processLoops(slideXml, templateData);
        zip.file(slideFile, processedXml);
      }
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
    const errorMessage = error && typeof error === 'object' && 'message' in error 
      ? (error as Error).message 
      : 'Unknown error';
    throw new Error(`Failed to generate presentation: ${errorMessage}`);
  }
};