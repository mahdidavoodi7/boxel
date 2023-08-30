export function createResponse(
  unresolvedRealmURL: string,
  body?: BodyInit | null | undefined,
  init?: ResponseInit | undefined,
): Response {
  return new Response(body, {
    ...init,
    headers: {
      ...init?.headers,
      'X-boxel-realm-url': unresolvedRealmURL,
      vary: 'Accept',
    },
  });
}
