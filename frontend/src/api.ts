export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch('/api/v1' + path, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  const data = await response.json()
  if (!response.ok) {
    const detail = data.detail
    throw new APIError(
      Array.isArray(detail)
        ? detail.map((e: { msg: string }) => e.msg).join('; ')
        : detail || 'Request failed',
      response.status,
    )
  }
  return data as T
}
export const post = <T>(path: string, payload: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(payload) })
