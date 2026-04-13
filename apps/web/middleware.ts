import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CORS for ingest endpoint — SDKs send from any origin
  if (pathname.startsWith("/api/ingest")) {
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const response = NextResponse.next();
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return response;
  }

  // CSRF protection for state-mutating dashboard API requests
  if (
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/ingest") &&
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    request.method !== "OPTIONS"
  ) {
    const contentType = request.headers.get("content-type") ?? "";
    const isJsonRequest = contentType.includes("application/json");
    if (!isJsonRequest) {
      return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
