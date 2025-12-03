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
      .replace(/~{2}([^~]+)~{2}/g, '<del>$1</del>')
      .replace(/(?<!\w)\*(.*?)\*(?!\w)|(?<!\w)_([^_]+)_(?!\w)/g, '<em>$1$2</em>')
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
    } else {
      elements.push(renderLine(line, i));
      i++;
    }
  }
  return <>{elements}</>;
};

const jeeGuide = `
# AI Data Import Guide (JEE)

You can import various types of data by pasting text into the AI Import modal. The AI will understand the structure and format it for you.

## Schedules

### From Plain Text
Simply describe your schedule. The AI is trained to pick up on keywords.

\`\`\`
- Wednesday 9am physics deep dive on rotational motion
- Friday 8pm solve maths homework, questions 1-20 from chapter on matrices
- Saturday log my test result 195/300, mistakes were in electrostatics and p-block elements.
\`\`\`

### From JSON
You can provide a structured JSON object for precise control.

\`\`\`json
{
  "schedules": [
    {
      "day": "Monday",
      "time": "19:00",
      "title": "Chemistry Practice",
      "detail": "Focus on Organic Chemistry name reactions.",
      "subject": "CHEMISTRY",
      "type": "ACTION",
      "sub_type": "DEEP_DIVE"
    },
    {
      "day": "Tuesday",
      "title": "Physics Homework",
      "subject": "PHYSICS",
      "type": "HOMEWORK",
      "q_ranges": "1-25"
    }
  ]
}
\`\`\`

## Practice Tests

### From Text
Describe the homework or test you want to practice. The AI will convert it to a practice session.

\`\`\`
- Homework: Physics, Circular Motion, questions 1-35. Answers are A, C, B, D...
- Practice Test: Maths, 10 questions on calculus.
\`\`\`

### From JSON
Provide questions and answers for a structured practice session.

\`\`\`json
{
  "practice_test": {
    "questions": [
      { "number": 1, "text": "What is the capital of France?", "options": ["Berlin", "Madrid", "Paris", "Rome"], "type": "MCQ" },
      { "number": 2, "text": "Solve for x: 2x + 3 = 7", "type": "NUM" }
    ],
    "answers": {
      "1": "C",
      "2": "2"
    }
  }
}
\`\`\`

<h2>Flashcards</h2>

Provide a topic, and the AI will generate cards. Or provide the cards directly in JSON.

\`\`\`json
{
  "flashcard_deck": {
    "name": "Key Physics Formulas",
    "subject": "PHYSICS",
    "cards": [
      { "front": "Force equals?", "back": "Mass times Acceleration (F=ma)" },
      { "front": "Kinetic Energy formula?", "back": "1/2 * mv^2" }
    ]
  }
}
\`\`\`
`;
const neetGuide = `
# AI Data Import Guide (NEET)

You can import various types of data by pasting text into the AI Import modal. The AI will understand the structure and format it for you.

## Schedules

### From Plain Text
Simply describe your schedule. The AI is trained to pick up on keywords for Biology, Physics, and Chemistry.

\`\`\`
- Wednesday 9am Biology deep dive on Cell Cycle and Division.
- Friday 8pm solve Chemistry homework, questions 1-30 from chapter on Equilibrium.
- Saturday log my test result 580/720, mistakes were in Plant Kingdom and Work, Energy, Power.
\`\`\`

### From JSON
You can provide a structured JSON object for precise control.

\`\`\`json
{
  "schedules": [
    {
      "day": "Monday",
      "time": "19:00",
      "title": "Zoology Practice",
      "detail": "Focus on Human Physiology - Digestion and Absorption.",
      "subject": "BIOLOGY",
      "type": "ACTION",
      "sub_type": "DEEP_DIVE"
    }
  ]
}
\`\`\`

<h2>Practice Tests</h2>

<h3>From JSON</h3>
Provide questions and answers for a structured practice session. Biology questions are typically MCQs.

\`\`\`json
{
  "practice_test": {
    "questions": [
      { "number": 1, "text": "The powerhouse of the cell is?", "options": ["Nucleus", "Ribosome", "Mitochondrion", "Lysosome"], "type": "MCQ" },
      { "number": 2, "text": "Which of these is not a part of the digestive system?", "options": ["Stomach", "Liver", "Lungs", "Small Intestine"], "type": "MCQ" }
    ],
    "answers": {
      "1": "C",
      "2": "C"
    }
  }
}
\`\`\`

<h2>Flashcards</h2>

Provide a topic, and the AI will generate cards. This is great for Botany, Zoology, and Chemistry definitions.

\`\`\`json
{
  "flashcard_deck": {
    "name": "Key Biological Terms",
    "subject": "BIOLOGY",
    "cards": [
      { "front": "What is Mitosis?", "back": "A type of cell division that results in two daughter cells each having the same number and kind of chromosomes as the parent nucleus." },
      { "front": "What is the function of xylem?", "back": "Transports water and minerals from roots to other parts of the plant." }
    ]
  }
}
\`\`\`
`;

export const AIGuide: React.FC<AIGuideProps> = ({ examType }) => {
  const content = examType === 'NEET' ? neetGuide : jeeGuide;
  return <GuideRenderer content={content} />;
};