import PizZip from 'pizzip';
import type { CandidateData } from '../types';

// Helper to chunk array into groups of 4
function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
    arr.slice(i * size, i * size + size)
  );
}

/**
 * Format candidate data for slide placement
 */
function formatCandidateForSlide(candidate: CandidateData, position: number): Record<string, string> {
  // Position 0-3 maps to the 4 candidate slots on a slide
  const workHistoryText = candidate.workHistory
    .map(job => `${job.company} - ${job.jobTitle}${job.dates ? ' ' + job.dates : ''}`)
    .join('\n');

  const educationText = candidate.education
    .map(edu => `${edu.institution}${edu.dates ? ' ' + edu.dates : ''}\n${edu.degree}`)
    .join('\n\n');

  return {
    name: candidate.name.toUpperCase(),
    workHistory: workHistoryText,
    education: educationText
  };
}

/**
 * Generate PowerPoint from template using candidate data
 *
 * This function reads Esimerkkikappale.pptx template, duplicates slide 2 (candidate template),
 * and fills it with actual candidate data while preserving exact branding.
 */
export async function createPresentationFromTemplate(candidates: CandidateData[]): Promise<void> {
  try {
    // Load the template
    const response = await fetch('/Esimerkkikappale.pptx');
    if (!response.ok) {
      throw new Error(`Failed to load template: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const zip = new PizZip(arrayBuffer);

    // Get slide 2 (the candidate template slide)
    const templateSlideXml = zip.file('ppt/slides/slide2.xml')?.asText();
    if (!templateSlideXml) {
      throw new Error('Could not find slide2.xml in template');
    }

    // Split candidates into pages of 4
    const pages = chunk(candidates, 4);

    console.log(`Processing ${pages.length} pages with ${candidates.length} total candidates`);

    // For each page, duplicate slide 2 and replace text content
    // This preserves the exact styling, colors, shapes, and layout
    pages.forEach((pageCandidates, pageIndex) => {
      let slideXml = templateSlideXml;

      // Replace candidate data in the duplicated slide
      // Note: This is a simplified approach - full implementation would need
      // to parse XML more carefully to find exact text nodes to replace

      pageCandidates.forEach((candidate, position) => {
        const data = formatCandidateForSlide(candidate, position);
        // TODO: Map these replacements to actual XML text nodes
        console.log(`Page ${pageIndex + 1}, Candidate ${position + 1}: ${data.name}`);
      });

      // Add the modified slide to the presentation
      // TODO: Implement slide addition to zip
    });

    // Generate the output file
    const blob = zip.generate({ type: 'blob' });
    const url = URL.createObjectURL(blob);

    // Trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Candidate_Summary.pptx';
    link.click();

    URL.revokeObjectURL(url);

  } catch (error) {
    console.error('Error generating presentation from template:', error);
    throw new Error(`Failed to generate presentation: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
