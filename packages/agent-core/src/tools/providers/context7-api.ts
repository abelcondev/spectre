/**
 * Context7ApiProvider — direct REST API client for Context7.
 *
 * Used by the builtin `Context7` tool to search libraries and query
 * up-to-date documentation without requiring the Context7 MCP server.
 */

export interface Context7Library {
  id: string;
  name?: string;
  description?: string;
  versions?: string[];
  lastUpdateDate?: string;
}

export interface Context7SearchResponse {
  libraries?: Context7Library[];
}

export interface Context7ContextResponse {
  texts?: string[];
}

export interface Context7ApiProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class Context7ApiProvider {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: Context7ApiProviderOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? 'https://context7.com/api/v2';
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async searchLibraries(query: string): Promise<Context7Library[]> {
    const url = new URL(`${this.baseUrl}/libs/search`);
    url.searchParams.set('libraryName', query);

    const response = await this.get(url);
    await this.handleError(response, 'search libraries');

    const json = (await response.json()) as Context7SearchResponse;
    return Array.isArray(json.libraries) ? json.libraries : [];
  }

  async queryContext(libraryId: string, query: string): Promise<string[]> {
    const url = new URL(`${this.baseUrl}/context`);
    url.searchParams.set('libraryId', libraryId);
    url.searchParams.set('query', query);
    url.searchParams.set('type', 'txt');

    const response = await this.get(url);
    await this.handleError(response, 'query context');

    const json = (await response.json()) as Context7ContextResponse;
    return Array.isArray(json.texts) ? json.texts : [];
  }

  private async get(url: URL): Promise<Response> {
    const apiKey = this.resolveApiKey();
    return this.fetchImpl(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });
  }

  private async handleError(response: Response, operation: string): Promise<void> {
    if (response.status === 401) {
      throw new Error(
        `Context7 API request failed: HTTP 401 (auth/unauthorized). Check your [services.context7] apiKey in config.toml or the CONTEXT7_API_KEY environment variable.`,
      );
    }
    if (response.status !== 200) {
      const detail = await safeReadText(response);
      throw new Error(
        `Context7 API request failed while trying to ${operation}: HTTP ${String(response.status)}. ${detail}`.trim(),
      );
    }
  }

  private resolveApiKey(): string {
    if (this.apiKey !== undefined && this.apiKey.length > 0) {
      return this.apiKey;
    }
    const envKey = typeof process !== 'undefined' ? process.env['CONTEXT7_API_KEY'] : undefined;
    if (envKey !== undefined && envKey.length > 0) {
      return envKey;
    }
    throw new Error(
      'Context7 API key not configured. To enable library documentation lookups, add your API key to ~/.spectre/config.toml:\n\n' +
        '  [services.context7]\n' +
        '  api_key = "YOUR_CONTEXT7_API_KEY"\n\n' +
        'Or set the CONTEXT7_API_KEY environment variable.',
    );
  }
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}
