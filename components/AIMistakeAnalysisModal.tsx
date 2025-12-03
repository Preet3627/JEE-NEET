
import React, { useState, useRef } from 'react';
import Icon from './Icon';
import { api } from '../api/apiService';
import { renderMarkdown } from '../utils/markdownParser';

interface AIMistakeAnalysisModalProps {
  onClose: () => void;
  onSaveWeakness: (weakness: string) => void;
}

interface AnalysisResult {
  mistake_topic: string;
  explanation: string;
}

const AIMistakeAnalysisModal: React.FC<AIMistakeAnalysisModalProps> = ({ onClose, onSaveWeakness }) => {
  const [description, setDescription] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isExiting, setIsExiting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setImageBase64(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!description.trim()) {
      setError('Please describe your mistake.');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setAnalysisResult(null);

    try {
      // FIX: Ensure `api.analyzeMistake` exists
      const result = await api.analyzeMistake({
        prompt: description,
        imageBase64: imageBase64 || undefined,
      });
      // The backend returns a JSON string in the 'response' field which we need to parse
      const parsedResult = JSON.parse(result.response);
      setAnalysisResult(parsedResult);
    } catch (err: any) {
      setError(err.error || 'An error occurred. The AI service may be misconfigured or unavailable.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddWeakness = () => {
    if (analysisResult) {
      onSaveWeakness(analysisResult.mistake_topic);
      handleClose();
    }
  };

  const animationClasses = isExiting ? 'modal-exit' : 'modal-enter';
  const contentAnimationClasses = isExiting ? 'modal-content-exit' : 'modal-content-enter';
  
  return (
    <div className={`fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${animationClasses}`} onClick={handleClose}>
      <div className={`w-full max-w-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-2xl p-6 ${contentAnimationClasses} flex flex-col max-h-[90vh]`} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-white mb-4 flex-shrink-0">Analyze Mistake with AI</h2>
        
        <div className="flex-grow overflow-y-auto space-y-4 pr-2">
            <p className="text-sm text-gray-400">Upload an image of the question (optional) and describe your thinking or what you did wrong.</p>
            <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full h-24 bg-gray-900/50 border border-gray-600 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                placeholder="e.g., 'I tried to use conservation of energy but forgot to account for the work done by friction...'"
            />
            
            {imageBase64 && (
                <div className="relative">
                    <img src={`data:image/jpeg;base64,${imageBase64}`} alt="Mistake image" className="max-h-40 rounded-md" />
                    <button onClick={() => { setImageBase64(null); if(fileInputRef.current) fileInputRef.current.value = ''; }} className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white">
                        <Icon name="trash" className="w-4 h-4" />
                    </button>
                </div>
            )}
            
            {isLoading && (
                <div className="text-center p-4">
                    <div className="w-6 h-6 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-400">AI is analyzing your mistake...</p>
                </div>
            )}

            {error && <p className="text-sm text-red-400 text-center">{error}</p>}

            {analysisResult && (
                <div className="bg-gray-900/50 p-4 rounded-md border border-gray-700">
                    <h3 className="font-bold text-cyan-400 mb-2">AI Analysis: <span className="text-white font-semibold">{analysisResult.mistake_topic}</span></h3>
                    <div 
                      className="text-sm text-gray-300 prose prose-invert prose-sm break-words"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(analysisResult.explanation) }}
                    />
                    <button onClick={handleAddWeakness} className="mt-4 w-full text-center px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg">
                      Add to My Weaknesses
                    </button>
                </div>
            )}
        </div>
        
        <div className="flex-shrink-0 flex justify-between items-center gap-4 pt-4 mt-4 border-t border-gray-700/50">
          <div>
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg bg-gray-700 hover:bg-gray-600">
              <Icon name="image" /> {imageBase64 ? 'Change Image' : 'Add Image'}
            </button>
          </div>
          <div className="flex items-center gap-4">
            <button type="button" onClick={handleClose} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600">Close</button>
            <button onClick={handleAnalyze} disabled={isLoading} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90 disabled:opacity-50">
              {isLoading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIMistakeAnalysisModal;