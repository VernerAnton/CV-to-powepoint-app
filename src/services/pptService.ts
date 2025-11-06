import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import type { CandidateData } from '../types';

export const createPresentation = async (candidates: CandidateData[], templateContent: ArrayBuffer): Promise<void> => {
  const zip = new PizZip(templateContent);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    // Delimiters are changed to {{ }} and other custom tags to avoid conflicts and enable features.
    delimiters: {
        start: '{{',
        end: '}}'
    }
  });

  const templateData: { [key: string]: any } = {};
  
  // This system supports a maximum of 20 candidates (5 slides of 4)
  // based on the placeholders defined in the template.
  const MAX_CANDIDATES = 20;
  candidates.slice(0, MAX_CANDIDATES).forEach((candidate, index) => {
    const i = index + 1; // Placeholder indices are 1-based (e.g., NAME_1, NAME_2)

    templateData[`NAME_${i}`] = candidate.name.toUpperCase();

    // Limit work history to a max of 5 entries to ensure slide readability.
    templateData[`WORK_HISTORY_${i}`] = candidate.workHistory.slice(0, 5).map(job => ({
      JOB_TITLE: job.jobTitle,
      COMPANY: job.company,
      DATES: job.dates ? job.dates : ''
    }));
    
    // Education history has no limit. The template's "Shrink text on overflow" 
    // feature is responsible for visually fitting all entries.
    templateData[`EDUCATION_${i}`] = candidate.education.map(edu => ({
      INSTITUTION: edu.institution,
      DEGREE: edu.degree,
      DATES: edu.dates ? edu.dates : ''
    }));
  });

  // Set the data object for the template
  doc.setData(templateData);

  try {
    // Render the document (replace placeholders with data)
    doc.render();
  } catch (error) {
    // Catch rendering errors from docxtemplater, which can happen with malformed templates.
    console.error("Docxtemplater render error:", error);
    // Provide a more helpful error message to the user.
    if (error.properties && error.properties.errors) {
        const firstError = error.properties.errors[0];
        console.error("Detailed error:", firstError);
        throw new Error(`Template Error: ${firstError.message}. Please check the syntax of your placeholders.`);
    }
    throw new Error("Failed to render the presentation. Please check your template file for syntax errors.");
  }

  // Generate the output file as a blob
  const out = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });

  // Trigger a download of the generated file
  saveAs(out, "Candidate_Summary_Generated.pptx");
};