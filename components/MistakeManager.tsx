import React from 'react';
import { ResultData } from '../types';
import { useLocalization } from '../context/LocalizationContext';
import Icon from './Icon';

interface MistakeManagerProps {
    result: ResultData;
    onToggleMistakeFixed: (resultId: string, mistake: string) => void;
    onViewAnalysis: (result: ResultData) => void;
    onEdit: (result: ResultData) => void;
    onDelete: (resultId: string) => void;
}

const MistakeManager: React.FC<MistakeManagerProps> = ({ result, onToggleMistakeFixed, onViewAnalysis, onEdit, onDelete }) => {
    const { t } = useLocalization();

    return (
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/80 group">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-cyan-400 tracking-wider">
                        Test on {new Date(result.DATE).toLocaleDateString()}
                    </h3>
                    <p className="text-2xl font-bold text-white">{result.SCORE}</p>
                </div>
                <div className="flex items-center gap-2">
                    {result.analysis && (
                        <button 
                            onClick={() => onViewAnalysis(result)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors">
                            Analysis
                        </button>
                    )}
                     <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onEdit(result)} className="p-1.5 text-gray-400 hover:text-white"><Icon name="edit" className="w-4 h-4" /></button>
                        <button onClick={() => {if(window.confirm(`Are you sure you want to delete this result? This cannot be undone.`)) onDelete(result.ID)}} className="p-1.5 text-gray-400 hover:text-red-400"><Icon name="trash" className="w-4 h-4" /></button>
                    </div>
                </div>
            </div>
            
            <h4 className="text-md font-semibold text-red-400 tracking-widest uppercase mb-4 border-t border-gray-700/50 pt-4">
                {t({ EN: "Mistake Analysis", GU: "ભૂલ વિશ્લેષણ" })}
            </h4>
            <ul className="space-y-2">
                {result.MISTAKES.map((mistake, index) => {
                    const isFixed = result.FIXED_MISTAKES?.includes(mistake);
                    return (
                        <li 
                            key={index} 
                            onClick={() => onToggleMistakeFixed(result.ID, mistake)}
                            className="flex items-center bg-gray-900 p-3 rounded-md cursor-pointer transition-all hover:bg-gray-800/50"
                        >
                            <div className={`w-5 h-5 mr-3 flex-shrink-0 rounded-sm border-2 flex items-center justify-center ${isFixed ? 'bg-green-500 border-green-500' : 'border-gray-500'}`}>
                                {isFixed && <Icon name="check" className="w-4 h-4 text-white" />}
                            </div>
                            <span className={`text-gray-300 ${isFixed ? 'line-through text-gray-500' : ''}`}>
                                {mistake}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default MistakeManager;
