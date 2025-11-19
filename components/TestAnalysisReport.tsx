import React from 'react';
import { ResultData } from '../types';
import Icon from './Icon';
import { renderMarkdown } from '../utils/markdownParser';

interface TestAnalysisReportProps {
  result: ResultData;
  onAnalyzeMistake: (questionNumber: number) => void;
}

const TestAnalysisReport: React.FC<TestAnalysisReportProps> = ({ result, onAnalyzeMistake }) => {
    if (!result.analysis) {
        return <p>No detailed analysis available for this result.</p>;
    }

    const { subjectTimings, chapterScores, aiSuggestions, incorrectQuestionNumbers } = result.analysis;
    // Safely calculate total and max time by casting the values to number[]
    const timeValues = Object.values(subjectTimings) as number[];
    const totalTime = timeValues.reduce((a, b) => a + b, 0);
    const maxTime = Math.max(...timeValues);

    return (
        <div className="space-y-6 text-left">
            {/* Score and Top Level Stats */}
            <div className="bg-gray-900/50 p-4 rounded-lg">
                <p className="text-lg font-semibold">Overall Score:</p>
                <p className="text-4xl font-bold text-cyan-400">{result.SCORE}</p>
            </div>

            {/* Time Analysis */}
            <div>
                <h4 className="font-bold text-lg text-white mb-2">Time Analysis</h4>
                <div className="bg-gray-900/50 p-4 rounded-lg space-y-3">
                    {Object.entries(subjectTimings).map(([subject, time]) => (
                        <div key={subject}>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="font-semibold text-gray-300">{subject}</span>
                                {/* FIX: Cast `time` to number to allow division. */}
                                <span className="text-gray-400">{Math.round(Number(time) / 60)} min</span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-2.5">
                                <div 
                                    className="bg-cyan-500 h-2.5 rounded-full" 
                                    // FIX: Cast `time` to number to allow division.
                                    style={{ width: `${(Number(time) / maxTime) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Chapter-wise Analysis */}
            <div>
                 <h4 className="font-bold text-lg text-white mb-2">Chapter-wise Performance</h4>
                 <div className="bg-gray-900/50 p-4 rounded-lg max-h-60 overflow-y-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-400 uppercase">
                            <tr>
                                <th className="py-2">Chapter</th>
                                <th className="text-center">Correct</th>
                                <th className="text-center">Incorrect</th>
                                <th className="text-right">Accuracy</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                            {Object.entries(chapterScores).map(([chapter, scores]) => {
                                // Assert the type of scores to safely access its properties.
                                const scoreData = scores as { correct: number; incorrect: number; accuracy: number };
                                return (
                                <tr key={chapter}>
                                    <td className="py-2 font-medium text-gray-300">{chapter}</td>
                                    <td className="text-center text-green-400">{scoreData.correct}</td>
                                    <td className="text-center text-red-400">{scoreData.incorrect}</td>
                                    <td className={`text-right font-semibold ${scoreData.accuracy > 70 ? 'text-green-400' : scoreData.accuracy > 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                        {scoreData.accuracy.toFixed(0)}%
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                 </div>
            </div>

            {/* AI Suggestions */}
            <div>
                <h4 className="font-bold text-lg text-white mb-2 flex items-center gap-2"><Icon name="gemini" className="w-5 h-5" /> AI Suggestions</h4>
                <div 
                  className="bg-gray-900/50 p-4 rounded-lg text-sm text-gray-300 prose prose-invert prose-sm break-words"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(aiSuggestions) }}
                />
            </div>

            {/* Incorrect Questions */}
            {incorrectQuestionNumbers && incorrectQuestionNumbers.length > 0 && (
                 <div>
                    <h4 className="font-bold text-lg text-white mb-2">Analyze Your Mistakes</h4>
                     <div className="bg-gray-900/50 p-4 rounded-lg max-h-48 overflow-y-auto">
                        <div className="flex flex-wrap gap-2">
                            {incorrectQuestionNumbers.map(qNum => (
                                <button 
                                    key={qNum}
                                    onClick={() => onAnalyzeMistake(qNum)}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-900/70 text-red-300 hover:bg-red-800/70"
                                >
                                    Analyze Q.{qNum}
                                </button>
                            ))}
                        </div>
                     </div>
                </div>
            )}
        </div>
    );
};

export default TestAnalysisReport;