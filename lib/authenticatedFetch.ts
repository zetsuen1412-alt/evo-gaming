import { supabase } from "@/lib/supabase";

export async function authenticatedFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session?.access_token) {
    throw new Error("Please login again before continuing.");
  }

  const response = await fetch(input, {
    ...init,
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response
      .clone()
      .json()
      .catch(() => ({}))) as { error?: string };
    throw new Error(
      payload.error || `Request failed with status ${response.status}.`
    );
  }

  return response;
}

export async function authenticatedFetchJson<T>(
  input: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await authenticatedFetch(input, init);
  return (await response.json()) as T;
}
