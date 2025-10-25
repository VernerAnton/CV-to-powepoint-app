import React, { useState, useCallback, useMemo, useRef } from 'react';
import { chunkPdfByCandidate } from './services/pdfService';
import { extractCandidateFromText } from './services/geminiService';
import { createPresentation } from './services/pptService';
import type { CandidateData, ProcessingStatus } from './types';

// --- Helper Components (defined outside App to prevent re-creation on re-renders) ---

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  disabled: boolean;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect, disabled }) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      onFileSelect(event.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <label
        className={`flex justify-center w-full h-32 px-4 transition bg-white border-2 border-gray-300 border-dashed rounded-md appearance-none cursor-pointer hover:border-gray-400 focus:outline-none ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        <span className="flex items-center space-x-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span className="font-medium text-gray-600">
            Drop CV Longlist PDF here, or <span className="text-blue-600 underline">browse</span>
          </span>
        </span>
        <input type="file" name="file_upload" className="hidden" accept=".pdf" onChange={handleFileChange} disabled={disabled} />
      </label>
    </div>
  );
};

const Spinner: React.FC = () => (
  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

interface CandidateCardProps {
  candidate: CandidateData;
}
const CandidateCard: React.FC<CandidateCardProps> = ({ candidate }) => (
    <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200 animate-fade-in">
        <h3 className="text-xl font-bold text-blue-800">{candidate.name}</h3>
    </div>
);


// --- Main App Component ---

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [candidatesData, setCandidatesData] = useState<CandidateData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [failedCandidates, setFailedCandidates] = useState<Array<{ index: number; error: string }>>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const isProcessing = useMemo(() => ['parsing', 'extracting', 'generating'].includes(status), [status]);

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile);
    setCandidatesData([]);
    setError(null);
    setStatus('idle');
    setFailedCandidates([]);
  }, []);

  const handleReset = useCallback(() => {
    setFile(null);
    setCandidatesData([]);
    setError(null);
    setStatus('idle');
    setFailedCandidates([]);
    setProcessedCount(0);
    setTotalCount(0);
    abortControllerRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setStatus('error');
      setError('Processing cancelled by user.');
    }
  }, []);

  const processCvFile = async () => {
    if (!file) return;

    // Create new abort controller for this processing session
    abortControllerRef.current = new AbortController();

    setStatus('parsing');
    setError(null);
    setCandidatesData([]);
    setProcessedCount(0);
    setTotalCount(0);
    setFailedCandidates([]);

    try {
      const cvChunks = await chunkPdfByCandidate(file);
      setTotalCount(cvChunks.length);
      setStatus('extracting');

      const allData: CandidateData[] = [];
      const failures: Array<{ index: number; error: string }> = [];
      const MAX_RETRIES = 3;

      for (let i = 0; i < cvChunks.length; i++) {
        // Check if processing was cancelled
        if (abortControllerRef.current?.signal.aborted) {
          console.log('Processing cancelled by user');
          return;
        }
        let retries = MAX_RETRIES;
        let success = false;
        let lastError: Error | null = null;

        while (retries > 0 && !success) {
          try {
            const candidate = await extractCandidateFromText(cvChunks[i]);
            allData.push(candidate);
            setCandidatesData(prevData => [...prevData, candidate]); // Update state progressively
            success = true;
          } catch (err) {
            lastError = err instanceof Error ? err : new Error('Unknown error occurred');
            retries--;

            if (retries > 0) {
              // Exponential backoff: 1s, 2s, 4s
              const waitTime = 1000 * Math.pow(2, MAX_RETRIES - retries - 1);
              console.log(`Retry ${MAX_RETRIES - retries}/${MAX_RETRIES} for candidate #${i + 1} after ${waitTime}ms...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            } else {
              // All retries exhausted
              const errorMsg = lastError.message;
              console.error(`Failed to extract candidate #${i + 1} after ${MAX_RETRIES} attempts:`, lastError);
              failures.push({ index: i + 1, error: `${errorMsg} (failed after ${MAX_RETRIES} attempts)` });
              setFailedCandidates(prev => [...prev, { index: i + 1, error: `${errorMsg} (failed after ${MAX_RETRIES} attempts)` }]);
            }
          }
        }

        setProcessedCount(prev => prev + 1);
      }

      // Only generate PowerPoint if at least one candidate was successfully extracted
      if (allData.length > 0) {
        setStatus('generating');
        await createPresentation(allData);
        setStatus('done');
      } else {
        // All candidates failed
        setError(`Failed to extract any candidates. All ${cvChunks.length} CVs had errors.`);
        setStatus('error');
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setStatus('error');
    }
  };
  
  const statusMessage = useMemo(() => {
    switch(status) {
      case 'idle': return "Upload a PDF to begin.";
      case 'parsing': return "Parsing PDF and chunking CVs...";
      case 'extracting': return `Extracting info from CV... (${processedCount}/${totalCount})`;
      case 'generating': return "Generating PowerPoint presentation...";
      case 'done': return "Process complete! Your download should start automatically.";
      case 'error': return `An error occurred: ${error}`;
      default: return "";
    }
  }, [status, processedCount, totalCount, error]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-gray-800">CV to PowerPoint Automator</h1>
          <p className="mt-2 text-lg text-gray-600">Automate your recruitment workflow with AI.</p>
        </header>

        <main className="bg-white shadow-xl rounded-lg p-8">
          {!file && <FileUploader onFileSelect={handleFileSelect} disabled={isProcessing} />}
          
          {file && status === 'idle' && (
             <div className="text-center">
              <p className="mb-4 text-gray-700">File selected: <span className="font-semibold">{file.name}</span></p>

              <div className="flex gap-3 justify-center">
                <button
                  onClick={processCvFile}
                  className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Generate Presentation
                </button>
                <button
                  onClick={handleReset}
                  className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Choose Different File
                </button>
              </div>
             </div>
          )}

          {isProcessing && (
            <div className="text-center">
              <p className="mb-4 text-gray-700">File selected: <span className="font-semibold">{file?.name}</span></p>
              <div className="flex gap-3 justify-center">
                <button
                  disabled
                  className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-gray-400 cursor-not-allowed"
                >
                  <Spinner />
                  <span className="ml-2">Processing...</span>
                </button>
                <button
                  onClick={handleCancel}
                  className="inline-flex items-center justify-center px-6 py-3 border border-red-300 text-base font-medium rounded-md shadow-sm text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {(isProcessing || status === 'done' || status === 'error') && (
            <div className="mt-8 text-center">
              <p className={`text-lg font-medium ${status === 'error' ? 'text-red-600' : 'text-gray-700'}`}>
                {statusMessage}
              </p>
              {status === 'done' && failedCandidates.length > 0 && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm font-semibold text-yellow-800">
                    Successfully processed {candidatesData.length} of {totalCount} candidates.
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    {failedCandidates.length} candidate{failedCandidates.length > 1 ? 's' : ''} failed (see below for details).
                  </p>
                </div>
              )}
              {status === 'done' && failedCandidates.length === 0 && totalCount > 0 && (
                <p className="mt-2 text-sm text-green-600">
                  All {totalCount} candidates processed successfully!
                </p>
              )}
              {(status === 'done' || status === 'error') && (
                <button
                  onClick={handleReset}
                  className="mt-6 inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Upload New File
                </button>
              )}
            </div>
          )}

          {candidatesData.length > 0 && (
            <div className="mt-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">Extracted Candidates</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {candidatesData.map((candidate, index) => (
                  <CandidateCard key={index} candidate={candidate} />
                ))}
              </div>
            </div>
          )}

          {failedCandidates.length > 0 && (
            <div className="mt-8">
              <h2 className="text-2xl font-semibold text-red-700 mb-4">Failed Candidates</h2>
              <div className="space-y-3">
                {failedCandidates.map((failure, index) => (
                  <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="font-semibold text-red-800">Candidate #{failure.index}</p>
                    <p className="text-sm text-red-600 mt-1">{failure.error}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
