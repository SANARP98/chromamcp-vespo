/**
 * OpenAI Embedder - Generate embeddings using OpenAI's text-embedding-3-large
 * Includes retry logic, batch processing, and cost tracking
 */

import OpenAI from 'openai';

export class OpenAIEmbedder {
  constructor(apiKey, options = {}) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.client = new OpenAI({ apiKey });
    this.model = options.model || 'text-embedding-3-large';
    this.dimensions = options.dimensions || 3072; // text-embedding-3-large default
    this.maxRetries = options.maxRetries || 3;
    this.batchSize = options.batchSize || 100; // OpenAI allows up to 2048, but 100 is safer
    this.requestsPerMinute = options.requestsPerMinute || 3000; // Rate limiting
    this.tokensPerMinute = options.tokensPerMinute || 1000000; // Rate limiting

    // Cost per million tokens (as of 2025)
    this.costPerMillionTokens = this.model === 'text-embedding-3-large' ? 0.13 : 0.02;

    // Rate limiting state
    this.requestCount = 0;
    this.tokenCount = 0;
    this.windowStart = Date.now();
  }

  /**
   * Generate embeddings for an array of texts
   * @param {Array<string>} texts - Texts to embed
   * @param {Object} options - Embedding options
   * @returns {Promise<Array<Array<number>>>} - Array of embedding vectors
   */
  async embed(texts, options = {}) {
    if (!texts || texts.length === 0) {
      return [];
    }

    const { showProgress = false } = options;

    // Split into batches
    const batches = this.createBatches(texts, this.batchSize);
    const allEmbeddings = [];
    let totalTokens = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      if (showProgress) {
        console.error(`Embedding batch ${i + 1}/${batches.length} (${batch.length} texts)...`);
      }

      // Check rate limits before making request
      await this.checkRateLimits(batch);

      // Generate embeddings with retry logic
      const result = await this.withRetry(async () => {
        return await this.client.embeddings.create({
          model: this.model,
          input: batch,
          encoding_format: 'float',
          dimensions: this.dimensions
        });
      });

      // Extract embeddings from response
      const embeddings = result.data.map(d => d.embedding);
      allEmbeddings.push(...embeddings);

      // Track usage
      totalTokens += result.usage.total_tokens;
      this.tokenCount += result.usage.total_tokens;
      this.requestCount++;
    }

    if (showProgress) {
      const cost = this.calculateCost(totalTokens);
      console.error(`Embeddings generated. Tokens used: ${totalTokens}, Estimated cost: $${cost.toFixed(4)}`);
    }

    return allEmbeddings;
  }

  /**
   * Generate a single embedding
   * @param {string} text - Text to embed
   * @returns {Promise<Array<number>>} - Embedding vector
   */
  async embedSingle(text) {
    const embeddings = await this.embed([text]);
    return embeddings[0];
  }

  /**
   * Retry a function with exponential backoff
   * @param {Function} fn - Async function to retry
   * @param {number} retryCount - Current retry attempt
   * @returns {Promise<any>} - Function result
   */
  async withRetry(fn, retryCount = 0) {
    try {
      return await fn();
    } catch (error) {
      // Check if we should retry
      const shouldRetry = this.shouldRetryError(error) && retryCount < this.maxRetries;

      if (!shouldRetry) {
        throw error;
      }

      // Calculate backoff delay (exponential: 1s, 2s, 4s)
      const delay = Math.pow(2, retryCount) * 1000;

      console.warn(`OpenAI API error (attempt ${retryCount + 1}/${this.maxRetries}): ${error.message}`);
      console.warn(`Retrying in ${delay}ms...`);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));

      // Retry
      return await this.withRetry(fn, retryCount + 1);
    }
  }

  /**
   * Determine if an error should trigger a retry
   * @param {Error} error - Error object
   * @returns {boolean} - True if should retry
   */
  shouldRetryError(error) {
    // Retry on rate limit errors
    if (error.status === 429) return true;

    // Retry on server errors (500-599)
    if (error.status >= 500 && error.status < 600) return true;

    // Retry on network errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') return true;

    // Don't retry on client errors (400-499, except 429)
    return false;
  }

  /**
   * Check and enforce rate limits
   * @param {Array<string>} batch - Batch to process
   */
  async checkRateLimits(batch) {
    const now = Date.now();
    const windowDuration = 60 * 1000; // 1 minute

    // Reset window if needed
    if (now - this.windowStart >= windowDuration) {
      this.requestCount = 0;
      this.tokenCount = 0;
      this.windowStart = now;
      return;
    }

    // Estimate tokens for this batch
    const estimatedTokens = batch.reduce((sum, text) => sum + this.estimateTokens(text), 0);

    // Check if we would exceed limits
    const wouldExceedRequests = this.requestCount >= this.requestsPerMinute;
    const wouldExceedTokens = (this.tokenCount + estimatedTokens) >= this.tokensPerMinute;

    if (wouldExceedRequests || wouldExceedTokens) {
      // Calculate time to wait until window resets
      const timeUntilReset = windowDuration - (now - this.windowStart);
      console.error(`Rate limit approaching. Waiting ${Math.ceil(timeUntilReset / 1000)}s...`);
      await new Promise(resolve => setTimeout(resolve, timeUntilReset));

      // Reset counters
      this.requestCount = 0;
      this.tokenCount = 0;
      this.windowStart = Date.now();
    }
  }

  /**
   * Estimate tokens in text (rough approximation)
   * @param {string} text - Text to estimate
   * @returns {number} - Estimated token count
   */
  estimateTokens(text) {
    // Rough estimate: 1 token ≈ 4 characters for English text
    // This is conservative; actual tokenization may vary
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate cost for token usage
   * @param {number} tokens - Number of tokens
   * @returns {number} - Cost in USD
   */
  calculateCost(tokens) {
    return (tokens / 1000000) * this.costPerMillionTokens;
  }

  /**
   * Create batches from an array
   * @param {Array} items - Items to batch
   * @param {number} size - Batch size
   * @returns {Array<Array>} - Array of batches
   */
  createBatches(items, size) {
    const batches = [];
    for (let i = 0; i < items.length; i += size) {
      batches.push(items.slice(i, i + size));
    }
    return batches;
  }

  /**
   * Get embedding model information
   * @returns {Object} - Model info
   */
  getModelInfo() {
    return {
      model: this.model,
      dimensions: this.dimensions,
      costPerMillionTokens: this.costPerMillionTokens,
      batchSize: this.batchSize
    };
  }

  /**
   * Reset rate limit counters (useful for testing)
   */
  resetRateLimits() {
    this.requestCount = 0;
    this.tokenCount = 0;
    this.windowStart = Date.now();
  }
}

/**
 * Create an OpenAI embedder instance
 * @param {string} apiKey - OpenAI API key
 * @param {Object} options - Embedder options
 * @returns {OpenAIEmbedder} - Embedder instance
 */
export function createEmbedder(apiKey, options = {}) {
  return new OpenAIEmbedder(apiKey, options);
}
