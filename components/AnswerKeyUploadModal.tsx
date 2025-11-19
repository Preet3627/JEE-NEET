import React, { useState, useRef } from 'react';
import Icon from './Icon';

interface AnswerKeyUploadModalProps {
  onClose: () => void;
  onGrade: (imageBase64: string) => void;
}

const AnswerKeyUploadModal: React.FC<AnswerKeyUploadModalProps> = ({ onClose, onGrade }) => {
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
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
      setError('');
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviewUrl(reader.result as string);
        const base64String = (reader.result as string).split(',')[1];
        setImageBase64(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGrade = () => {
    if (!imageBase64) {
      setError('Please upload an image of the answer key.');
      return;
    }
    onGrade(imageBase64);
  };

  const animationClasses = isExiting ? 'modal-exit' : 'modal-enter';
  const contentAnimationClasses = isExiting ? 'modal-content-exit' : 'modal-content-enter';

  return (
    <div className={`fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${animationClasses}`} onClick={handleClose}>
      <div className={`w-full max-w-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-2xl p-6 ${contentAnimationClasses}`} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-white mb-2">Upload Answer Key</h2>
        <p className="text-sm text-gray-400 mb-4">Upload a clear image of the answer key. The AI will read it to grade your test.</p>
        
        <div 
            className="w-full h-48 bg-gray-900 border-2 border-dashed border-gray-600 rounded-md flex flex-col items-center justify-center text-center p-4 cursor-pointer hover:border-cyan-500"
            onClick={() => fileInputRef.current?.click()}
        >
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            {imagePreviewUrl ? (
                <img src={imagePreviewUrl} alt="Answer key preview" className="max-h-full rounded-md" />
            ) : (
                <>
                    <Icon name="upload" className="w-10 h-10 text-gray-500 mb-2" />
                    <p className="text-gray-400">Click to upload image</p>
                    <p className="text-xs text-gray-500">PNG, JPG, or WEBP</p>
                </>
            )}
        </div>

        {error && <p className="text-sm text-red-400 mt-2 text-center">{error}</p>}
        
        <div className="flex justify-end gap-4 pt-4 mt-4 border-t border-gray-700/50">
          <button type="button" onClick={handleClose} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600">Cancel</button>
          <button onClick={handleGrade} disabled={!imageBase64} className="flex items-center justify-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90 disabled:opacity-50">
            <Icon name="check" /> Grade Test
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnswerKeyUploadModal;