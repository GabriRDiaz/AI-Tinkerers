export function expectedOrigin(request: Request, url: URL) {
  const origin = new URL(url);
  origin.host = request.headers.get("host") || url.host;
  return origin;
}

export function isLoopbackHost(hostname: string) {
  return ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
}

export function loopbackDenied() {
  return Response.json(
    { error: "This demo accepts loopback hosts only." },
    { status: 403 },
  );
}
