/**
 * @gleam-openclaw/tavily-search
 *
 * Tavily Search — AI-native real-time web search optimized for AI interaction.
 * Outputs structured summaries with trusted source attribution and no ad interference.
 * Eliminates LLM "hallucinations" by grounding responses in real-time web data.
 */

import EventEmitter from "eventemitter3";

export type SearchDepth = "basic" | "advanced";
export type SearchTopic = "general" | "news" | "finance" | "research";

export interface TavilySearchConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultDepth?: SearchDepth;
  defaultMaxResults?: number;
  timeout?: number;
}

export interface TavilySearchRequest {
  query: string;
  searchDepth?: SearchDepth;
  topic?: SearchTopic;
  maxResults?: number;
  includeAnswer?: boolean;
  includeRawContent?: boolean;
  includeDomains?: string[];
  excludeDomains?: string[];
  days?: number;
}

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  rawContent?: string;
  score: number;
  publishedDate?: string;
}

export interface TavilySearchResponse {
  query: string;
  answer?: string;
  results: TavilySearchResult[];
  responseTime: number;
  followUpQuestions?: string[];
}

export interface TavilyEvents {
  searchStarted: (query: string) => void;
  searchCompleted: (response: TavilySearchResponse) => void;
  error: (error: Error) => void;
}

const TAVILY_API_BASE = "https://api.tavily.com";

export class TavilySearch extends EventEmitter<TavilyEvents> {
  private apiKey: string;
  private baseUrl: string;
  private defaultDepth: SearchDepth;
  private defaultMaxResults: number;
  private timeout: number;

  constructor(config: TavilySearchConfig = {}) {
    super();
    this.apiKey = config.apiKey || process.env.TAVILY_API_KEY || "";
    this.baseUrl = config.baseUrl || TAVILY_API_BASE;
    this.defaultDepth = config.defaultDepth || "basic";
    this.defaultMaxResults = config.defaultMaxResults || 5;
    this.timeout = config.timeout || 30000;
  }

  async search(request: TavilySearchRequest): Promise<TavilySearchResponse> {
    if (!this.apiKey) {
      throw new Error("Tavily API key is not configured. Set TAVILY_API_KEY environment variable.");
    }

    this.emit("searchStarted", request.query);
    const startTime = Date.now();

    const body = {
      api_key: this.apiKey,
      query: request.query,
      search_depth: request.searchDepth || this.defaultDepth,
      topic: request.topic || "general",
      max_results: request.maxResults || this.defaultMaxResults,
      include_answer: request.includeAnswer ?? true,
      include_raw_content: request.includeRawContent ?? false,
      include_domains: request.includeDomains || [],
      exclude_domains: request.excludeDomains || [],
      days: request.days,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status} ${await response.text()}`);
      }

      const data = await response.json();
      const responseTime = Date.now() - startTime;

      const result: TavilySearchResponse = {
        query: request.query,
        answer: data.answer,
        results: (data.results || []).map((r: any) => ({
          title: r.title,
          url: r.url,
          content: r.content,
          rawContent: r.raw_content,
          score: r.score || 0,
          publishedDate: r.published_date,
        })),
        responseTime,
        followUpQuestions: data.follow_up_questions,
      };

      this.emit("searchCompleted", result);
      return result;
    } catch (error: any) {
      clearTimeout(timeoutId);
      this.emit("error", error);
      throw error;
    }
  }

  async searchAndSummarize(query: string): Promise<string> {
    const response = await this.search({
      query,
      searchDepth: "advanced",
      includeAnswer: true,
      maxResults: 5,
    });

    if (response.answer) {
      const sources = response.results
        .map((r, i) => `[${i + 1}] ${r.title} — ${r.url}`)
        .join("\n");

      return `${response.answer}\n\nSources:\n${sources}`;
    }

    return response.results.map((r) => `**${r.title}**\n${r.content}\nSource: ${r.url}`).join("\n\n");
  }

  async getExtract(urls: string[]): Promise<Record<string, string>> {
    if (!this.apiKey) {
      throw new Error("Tavily API key is not configured.");
    }

    const response = await fetch(`${this.baseUrl}/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: this.apiKey, urls }),
    });

    if (!response.ok) {
      throw new Error(`Tavily Extract error: ${response.status}`);
    }

    const data = await response.json();
    const result: Record<string, string> = {};

    for (const item of data.results || []) {
      result[item.url] = item.raw_content || item.content || "";
    }

    return result;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }
}
