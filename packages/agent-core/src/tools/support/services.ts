import type { Context7ApiProvider } from '../providers/context7-api';
import type { UrlFetcher, WebSearchProvider } from '../builtin';

export interface ToolServices {
  readonly urlFetcher?: UrlFetcher;
  readonly webSearcher?: WebSearchProvider;
  readonly context7?: Context7ApiProvider;
}
