export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("Request body exceeded the configured limit");
    this.name = "RequestBodyTooLargeError";
  }
}

export async function readBoundedJson(request: Request, maxBytes: number): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestBodyTooLargeError();
  }
  if (!request.body) return JSON.parse("");

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel("request-body-too-large");
      throw new RequestBodyTooLargeError();
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  text += decoder.decode();
  return JSON.parse(text);
}
