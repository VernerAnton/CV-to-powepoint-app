
import React, { useState, useCallback, useMemo, useRef } from 'react';
import { chunkPdfByCandidate } from './services/pdfService';
import { extractCandidateFromText } from './services/geminiService';
import { createPresentation } from './services/pptService';
import type { CandidateData, ProcessingStatus, GeminiModel } from './types';

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

interface ErrorReportProps {
  failedCvs: { index: number; error: string }[];
}
const ErrorReport: React.FC<ErrorReportProps> = ({ failedCvs }) => (
    <div className="mt-8 animate-fade-in">
        <h2 className="text-2xl font-semibold text-red-700 mb-4">Processing Failures</h2>
        <p className="text-gray-600 mb-4">The following CVs could not be processed after multiple retries and were skipped.</p>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2 max-h-40 overflow-y-auto">
            {failedCvs.map(failure => (
                <div key={failure.index}>
                    <p className="font-semibold text-red-800">CV #{failure.index}</p>
                </div>
            ))}
        </div>
    </div>
);

// --- Model Selector Component ---
interface ModelSelectorProps {
  selectedModel: GeminiModel;
  onModelChange: (model: GeminiModel) => void;
  disabled: boolean;
}
const ModelSelector: React.FC<ModelSelectorProps> = ({ selectedModel, onModelChange, disabled }) => (
  <div className="my-6">
    <label className="block text-sm font-medium text-gray-700 text-center mb-2">
      Select AI Model
    </label>
    <div className="relative flex justify-center items-center bg-gray-200 rounded-full p-1 max-w-xs mx-auto">
      <button
        onClick={() => onModelChange('gemini-2.5-flash')}
        disabled={disabled}
        className={`w-1/2 z-10 px-4 py-1 text-sm font-semibold rounded-full transition-colors duration-300 ease-in-out focus:outline-none ${
          selectedModel === 'gemini-2.5-flash' ? 'text-blue-700' : 'text-gray-600'
        } disabled:opacity-50`}
      >
        Flash <span className="text-xs font-normal text-gray-500">(Faster)</span>
      </button>
      <button
        onClick={() => onModelChange('gemini-2.5-pro')}
        disabled={disabled}
        className={`w-1/2 z-10 px-4 py-1 text-sm font-semibold rounded-full transition-colors duration-300 ease-in-out focus:outline-none ${
          selectedModel === 'gemini-2.5-pro' ? 'text-blue-700' : 'text-gray-600'
        } disabled:opacity-50`}
      >
        Pro <span className="text-xs font-normal text-gray-500">(Smarter)</span>
      </button>
      <span
        className={`absolute top-1 bottom-1 w-1/2 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${
          selectedModel === 'gemini-2.5-pro' ? 'translate-x-full' : 'translate-x-0'
        }`}
        style={{ left: '2px', right: '2px', width: 'calc(50% - 4px)' }}
      />
    </div>
  </div>
);


// --- Main App Component ---

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [model, setModel] = useState<GeminiModel>('gemini-2.5-flash');
  const [candidatesData, setCandidatesData] = useState<CandidateData[]>([]);
  const [failedCvs, setFailedCvs] = useState<{ index: number; error: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const isCancelled = useRef(false);

  const isProcessing = useMemo(() => ['parsing', 'extracting', 'generating'].includes(status), [status]);

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile);
    setCandidatesData([]);
    setFailedCvs([]);
    setError(null);
    setStatus('idle');
  }, []);

  const handleCancel = useCallback(() => {
    isCancelled.current = true;
    setStatus('idle');
    setCandidatesData([]);
    setFailedCvs([]);
    setError(null);
    setProcessedCount(0);
    setTotalCount(0);
    console.log("Process cancelled by user.");
  }, []);

  const processCvFile = async () => {
    if (!file) return;

    isCancelled.current = false;
    setStatus('parsing');
    setError(null);
    setCandidatesData([]);
    setFailedCvs([]);
    setProcessedCount(0);
    setTotalCount(0);

    try {
      const cvChunks = await chunkPdfByCandidate(file);
      if (isCancelled.current) return;

      setTotalCount(cvChunks.length);
      setStatus('extracting');

      const allData: CandidateData[] = [];
      for (let i = 0; i < cvChunks.length; i++) {
        if (isCancelled.current) return;
        const cvText = cvChunks[i];
        
        try {
          const candidate = await extractCandidateFromText(cvText, model);
          if (isCancelled.current) return;
          
          // Client-side filtering as a fallback to remove "Board Member" roles
          candidate.workHistory = candidate.workHistory.filter(job => 
            !job.jobTitle.toLowerCase().includes('board member')
          );

          allData.push(candidate);
          setCandidatesData(prevData => [...prevData, candidate]);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown extraction error.';
            console.error(`Failed to process CV #${i + 1}:`, err);
            setFailedCvs(prevFails => [...prevFails, { index: i + 1, error: errorMsg }]);
        } finally {
            if (!isCancelled.current) {
              setProcessedCount(prev => prev + 1);
            }
        }
      }
      
      if (isCancelled.current) return;
      
      setStatus('generating');

      if (allData.length > 0) {
        try {
          const response = await fetch('/template_with_placeholders.pptx');
          if (!response.ok) {
            throw new Error(`Template not found. Please ensure 'template_with_placeholders.pptx' is in the root directory.`);
          }
          const templateContent = await response.arrayBuffer();
          await createPresentation(allData, templateContent);
        } catch (templateError) {
          throw templateError; // Propagate to the main catch block
        }
      } else {
        console.warn("No candidate data was successfully extracted. Skipping presentation generation.");
        if (cvChunks.length > 0) {
          setError("All CVs failed to process. Please check the PDF format or try again later.");
        }
      }
      
      if (isCancelled.current) return;

      setStatus('done');
    } catch (err) {
      if (!isCancelled.current) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        setStatus('error');
      }
    }
  };
  
  const statusMessage = useMemo(() => {
    switch(status) {
      case 'idle': return "Upload a PDF to begin.";
      case 'parsing': return "Parsing PDF and chunking CVs...";
      case 'extracting': return `Extracting info from CV... (${processedCount}/${totalCount}) using ${model === 'gemini-2.5-pro' ? 'Pro' : 'Flash'}`;
      case 'generating': return "Generating PowerPoint from template...";
      case 'done':
        if (failedCvs.length > 0) {
          if (failedCvs.length === totalCount) {
              return `Process finished, but all ${totalCount} CVs failed to be processed.`;
          }
          return `Process complete with ${failedCvs.length} failure(s). Presentation generated for successful candidates.`;
        }
        return "Process complete! Your download should start automatically.";
      case 'error': return `An error occurred: ${error}`;
      default: return "";
    }
  }, [status, processedCount, totalCount, error, failedCvs, model]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-gray-800">CV to PowerPoint Automator</h1>
          <p className="mt-2 text-lg text-gray-600">Automate your recruitment workflow with AI.</p>
        </header>

        <main className="bg-white shadow-xl rounded-lg p-8">
          {!file && <FileUploader onFileSelect={handleFileSelect} disabled={isProcessing} />}
          
          {file && (
             <div className="text-center">
              <p className="mb-4 text-gray-700">File selected: <span className="font-semibold">{file.name}</span></p>

              <ModelSelector selectedModel={model} onModelChange={setModel} disabled={isProcessing} />

              <div className="flex justify-center items-center space-x-4">
                <button
                  onClick={processCvFile}
                  disabled={isProcessing}
                  className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isProcessing && <Spinner />}
                  <span className="ml-2">{isProcessing ? 'Processing...' : 'Generate Presentation'}</span>
                </button>

                {isProcessing && (
                  <button
                    onClick={handleCancel}
                    className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    Cancel
                  </button>
                )}
              </div>
             </div>
          )}

          {(isProcessing || status === 'done' || status === 'error') && (
            <div className="mt-8 text-center">
              <p className={`text-lg font-medium ${status === 'error' ? 'text-red-600' : 'text-gray-700'}`}>
                {statusMessage}
              </p>
            </div>
          )}
          
          {failedCvs.length > 0 && status === 'done' && (
            <ErrorReport failedCvs={failedCvs} />
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
        </main>
      </div>
    </div>
  );
}