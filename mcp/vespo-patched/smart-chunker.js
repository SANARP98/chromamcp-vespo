/**
 * Smart Chunker - Intelligent code-aware chunking
 * Ported from git-rag-chat with core concepts adapted for JavaScript
 */

import { extractChunks, detectLanguage } from './code-parser.js';
import { extractConfigChunks, detectConfigLanguage } from './config-parser.js';

/**
 * Intelligently chunk code content
 * @param {string} content - Source code content
 * @param {string} filePath - File path for language detection
 * @param {Object} options - Chunking options
 * @returns {Array} - Array of chunks with enriched metadata
 */
export async function intelligentChunk(content, filePath, options = {}) {
  const {
    maxChunkSize = 4000,      // ~1000 tokens
    overlap = 200,             // ~50 tokens
    minChunkSize = 500,
    preserveSignatures = true,
    calculateComplexity = true
  } = options;

  const language = detectLanguage(filePath);
  const configLanguage = detectConfigLanguage(filePath);

  // Handle config file formats (Terraform, YAML) with structure-aware chunking
  if (configLanguage !== 'unknown') {
    const parsedChunks = extractConfigChunks(content, filePath);
    const finalChunks = [];

    for (const chunk of parsedChunks) {
      if (chunk.content.length <= maxChunkSize) {
        const enriched = await enrichChunkMetadata(chunk, content, filePath, {
          calculateComplexity,
          languageOverride: configLanguage
        });
        finalChunks.push(enriched);
      } else {
        const splitChunks = await splitWithOverlap(chunk, {
          maxChunkSize,
          overlap,
          preserveSignatures,
          language: configLanguage
        });
        for (const splitChunk of splitChunks) {
          const enriched = await enrichChunkMetadata(splitChunk, content, filePath, {
            calculateComplexity,
            languageOverride: configLanguage
          });
          finalChunks.push(enriched);
        }
      }
    }

    return finalChunks;
  }

  // For unsupported languages, fall back to simple chunking
  if (language === 'unknown') {
    return simpleChunk(content, { maxChunkSize, overlap });
  }

  // Parse code to extract functions/classes
  const parsedChunks = extractChunks(content, filePath);
  const finalChunks = [];

  for (const chunk of parsedChunks) {
    const chunkSize = chunk.content.length;

    // If chunk fits within max size, keep as-is
    if (chunkSize <= maxChunkSize) {
      const enriched = await enrichChunkMetadata(chunk, content, filePath, {
        calculateComplexity
      });
      finalChunks.push(enriched);
    } else {
      // Split large chunks at logical boundaries
      const splitChunks = await splitWithOverlap(chunk, {
        maxChunkSize,
        overlap,
        preserveSignatures,
        language
      });

      for (const splitChunk of splitChunks) {
        const enriched = await enrichChunkMetadata(splitChunk, content, filePath, {
          calculateComplexity
        });
        finalChunks.push(enriched);
      }
    }
  }

  return finalChunks;
}

/**
 * Split a large chunk at logical boundaries with overlap
 * @param {Object} chunk - Chunk to split
 * @param {Object} options - Split options
 * @returns {Array} - Array of split chunks
 */
async function splitWithOverlap(chunk, options) {
  const { maxChunkSize, overlap, preserveSignatures, language } = options;
  const lines = chunk.content.split('\n');
  const chunks = [];

  // Calculate lines per chunk (approximate)
  const avgLineLength = chunk.content.length / lines.length;
  const linesPerChunk = Math.floor(maxChunkSize / avgLineLength);
  const overlapLines = Math.floor(overlap / avgLineLength);

  let currentLine = 0;
  let partNumber = 0;

  while (currentLine < lines.length) {
    const endLine = Math.min(currentLine + linesPerChunk, lines.length);

    // Find optimal split point near endLine
    const splitPoint = findOptimalSplitPoint(lines, currentLine, endLine, language);

    // Extract chunk content
    let chunkLines = lines.slice(currentLine, splitPoint);

    // Preserve function signature in all chunks if needed
    if (preserveSignatures && chunk.signature && partNumber > 0) {
      chunkLines = [chunk.signature + ' {', ...chunkLines];
    }

    const chunkContent = chunkLines.join('\n');

    chunks.push({
      ...chunk,
      content: chunkContent,
      startLine: chunk.startLine + currentLine,
      endLine: chunk.startLine + splitPoint - 1,
      startChar: chunk.startChar + lines.slice(0, currentLine).join('\n').length,
      endChar: chunk.startChar + lines.slice(0, splitPoint).join('\n').length,
      isPartial: true,
      partNumber: partNumber,
      totalParts: 0, // Will be updated after loop
      parentChunk: chunk.name,
      // Only include docstring in first part
      docstring: partNumber === 0 ? chunk.docstring : null
    });

    // Move to next chunk with overlap
    currentLine = splitPoint - overlapLines;
    if (currentLine >= lines.length - overlapLines) {
      break;
    }
    partNumber++;
  }

  // Update total parts
  chunks.forEach(c => c.totalParts = chunks.length);

  return chunks;
}

/**
 * Find optimal split point using scoring system
 * @param {Array} lines - Code lines
 * @param {number} startLine - Start line index
 * @param {number} idealEndLine - Ideal end line index
 * @param {string} language - Programming language
 * @returns {number} - Optimal split line index
 */
function findOptimalSplitPoint(lines, startLine, idealEndLine, language) {
  const windowSize = 10;
  const searchStart = Math.max(startLine, idealEndLine - windowSize);
  const searchEnd = Math.min(lines.length, idealEndLine + windowSize);

  let bestScore = -1;
  let bestLine = idealEndLine;

  for (let i = searchStart; i < searchEnd; i++) {
    const score = scoreSplitPoint(lines[i], language);
    if (score > bestScore) {
      bestScore = score;
      bestLine = i;
    }
  }

  return bestLine;
}

/**
 * Score a split point (higher is better)
 * @param {string} line - Line to score
 * @param {string} language - Programming language
 * @returns {number} - Score (0-10)
 */
function scoreSplitPoint(line, language) {
  const trimmed = line.trim();

  // Empty line - perfect split
  if (!trimmed) return 10;

  // Comment line - good split
  if (language === 'javascript' || language === 'typescript') {
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      return 8;
    }
  } else if (language === 'python' || language === 'yaml') {
    if (trimmed.startsWith('#')) {
      return 8;
    }
  } else if (language === 'terraform') {
    if (trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
      return 8;
    }
  }

  // Closing braces/brackets - good split
  if (trimmed === '}' || trimmed === '};' || trimmed === '])' || trimmed === '];') {
    return 7;
  }

  // Return statement - decent split
  if (trimmed.startsWith('return ')) {
    return 6;
  }

  // Break/continue - decent split
  if (trimmed === 'break;' || trimmed === 'continue;') {
    return 5;
  }

  // Regular line - poor split
  return 1;
}

/**
 * Simple line-based chunking for unsupported languages
 * @param {string} content - Content to chunk
 * @param {Object} options - Chunking options
 * @returns {Array} - Array of chunks
 */
function simpleChunk(content, options) {
  const { maxChunkSize, overlap } = options;
  const chunks = [];

  if (content.length <= maxChunkSize) {
    return [{
      type: 'text',
      name: 'content',
      content: content,
      startLine: 1,
      endLine: content.split('\n').length,
      startChar: 0,
      endChar: content.length
    }];
  }

  let start = 0;
  let partNumber = 0;

  while (start < content.length) {
    const end = Math.min(start + maxChunkSize, content.length);
    const chunkContent = content.substring(start, end);

    chunks.push({
      type: 'text',
      name: `chunk_${partNumber}`,
      content: chunkContent,
      startLine: content.substring(0, start).split('\n').length + 1,
      endLine: content.substring(0, end).split('\n').length,
      startChar: start,
      endChar: end,
      isPartial: content.length > maxChunkSize,
      partNumber: partNumber,
      totalParts: 0 // Will be updated
    });

    start = end - overlap;
    if (start >= content.length - overlap) {
      break;
    }
    partNumber++;
  }

  // Update total parts
  chunks.forEach(c => c.totalParts = chunks.length);

  return chunks;
}

/**
 * Enrich chunk metadata with additional analysis
 * @param {Object} chunk - Chunk to enrich
 * @param {string} fullContent - Full file content
 * @param {string} filePath - File path
 * @param {Object} options - Enrichment options
 * @returns {Object} - Enriched chunk
 */
async function enrichChunkMetadata(chunk, fullContent, filePath, options) {
  const { calculateComplexity = true, languageOverride = null } = options;

  // Calculate lines of code (non-comment, non-blank)
  const loc = calculateLOC(chunk.content);

  // Complexity metric and importance score differ by language family.
  // Config formats use structural metrics; cyclomatic complexity is meaningless for them.
  let complexity;
  let score;

  if (languageOverride === 'terraform') {
    complexity = countTerraformAttributes(chunk.content); // # of key = value assignments
    score      = scoreConfigChunk(chunk, 'terraform');
  } else if (languageOverride === 'yaml') {
    complexity = maxYAMLNestingDepth(chunk.content);      // deepest indent level
    score      = scoreConfigChunk(chunk, 'yaml');
  } else {
    complexity = calculateComplexity ? estimateComplexity(chunk.content) : 0;
    score      = scoreChunk(chunk);
  }

  // Determine if public/exported (code-language concept only)
  const isPublic   = chunk.name && !chunk.name.startsWith('_');
  const isExported = chunk.isExported || false;

  return {
    content: chunk.content,
    metadata: {
      // Type information
      chunk_type: chunk.type,
      name:       chunk.name,
      language:   languageOverride || detectLanguage(filePath),

      // Position
      start_line: chunk.startLine,
      end_line:   chunk.endLine,
      start_char: chunk.startChar,
      end_char:   chunk.endChar,
      line_count: chunk.endLine - chunk.startLine + 1,
      char_count: chunk.content.length,

      // Chunking info
      is_partial:   chunk.isPartial || false,
      part_number:  chunk.partNumber  !== undefined ? chunk.partNumber  : 0,
      total_parts:  chunk.totalParts  !== undefined ? chunk.totalParts  : 1,
      parent_chunk: chunk.parentChunk || null,

      // Code analysis (meaningful for JS / TS / Python)
      signature:    chunk.signature || null,
      has_docstring: !!chunk.docstring,
      docstring:    chunk.docstring || null,
      decorators:   chunk.decorators ? chunk.decorators.join(', ') : null,

      // Metrics
      // complexity_estimate = cyclomatic for code | attribute count for TF | nesting depth for YAML
      complexity_estimate: complexity,
      loc:         loc,
      chunk_score: score,

      // Flags (code-language concepts; false/null for config)
      is_public:    isPublic,
      is_exported:  isExported,
      is_async:     chunk.isAsync     || false,
      is_generator: chunk.isGenerator || false,

      // ── Terraform-specific fields ──────────────────────────────────────────
      // Queryable: where: { tf_block_type: "resource", tf_resource_type: "aws_s3_bucket" }
      ...(languageOverride === 'terraform' ? {
        tf_block_type:      chunk.tf_block_type    || null,
        tf_resource_type:   chunk.tf_resource_type || null,
        tf_resource_name:   chunk.tf_resource_name || null,
        tf_attribute_count: complexity
      } : {}),

      // ── YAML-specific fields ───────────────────────────────────────────────
      // Queryable: where: { yaml_kind: "Deployment" } or { yaml_top_key: "jobs" }
      ...(languageOverride === 'yaml' ? {
        yaml_strategy:    chunk.yaml_strategy    || null,
        yaml_kind:        chunk.yaml_kind        || null,
        yaml_api_version: chunk.yaml_api_version || null,
        yaml_namespace:   chunk.yaml_namespace   || null,
        yaml_top_key:     chunk.yaml_top_key     || null,
        yaml_max_depth:   complexity
      } : {}),

      // Preview (first 200 chars)
      preview: chunk.content.substring(0, 200).replace(/\n/g, ' ').trim()
    }
  };
}

/**
 * Calculate lines of code (excluding comments and blank lines)
 * @param {string} content - Code content
 * @returns {number} - Lines of code
 */
function calculateLOC(content) {
  const lines = content.split('\n');
  let loc = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and comment-only lines
    if (trimmed &&
        !trimmed.startsWith('//') &&
        !trimmed.startsWith('#') &&
        !trimmed.startsWith('/*') &&
        !trimmed.startsWith('*')) {
      loc++;
    }
  }

  return loc;
}

/**
 * Estimate cyclomatic complexity
 * @param {string} content - Code content
 * @returns {number} - Complexity estimate
 */
function estimateComplexity(content) {
  let complexity = 1; // Base complexity

  // Count control flow statements
  const patterns = [
    /\bif\b/g,           // +1 for each if
    /\belse\s+if\b/g,    // +1 for each else if
    /\belse\b/g,         // +1 for each else
    /\bfor\b/g,          // +1 for each for
    /\bwhile\b/g,        // +1 for each while
    /\bcase\b/g,         // +1 for each case
    /\bcatch\b/g,        // +1 for each catch
    /\btry\b/g,          // +1 for each try
    /\band\b/g,          // +1 for each logical and
    /\bor\b/g,           // +1 for each logical or
    /&&/g,               // +1 for each &&
    /\|\|/g,             // +1 for each ||
    /\?/g                // +1 for each ternary
  ];

  for (const pattern of patterns) {
    const matches = content.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }

  // Cap at 100
  return Math.min(complexity, 100);
}

/**
 * Score chunk importance (0-10)
 * @param {Object} chunk - Chunk to score
 * @returns {number} - Score
 */
function scoreChunk(chunk) {
  let score = 5; // Base score

  // Exported/public items are more important
  if (chunk.isExported) score += 2;
  if (chunk.name && !chunk.name.startsWith('_')) score += 1;

  // Functions/classes more important than other code
  if (chunk.type === 'function') score += 1;
  if (chunk.type === 'class') score += 1;

  // Has documentation
  if (chunk.docstring) score += 1;

  // Async/generators often important
  if (chunk.isAsync) score += 0.5;
  if (chunk.isGenerator) score += 0.5;

  return Math.min(Math.round(score), 10);
}

// ─────────────────────────────────────────────
// Config-specific metrics
// ─────────────────────────────────────────────

/**
 * Count HCL attribute assignments inside a Terraform block.
 * Used as a structural complexity substitute (cyclomatic is meaningless for HCL).
 * Matches lines like:  ami           = "ami-0c55b159cbfafe1f0"
 *                      instance_type = var.instance_type
 * Excludes block headers that end with `{`.
 */
function countTerraformAttributes(content) {
  let count = 0;
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (/^\w+\s*=\s*/.test(trimmed) && !trimmed.endsWith('{')) {
      count++;
    }
  }
  return count;
}

/**
 * Find the maximum nesting depth in YAML content by indentation level.
 * Each 2-space indent = 1 depth level.
 * Used as a structural complexity substitute for YAML chunks.
 */
function maxYAMLNestingDepth(content) {
  let maxDepth = 0;
  for (const line of content.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const indent = line.length - line.trimStart().length;
    const depth = Math.ceil(indent / 2);
    if (depth > maxDepth) maxDepth = depth;
  }
  return maxDepth;
}

// Importance scores for Terraform top-level block types (0-10 scale).
// Resources and modules are the primary targets of infrastructure queries.
const TF_BLOCK_SCORES = {
  resource:  8,  // Infrastructure definitions — most searched
  module:    7,  // Module calls — reusable components
  data:      7,  // Data sources — commonly referenced
  output:    6,  // Exported values
  variable:  6,  // Input interface
  check:     5,  // Health checks
  provider:  5,  // Provider configuration
  terraform: 5,  // Terraform settings block
  locals:    4,  // Local value helpers
  moved:     3,  // Refactoring metadata
  import:    3,  // Import existing resources
  removed:   3   // Removal metadata
};

// Importance scores for well-known YAML top-level keys.
// Higher = more likely to be the primary chunk a query targets.
const YAML_KEY_SCORES = {
  // CI/CD
  jobs:        8,  // GitHub Actions jobs / GitLab CI jobs
  stages:      8,  // GitLab CI stages
  pipeline:    8,
  // Docker Compose
  services:    8,  // Service definitions
  volumes:     6,
  networks:    5,
  // Kubernetes / general
  spec:        7,
  containers:  8,
  // Config / settings
  config:      6,
  settings:    6,
  env:         5,
  environment: 5,
  // Helm / templates
  image:       7,
  ingress:     7,
  resources:   6
};

// Importance scores for Kubernetes Kind values.
// Workload and network resources are the most query-relevant.
const K8S_KIND_SCORES = {
  Deployment:                 9,
  StatefulSet:                8,
  DaemonSet:                  8,
  CronJob:                    7,
  Job:                        7,
  Service:                    8,
  Ingress:                    8,
  ConfigMap:                  6,
  Secret:                     7,
  ServiceAccount:             5,
  Role:                       6,
  ClusterRole:                6,
  RoleBinding:                5,
  ClusterRoleBinding:         5,
  HorizontalPodAutoscaler:    7,
  PersistentVolumeClaim:      6,
  PersistentVolume:           5,
  Namespace:                  5
};

/**
 * Score a config chunk (Terraform or YAML) by structural importance.
 * Returns 0-10. Replaces the code-oriented scoreChunk() for config languages.
 */
function scoreConfigChunk(chunk, language) {
  if (language === 'terraform') {
    return TF_BLOCK_SCORES[chunk.type] ?? 5;
  }

  if (language === 'yaml') {
    if (chunk.type === 'document') {
      // Score Kubernetes documents by kind; fall back to 6 for unknown kinds
      const kind = chunk.yaml_kind;
      return kind ? (K8S_KIND_SCORES[kind] ?? 6) : 5;
    }
    if (chunk.type === 'key') {
      return YAML_KEY_SCORES[chunk.name] ?? 5;
    }
  }

  return 5;
}
