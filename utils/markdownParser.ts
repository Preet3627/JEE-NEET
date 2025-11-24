
export function renderMarkdown(text: string): string {
    if (!text) return '';

    const processInline = (line: string): string => {
        return line
            // Bold & Italics
            .replace(/\*\*(.*?)\*\*|__(.*?)__/g, '<strong>$1$2</strong>')
            .replace(/~~(.*?)~~/g, '<del>$1</del>')
            .replace(/(?<!\w)\*(.*?)\*(?!\w)|(?<!\w)_([^_]+)_(?!\w)/g, '<em>$1$2</em>')
            
            // Font Size
            .replace(/\[size=(\d+)\](.*?)\[\/size\]/g, '<span style="font-size: $1px;">$2</span>')
            
            // Inline Code
            .replace(/`([^`]+)`/g, '<code class="bg-gray-700/50 text-cyan-300 text-xs rounded px-1.5 py-0.5 font-mono">$1</code>')
            
            // Superscripts (x^2 or x^{2+})
            .replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>')
            .replace(/\^([\w\d\+\-]+)/g, '<sup>$1</sup>')
            
            // Subscripts (H_2O or H_{2}) - Critical for Chem/Math
            .replace(/_\{([^}]+)\}/g, '<sub>$1</sub>')
            .replace(/([A-Za-z\)])_(\d+)/g, '$1<sub>$2</sub>') 
            
            // Math Functions
            .replace(/log_\{([^}]+)\}\((.*?)\)/g, 'log<sub>$1</sub>($2)')
            .replace(/log_(\w+)\((.*?)\)/g, 'log<sub>$1</sub>($2)')
            .replace(/sqrt\((.*?)\)/g, '√<span style="text-decoration:overline;">$1</span>')
            
            // Greek & Math Symbols
            .replace(/\\Sigma/g, 'Σ').replace(/\\pi/g, 'π').replace(/\\phi/g, 'φ')
            .replace(/\\theta/g, 'θ').replace(/\\alpha/g, 'α').replace(/\\beta/g, 'β')
            .replace(/\\gamma/g, 'γ').replace(/\\delta/g, 'δ').replace(/\\Delta/g, 'Δ')
            .replace(/\\lambda/g, 'λ').replace(/\\omega/g, 'ω').replace(/\\mu/g, 'μ')
            .replace(/->/g, '→').replace(/=>/g, '⇒').replace(/approx/g, '≈')
            .replace(/\\ne/g, '≠').replace(/\\le/g, '≤').replace(/\\ge/g, '≥');
    };

    // Split by double newlines or code blocks
    const blocks = text.split(/(\n\n+|\n?```[\s\S]*?```\n?)/g);

    const html = blocks.map(block => {
        if (!block || block.trim() === '') return '';

        // Code blocks
        if (block.startsWith('```')) {
            const code = block.replace(/```(\w*\n)?|```/g, '');
            const escapedCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `<pre><code class="block text-sm p-2 rounded-md bg-gray-900/70 border border-gray-700 overflow-x-auto custom-scrollbar">${escapedCode}</code></pre>`;
        }
        
        const lines = block.trim().split('\n');

        // Headers
        if (lines[0].startsWith('#')) {
            const headerMatch = lines[0].match(/^(#+)\s(.*)/);
            if (headerMatch) {
                const level = headerMatch[1].length;
                const content = processInline(headerMatch[2]);
                // Tailwind classes for headers
                if (level === 1) return `<h1 class="text-2xl font-extrabold mt-4 border-b-2 border-gray-500 pb-2 text-white">${content}</h1>`;
                if (level === 2) return `<h2 class="text-xl font-bold mt-3 border-b border-gray-600 pb-1 text-cyan-400">${content}</h2>`;
                if (level === 3) return `<h3 class="text-lg font-semibold mt-2 text-gray-200">${content}</h3>`;
            }
        }
        
        // Unordered Lists
        if (lines.every(line => /^\s*[-*+] /.test(line))) {
            const listItems = lines.map(line => `<li>${processInline(line.replace(/^\s*[-*+] /, ''))}</li>`).join('');
            return `<ul class="ml-4 list-disc space-y-1 text-gray-300">${listItems}</ul>`;
        }

        // Ordered Lists
        if (lines.every(line => /^\s*\d+\. /.test(line))) {
            const listItems = lines.map(line => `<li>${processInline(line.replace(/^\s*\d+\. /, ''))}</li>`).join('');
            return `<ol class="ml-4 list-decimal space-y-1 text-gray-300">${listItems}</ol>`;
        }

        // Default to paragraph
        return `<p class="text-gray-300 leading-relaxed mb-2">${processInline(block)}</p>`;
    }).join('');

    return html;
}
