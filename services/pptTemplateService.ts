import PizZip from 'pizzip';
import type { CandidateData } from '../types';

// Helper to chunk array into groups of 4
function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
    arr.slice(i * size, i * size + size)
  );
}

/**
 * Create bulleted text in PowerPoint XML format
 */
function createBulletedText(items: string[]): string {
  if (items.length === 0) return '';

  return items.map((item, index) => {
    // First item has no bullet (level 0), rest have bullets (level 1)
    const level = index === 0 ? 0 : 1;
    const bullet = index === 0 ? '' : '<a:buChar char="•"/>';

    return `<a:p><a:pPr lvl="${level}">${bullet}</a:pPr><a:r><a:t>${escapeXml(item)}</a:t></a:r></a:p>`;
  }).join('');
}

/**
 * Escape special XML characters
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
 * Format work history for a candidate
 */
function formatWorkHistory(candidate: CandidateData): string {
  const items = [
    candidate.name.toUpperCase(),
    ...candidate.workHistory.map(job =>
      `${job.company} - ${job.jobTitle}${job.dates ? ' ' + job.dates : ''}`
    )
  ];
  return createBulletedText(items);
}

/**
 * Format education for a candidate
 */
function formatEducation(candidate: CandidateData): string {
  const items: string[] = [];
  candidate.education.forEach(edu => {
    items.push(`${edu.institution}${edu.dates ? ' ' + edu.dates : ''}`);
    items.push(edu.degree);
  });
  return createBulletedText(items);
}

/**
 * Replace placeholder with formatted content in XML
 */
function replacePlaceholder(xml: string, placeholder: string, content: string): string {
  // Find the text element containing the placeholder
  // PowerPoint structure: <a:p><a:r><a:t>{{PLACEHOLDER}}</a:t></a:r></a:p>

  const placeholderRegex = new RegExp(
    `<a:p>.*?<a:t>${escapeXml(placeholder)}</a:t>.*?</a:p>`,
    'gs'
  );

  return xml.replace(placeholderRegex, content);
}

/**
 * Generate PowerPoint from template using candidate data
 */
export async function createPresentationFromTemplate(candidates: CandidateData[]): Promise<void> {
  try {
    // Load the template
    const response = await fetch('/template_with_placeholders.pptx');
    if (!response.ok) {
      throw new Error(`Failed to load template: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const zip = new PizZip(arrayBuffer);

    // Get slide 2 (the candidate template slide) as our master template
    const templateSlideXml = zip.file('ppt/slides/slide2.xml')?.asText();
    if (!templateSlideXml) {
      throw new Error('Could not find slide2.xml in template');
    }

    // Calculate how many slides we need (4 candidates per slide)
    const slidesNeeded = Math.ceil(candidates.length / 4);
    console.log(`Generating ${slidesNeeded} slides for ${candidates.length} candidates`);

    // Split candidates into pages of 4
    const pages = chunk(candidates, 4);

    // Process each page - create a slide for each batch of 4 candidates
    pages.forEach((pageCandidates, pageIndex) => {
      // Start with a fresh copy of the template for each slide
      let slideXml = templateSlideXml;

      // Replace placeholders for each candidate position (1-4)
      pageCandidates.forEach((candidate, position) => {
        const num = position + 1;

        // Replace name, work history, and education
        slideXml = replacePlaceholder(
          slideXml,
          `{{NAME_${num}}}`,
          `<a:p><a:r><a:t>${escapeXml(candidate.name.toUpperCase())}</a:t></a:r></a:p>`
        );

        slideXml = replacePlaceholder(
          slideXml,
          `{{WORK_HISTORY_${num}}}`,
          formatWorkHistory(candidate)
        );

        slideXml = replacePlaceholder(
          slideXml,
          `{{EDUCATION_${num}}}`,
          formatEducation(candidate)
        );
      });

      // Clear unused positions if less than 4 candidates on this slide
      for (let i = pageCandidates.length; i < 4; i++) {
        const num = i + 1;
        slideXml = replacePlaceholder(slideXml, `{{NAME_${num}}}`, '');
        slideXml = replacePlaceholder(slideXml, `{{WORK_HISTORY_${num}}}`, '');
        slideXml = replacePlaceholder(slideXml, `{{EDUCATION_${num}}}`, '');
      }

      // Save the filled slide
      // Slide numbering: slide2.xml is first candidate slide, slide3.xml is second, etc.
      const slideNumber = pageIndex + 2;
      const slideFileName = `ppt/slides/slide${slideNumber}.xml`;

      zip.file(slideFileName, slideXml);
      console.log(`✓ Created ${slideFileName} with ${pageCandidates.length} candidates`);
    });

    // Generate the output file
    const blob = zip.generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    });

    const url = URL.createObjectURL(blob);

    // Trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Candidate_Summary.pptx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    console.log(`✅ PowerPoint generated successfully with ${slidesNeeded} candidate slides!`);

  } catch (error) {
    console.error('Error generating presentation from template:', error);
    throw new Error(`Failed to generate presentation: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
