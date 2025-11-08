import * as pdfjs from 'pdfjs-dist';

// Set worker path using CDN for reliable cross-platform compatibility
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
/**
 * Parses a PDF file containing multiple concatenated CVs and splits them into chunks.
 * A new CV is assumed to start on a page containing "Page 1 of".
 * @param file The PDF file to process.
 * @returns A promise that resolves to an array of strings, where each string is the text of a full CV.
 */
export const chunkPdfByCandidate = async (file: File): Promise<string[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument(arrayBuffer).promise;
  const numPages = pdf.numPages;
  const candidateChunks: string[] = [];
  let currentChunkPages: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => ('str' in item ? item.str : '')).join(' ');

    // Normalize text to handle spacing and case variations in the "Page 1 of X" marker
    const normalizedText = pageText.replace(/\s/g, '').toLowerCase();

    // If we find a "page1of" marker and we already have pages in our current chunk,
    // it means we've hit the start of a NEW candidate. Finalize the PREVIOUS one.
    if (normalizedText.includes('page1of') && currentChunkPages.length > 0) {
      candidateChunks.push(currentChunkPages.join('\n\n'));
      currentChunkPages = []; // Reset for the new candidate
    }

    // Add the current page's text to the current running chunk
    currentChunkPages.push(pageText);
  }

  // Add the last remaining chunk to the results after the loop finishes
  if (currentChunkPages.length > 0) {
    candidateChunks.push(currentChunkPages.join('\n\n'));
  }

  if (candidateChunks.length <= 1 && numPages > 5) { // Arbitrary page count to guess it's a longlist
      console.warn("PDF chunking resulted in a single candidate. The 'Page 1 of' marker might be missing or in an unexpected format. Processing the entire document as one CV.");
  }

  return candidateChunks;
};