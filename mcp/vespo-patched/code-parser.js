/**
 * Code Parser - Language-aware AST parsing for intelligent chunking
 * Supports JavaScript/TypeScript (via Acorn) and Python (regex-based)
 */

import { parse } from 'acorn';
import { extname } from 'path';

/**
 * Detect programming language from file path
 * @param {string} filePath - Path to the file
 * @returns {string} - 'javascript', 'python', or 'unknown'
 */
export function detectLanguage(filePath) {
  const ext = extname(filePath).toLowerCase();

  const languageMap = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    '.py': 'python',
    '.pyw': 'python'
  };

  return languageMap[ext] || 'unknown';
}

/**
 * Parse JavaScript/TypeScript code using Acorn
 * @param {string} code - Source code
 * @param {string} filePath - File path for context
 * @returns {Array} - Array of parsed chunks with metadata
 */
export function parseJavaScript(code, filePath) {
  const chunks = [];

  try {
    // Parse with Acorn - allow for various syntax features
    const ast = parse(code, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      allowHashBang: true,
      allowAwaitOutsideFunction: true,
      allowImportExportEverywhere: true,
      locations: true
    });

    const lines = code.split('\n');

    // Walk the AST to find top-level declarations
    if (ast.body) {
      for (const node of ast.body) {
        const chunk = extractNodeInfo(node, code, lines);
        if (chunk) {
          chunks.push(chunk);
        }
      }
    }

    // If no chunks found, return whole file as one chunk
    if (chunks.length === 0) {
      chunks.push({
        type: 'other',
        name: 'module',
        startLine: 1,
        endLine: lines.length,
        startChar: 0,
        endChar: code.length,
        content: code,
        signature: null,
        docstring: null
      });
    }

  } catch (error) {
    // If parsing fails, fall back to whole file
    console.warn(`Failed to parse JavaScript: ${error.message}`);
    chunks.push({
      type: 'other',
      name: 'unparseable',
      startLine: 1,
      endLine: code.split('\n').length,
      startChar: 0,
      endChar: code.length,
      content: code,
      signature: null,
      docstring: null
    });
  }

  return chunks;
}

/**
 * Extract information from an AST node
 * @param {Object} node - AST node
 * @param {string} code - Full source code
 * @param {Array} lines - Code split into lines
 * @returns {Object|null} - Chunk metadata or null
 */
function extractNodeInfo(node, code, lines) {
  let chunk = null;

  switch (node.type) {
    case 'FunctionDeclaration':
      chunk = {
        type: 'function',
        name: node.id ? node.id.name : 'anonymous',
        startLine: node.loc.start.line,
        endLine: node.loc.end.line,
        startChar: node.start,
        endChar: node.end,
        content: code.substring(node.start, node.end),
        signature: extractSignature(node, code),
        docstring: extractJSDoc(node, code, lines),
        isAsync: node.async || false,
        isGenerator: node.generator || false
      };
      break;

    case 'ClassDeclaration':
      chunk = {
        type: 'class',
        name: node.id ? node.id.name : 'anonymous',
        startLine: node.loc.start.line,
        endLine: node.loc.end.line,
        startChar: node.start,
        endChar: node.end,
        content: code.substring(node.start, node.end),
        signature: `class ${node.id ? node.id.name : 'anonymous'}`,
        docstring: extractJSDoc(node, code, lines)
      };
      break;

    case 'VariableDeclaration':
      // Check if it's an arrow function or function expression
      for (const declarator of node.declarations) {
        if (declarator.init) {
          if (declarator.init.type === 'ArrowFunctionExpression' ||
              declarator.init.type === 'FunctionExpression') {
            chunk = {
              type: 'function',
              name: declarator.id.name,
              startLine: node.loc.start.line,
              endLine: node.loc.end.line,
              startChar: node.start,
              endChar: node.end,
              content: code.substring(node.start, node.end),
              signature: extractArrowSignature(declarator, code),
              docstring: extractJSDoc(node, code, lines),
              isAsync: declarator.init.async || false
            };
            break;
          }
        }
      }
      break;

    case 'ExportNamedDeclaration':
    case 'ExportDefaultDeclaration':
      // Recursively extract from the declaration being exported
      if (node.declaration) {
        chunk = extractNodeInfo(node.declaration, code, lines);
        if (chunk) {
          chunk.isExported = true;
        }
      }
      break;
  }

  return chunk;
}

/**
 * Extract function signature
 * @param {Object} node - Function AST node
 * @param {string} code - Full source code
 * @returns {string} - Function signature
 */
function extractSignature(node, code) {
  const async = node.async ? 'async ' : '';
  const generator = node.generator ? '*' : '';
  const name = node.id ? node.id.name : 'anonymous';

  // Extract parameter list
  const paramsStart = node.start;
  const paramsEnd = node.body.start;
  const signatureText = code.substring(paramsStart, paramsEnd).trim();

  return signatureText;
}

/**
 * Extract arrow function signature
 * @param {Object} declarator - Variable declarator node
 * @param {string} code - Full source code
 * @returns {string} - Function signature
 */
function extractArrowSignature(declarator, code) {
  const name = declarator.id.name;
  const async = declarator.init.async ? 'async ' : '';

  // Extract the declaration
  const declText = code.substring(declarator.start, declarator.end);
  return declText.split('{')[0].trim() + ' {...}';
}

/**
 * Extract JSDoc comment before a node
 * @param {Object} node - AST node
 * @param {string} code - Full source code
 * @param {Array} lines - Code split into lines
 * @returns {string|null} - JSDoc comment or null
 */
function extractJSDoc(node, code, lines) {
  const startLine = node.loc.start.line;

  // Look backward for JSDoc comment
  for (let i = startLine - 2; i >= 0 && i >= startLine - 10; i--) {
    const line = lines[i].trim();
    if (line.startsWith('/**')) {
      // Found start of JSDoc, collect until */
      const docLines = [];
      for (let j = i; j < startLine - 1; j++) {
        docLines.push(lines[j]);
      }
      return docLines.join('\n').trim();
    }
    if (line && !line.startsWith('*') && !line.startsWith('//')) {
      // Hit non-comment code, stop looking
      break;
    }
  }

  return null;
}

/**
 * Parse Python code using regex
 * @param {string} code - Source code
 * @param {string} filePath - File path for context
 * @returns {Array} - Array of parsed chunks with metadata
 */
export function parsePython(code, filePath) {
  const chunks = [];
  const lines = code.split('\n');

  // Regex patterns for Python
  const functionPattern = /^(\s*)((?:@\w+(?:\(.*?\))?\s+)*)?(async\s+)?def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*[^:]+)?:/gm;
  const classPattern = /^(\s*)class\s+(\w+)(?:\s*\(([^)]*)\))?:/gm;

  // Find all functions
  let match;
  while ((match = functionPattern.exec(code)) !== null) {
    const indent = match[1];
    const decorators = match[2] ? match[2].trim().split('\n').map(d => d.trim()).filter(Boolean) : [];
    const isAsync = match[3] !== undefined;
    const name = match[4];
    const params = match[5];
    const startChar = match.index;

    // Find the start line
    const startLine = code.substring(0, startChar).split('\n').length;

    // Find the end of the function by indentation
    const endInfo = findPythonBlockEnd(lines, startLine - 1, indent.length);

    // Extract docstring
    const docstring = extractPythonDocstring(lines, startLine);

    chunks.push({
      type: 'function',
      name: name,
      startLine: startLine,
      endLine: endInfo.endLine,
      startChar: startChar,
      endChar: endInfo.endChar,
      content: code.substring(startChar, endInfo.endChar),
      signature: `${isAsync ? 'async ' : ''}def ${name}(${params})`,
      docstring: docstring,
      decorators: decorators,
      isAsync: isAsync
    });
  }

  // Reset regex
  functionPattern.lastIndex = 0;

  // Find all classes
  while ((match = classPattern.exec(code)) !== null) {
    const indent = match[1];
    const name = match[2];
    const bases = match[3] || '';
    const startChar = match.index;

    // Find the start line
    const startLine = code.substring(0, startChar).split('\n').length;

    // Find the end of the class by indentation
    const endInfo = findPythonBlockEnd(lines, startLine - 1, indent.length);

    // Extract docstring
    const docstring = extractPythonDocstring(lines, startLine);

    chunks.push({
      type: 'class',
      name: name,
      startLine: startLine,
      endLine: endInfo.endLine,
      startChar: startChar,
      endChar: endInfo.endChar,
      content: code.substring(startChar, endInfo.endChar),
      signature: `class ${name}${bases ? `(${bases})` : ''}`,
      docstring: docstring
    });
  }

  // If no chunks found, return whole file
  if (chunks.length === 0) {
    chunks.push({
      type: 'other',
      name: 'module',
      startLine: 1,
      endLine: lines.length,
      startChar: 0,
      endChar: code.length,
      content: code,
      signature: null,
      docstring: null
    });
  }

  // Sort by start position
  chunks.sort((a, b) => a.startChar - b.startChar);

  return chunks;
}

/**
 * Find the end of a Python code block by indentation
 * @param {Array} lines - Code lines
 * @param {number} startLine - Starting line (0-indexed)
 * @param {number} baseIndent - Base indentation level
 * @returns {Object} - {endLine, endChar}
 */
function findPythonBlockEnd(lines, startLine, baseIndent) {
  let endLine = startLine + 1;

  // Skip to the first line after the def/class line
  while (endLine < lines.length) {
    const line = lines[endLine];
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      endLine++;
      continue;
    }

    // Calculate indentation
    const indent = line.length - line.trimStart().length;

    // If indentation is less than or equal to base, we've exited the block
    if (indent <= baseIndent) {
      break;
    }

    endLine++;
  }

  // Calculate character position
  const endChar = lines.slice(0, endLine).join('\n').length;

  return { endLine: endLine, endChar: endChar };
}

/**
 * Extract Python docstring (triple-quoted string after def/class)
 * @param {Array} lines - Code lines
 * @param {number} startLine - Function/class start line (1-indexed)
 * @returns {string|null} - Docstring or null
 */
function extractPythonDocstring(lines, startLine) {
  // Look for docstring on next few lines
  for (let i = startLine; i < Math.min(startLine + 5, lines.length); i++) {
    const line = lines[i].trim();

    // Check for triple-quoted strings
    if (line.startsWith('"""') || line.startsWith("'''")) {
      const quote = line.substring(0, 3);
      const docLines = [line];

      // If it's a one-line docstring
      if (line.endsWith(quote) && line.length > 6) {
        return line.substring(3, line.length - 3).trim();
      }

      // Multi-line docstring
      for (let j = i + 1; j < lines.length; j++) {
        docLines.push(lines[j]);
        if (lines[j].trim().endsWith(quote)) {
          return docLines.join('\n').trim();
        }
      }
    }

    // Stop if we hit code
    if (line && !line.startsWith('#')) {
      break;
    }
  }

  return null;
}

/**
 * Extract chunks from code based on language
 * @param {string} code - Source code
 * @param {string} filePath - File path
 * @returns {Array} - Array of chunks with metadata
 */
export function extractChunks(code, filePath) {
  const language = detectLanguage(filePath);

  switch (language) {
    case 'javascript':
    case 'typescript':
      return parseJavaScript(code, filePath);
    case 'python':
      return parsePython(code, filePath);
    default:
      // Return whole file as single chunk for unknown languages
      return [{
        type: 'other',
        name: 'unknown',
        startLine: 1,
        endLine: code.split('\n').length,
        startChar: 0,
        endChar: code.length,
        content: code,
        signature: null,
        docstring: null
      }];
  }
}
