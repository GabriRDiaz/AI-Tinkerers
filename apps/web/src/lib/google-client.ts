type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/** All page reads and tools share one cookie handshake, including React's development effect replay. */
export function createDocClient(fetcher: Fetcher) {
  let session: Promise<void> | undefined;
  const initialize = () =>
    (session ??= (async () => {
      const response = await fetcher("/api/docs?session=1", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Unable to start the approval session. Reload the page.");
      }
      await response.json();
    })().catch((error) => {
      session = undefined;
      throw error;
    }));
  return async function request<T>(path: string, body?: unknown): Promise<T> {
    await initialize();
    const response = await fetcher(
      `/api/docs${path}`,
      body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : { cache: "no-store" },
    );
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || `Request failed: HTTP ${response.status}`);
    }
    return result;
  };
}

export const requestDocs = createDocClient((url, init) => fetch(url, init));

export async function requestClassroom<T>(path: string): Promise<T> {
  const response = await fetch(`/api/classroom${path}`, { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || `Request failed: HTTP ${response.status}`);
  }
  return result;
}

export async function requestAuthSession() {
  const response = await fetch("/api/auth/session", { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || `Request failed: HTTP ${response.status}`);
  }
  return result as
    | { status: "unconfigured"; message: string }
    | { status: "signed_out"; message: string }
    | { status: "signed_in"; user: { email: string; name: string } };
}
