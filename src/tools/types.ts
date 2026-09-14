/**
 * Every tool component takes the page's query string. Tools that mirror their
 * state into the URL read their starting values from here rather than from
 * window.location, so the first client render matches the server output.
 */
export interface ToolComponentProps {
  searchParams: Record<string, string>;
}
