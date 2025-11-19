export function renderMarkdown(text: string): string {
    if (!text) return '';

    const processInline = (line: string): string => {
        return line
            .replace(/\*\*(.*?)\*\*|__(.*?)__/g, '<strong>$1$2</strong>')
            .replace(/~~(.*?)~~/g, '<del>$1</del>')
            .replace(/\[size=(\d+)\](.*?)\[\/size\]/g, '<span style="font-size: $1px;">$2</span>')
            .replace(/`([^`]+)`/g, '<code class="bg-gray-700/50 text-cyan-300 text-xs rounded px-1.5 py-0.5 font-mono">$1</code>')
            .replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>')
            .replace(/\^([\w\d\+\-]+)/g, '<sup>$1</sup>')
            .replace(/_\{([^}]+)\}/g, '<sub>$1</sub>')
            .replace(/(?<=[A-Za-z])_(\d+)/g, '<sub>$1</sub>') // General subscript for numbers after letters (e.g., H_2, SO_4)
            .replace(/(?<!\w)\*(.*?)\*(?!\w)|(?<!\w)_([^_]+)_(?!\w)/g, '<em>$1$2</em>')
            .replace(/log_\{([^}]+)\}\((.*?)\)/g, 'log<sub>$1</sub>($2)')
            .replace(/log_(\w+)\((.*?)\)/g, 'log<sub>$1</sub>($2)')
            .replace(/\\Sigma/g, 'Σ').replace(/\\pi/g, 'π').replace(/\\phi/g, 'φ')
            .replace(/\\theta/g, 'θ').replace(/\\alpha/g, 'α').replace(/\\beta/g, 'β')
            .replace(/\\gamma/g, 'γ').replace(/\\delta/g, 'δ').replace(/\\Delta/g, 'Δ');
    };

    const blocks = text.split(/(\n\n+|\n?```[\s\S]*?```\n?)/g);

    const html = blocks.map(block => {
        if (!block || block.trim() === '') return '';

        // Code blocks
        if (block.startsWith('```')) {
            const code = block.replace(/```(\w*\n)?|```/g, '');
            const escapedCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `<pre><code class="block text-sm p-2 rounded-md bg-gray-900/70 border border-gray-700 overflow-x-auto">${escapedCode}</code></pre>`;
        }
        
        const lines = block.trim().split('\n');

        // Headers
        if (lines[0].startsWith('#')) {
            const headerMatch = lines[0].match(/^(#+)\s(.*)/);
            if (headerMatch) {
                const level = headerMatch[1].length;
                const content = processInline(headerMatch[2]);
                if (level <= 3) {
                     const size = ['text-2xl font-extrabold mt-4 border-b-2 border-gray-500 pb-2', 'text-xl font-bold mt-3 border-b border-gray-600 pb-1', 'text-lg font-semibold mt-2'][level-1];
                    return `<h${level} class="${size}">${content}</h${level}>`;
                }
            }
        }
        
        // Unordered Lists
        if (lines.every(line => /^\s*[-*+] /.test(line))) {
            const listItems = lines.map(line => `<li>${processInline(line.replace(/^\s*[-*+] /, ''))}</li>`).join('');
            return `<ul class="ml-4 list-disc space-y-1">${listItems}</ul>`;
        }

        // Default to paragraph
        return `<p>${processInline(block)}</p>`;
    }).join('');

    return html.replace(/<p><\/p>/g, ''); // Clean up empty paragraphs
}