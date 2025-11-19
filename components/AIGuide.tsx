import React, { useState, useEffect } from 'react';
import Icon from './Icon';

interface AIGuideProps {
  examType?: 'JEE' | 'NEET';
}

const GuideRenderer: React.FC<{ content: string }> = ({ content }) => {
  const renderLine = (line: string, index: number) => {
    // This is a simplified markdown-to-HTML parser
    if (line.startsWith('###')) return <h3 key={index} className="text-lg font-bold text-cyan-400 mt-4 mb-2">{line.replace('###', '').trim()}</h3>;
    if (line.startsWith('##')) return <h2 key={index} className="text-xl font-bold text-white mt-6 mb-3 border-b border-gray-600 pb-1">{line.replace('##', '').trim()}</h2>;
    if (line.startsWith('#')) return <h1 key={index} className="text-2xl font-bold text-cyan-300 mt-2 mb-2">{line.replace('#', '').trim()}</h1>;
    if (line.match(/^\s*-\s/)) return <li key={index} className="ml-4 list-disc">{line.replace(/^\s*-\s/, '')}</li>;
    if (line.startsWith('```')) {
      // Find the end of the code block
      const lines = content.split('\n');
      let code = '';
      let i = index + 1;
      while (i < lines.length && !lines[i].startsWith('```')) {
        code += lines[i] + '\n';
        i++;
      }
      return <pre key={index} className="bg-gray-900 p-3 rounded-md border border-gray-600 text-sm whitespace-pre-wrap my-2 font-mono">{code.trim()}</pre>;
    }
    if (line.startsWith('|')) return null; // Handled by table logic
    if (line === '---') return <hr key={index} className="border-gray-700 my-6" />;
    
    // Process inline markdown
    let processedLine = line
      .replace(/`([^`]+)`/g, '<code class="bg-gray-700/50 text-cyan-300 text-xs rounded px-1.5 py-0.5 font-mono">$1</code>')
      .replace(/\*\*(.*?)\*\*|__(.*?)__/g, '<strong>$1$2</strong>')
      .replace(/(?<!\w)\*(.*?)\*(?!\w)|(?<!\w)_(.*?)_(?!\w)/g, '<em>$1$2</em>')
      .replace(/\[size=(\d+)\](.*?)\[\/size\]/g, '<span style="font-size: $1px;">$2</span>')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-cyan-400 hover:underline">$1</a>');

    return <p key={index} className="my-1" dangerouslySetInnerHTML={{ __html: processedLine }}></p>;
  };

  const lines = content.split('\n');
  const elements = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('|')) {
      const tableRows = [];
      let currentLine = i;
      while (currentLine < lines.length && lines[currentLine].startsWith('|')) {
        tableRows.push(lines[currentLine]);
        currentLine++;
      }
      
      const headers = tableRows[0].split('|').map(h => h.trim()).slice(1, -1);
      const rows = tableRows.slice(2); // Skip header and separator

      elements.push(
        <table key={`table-${i}`} className="w-full text-left my-4 border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-600">
              {headers.map((header, hIndex) => <th key={hIndex} className="py-2 px-3 text-cyan-400 font-semibold">{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIndex) => (
              <tr key={rIndex} className="border-b border-gray-700/50 hover:bg-gray-800/50">
                {row.split('|').map(c => c.trim()).slice(1, -1).map((cell, cIndex) => {
                   let content = cell.replace(/`/g, '');
                   content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                   return <td key={cIndex} className="py-2 px-3" dangerouslySetInnerHTML={{ __html: content }}></td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      );
      i = currentLine;
      continue;
    }
    
    if (line.startsWith('```')) {
       elements.push(renderLine(line, i));
       let currentLine = i + 1;
       while (currentLine < lines.length && !lines[currentLine].startsWith('```')) {
         currentLine++;
       }
       i = currentLine + 1;
       continue;
    }

    elements.push(renderLine(line, i));
    i++;
  }

  return <div className="text-gray-300 text-sm leading-relaxed">{elements}</div>;
};


const AIGuide: React.FC<AIGuideProps> = ({ examType = 'JEE' }) => {
    const [guideText, setGuideText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const guideFile = examType === 'NEET' ? '/ai-agent-guide-neet.txt' : '/ai-agent-guide.txt';
        setIsLoading(true);
        fetch(guideFile)
            .then(response => {
                if (!response.ok) throw new Error('Guide not found');
                return response.text();
            })
            .then(text => setGuideText(text))
            .catch(error => {
                console.error('Error loading AI guide:', error);
                setGuideText('Error: Could not load the AI guide.');
            })
            .finally(() => setIsLoading(false));
    }, [examType]);


    const handleCopy = () => {
        const plainText = guideText.replace(/`/g, '').replace(/\*/g, '');
        navigator.clipboard.writeText(plainText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div>
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">AI Agent Guide ({examType})</h2>
                <button onClick={handleCopy} disabled={isLoading} className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-50">
                    <Icon name={copied ? 'check' : 'copy'} className="w-4 h-4" /> {copied ? 'Copied!' : 'Copy Guide'}
                </button>
            </div>
            <p className="text-gray-400 mb-6 text-sm">
                Use this documentation to instruct a Large Language Model (like Gemini) to generate valid JSON data for batch importing schedules, exams, or student metrics.
            </p>
            <div className="bg-gray-900/70 p-4 rounded-md border border-gray-600 max-h-[60vh] overflow-y-auto">
                {isLoading ? <p>Loading guide...</p> : <GuideRenderer content={guideText} />}
            </div>
        </div>
    );
};

export default AIGuide;