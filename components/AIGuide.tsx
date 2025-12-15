import React, { useState, useEffect } from 'react';
import Icon from './Icon';

interface AIGuideProps {
  // examType?: 'JEE' | 'NEET'; // No longer needed as content is single and dynamic
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
      .replace(/~{2}([^~]+)~{2}/g, '<del>$1</del>')
      .replace(/(?<!\w)\*(.*?)\*(?!\w)|(?<!\w)_([^_]+)_(?!\w)/g, '<em>$1$2</em>')
      .replace(/\[size=(\d+)\](.*?)\[\/size\]/g, '<span style="font-size: $1px;">$2</span>')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-cyan-400 hover:underline">$1</a>');

    return <p key={index} className="my-1 text-gray-200 leading-relaxed" dangerouslySetInnerHTML={{ __html: processedLine }}></p>;
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
        <table key={`table-${i}`} className="w-full text-left my-4 border-collapse text-gray-200">
          <thead>
            <tr className="border-b-2 border-gray-600">
              {headers.map((header, hIndex) => <th key={hIndex} className="py-2 px-3 text-cyan-400 font-semibold">{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIndex) => (
              <tr key={rIndex} className="border-b border-gray-700/50 hover:bg-gray-800/50">
                {row.split('|').map(cell => cell.trim()).slice(1, -1).map((cell, cIndex) => (
                  <td key={cIndex} className="py-2 px-3">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
      i = currentLine;
    } else if (line.startsWith('```')) {
        elements.push(renderLine(line, i));
        // Fast-forward past the code block
        let j = i + 1;
        while(j < lines.length && !lines[j].startsWith('```')) j++;
        i = j + 1;
    } else if (line.match(/^\s*-\s/)) { // Handle list items with improved styling
        elements.push(<li key={i} className="ml-4 list-disc text-gray-200 mb-1">{line.replace(/^\s*-\s/, '')}</li>);
        i++;
    } else {
      elements.push(renderLine(line, i));
      i++;
    }
  }
  return <>{elements}</>;
};



export const AIGuide: React.FC<AIGuideProps> = () => { // Removed examType from props
  const [guideContent, setGuideContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchGuide = async () => {
      try {
        setLoading(true);
        const response = await fetch('/ai-agent-guide-deep-linking.txt'); // Fetch from new file
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        setGuideContent(text);
      } catch (e: any) {
        setError(`Failed to load AI guide: ${e.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchGuide();
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(guideContent); // Copy loaded content
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset "Copied!" message after 2 seconds
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  if (loading) {
    return <div className="text-white text-center py-10">Loading AI Guide...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-center py-10">{error}</div>;
  }

  return (
    <div className="relative">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 px-3 py-1.5 text-sm font-semibold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600 flex items-center gap-1 z-10"
        title="Copy guide content"
      >
        <Icon name="copy" className="w-4 h-4" />
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <GuideRenderer content={guideContent} />
    </div>
  );
};