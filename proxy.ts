import { NextResponse, type NextRequest } from "next/server";

/**
 * Signed-out visitors to any app page get a real redirect to the sign-in page (instead of a 200 page
 * that redirects later), with `next` set so they come back after signing in. This only checks that a
 * session cookie exists; whether it is valid, who the user is and what they may see is decided on the
 * server by lib/auth.ts and the service layer. The legacy `cp_demo_user` cookie is listed so development
 * tooling keeps working; lib/auth.ts ignores it in production.
 */
export function proxy(request: NextRequest) {
  const { cookies, nextUrl } = request;
  if (!cookies.has("cp_session") && !cookies.has("cp_demo_user")) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", nextUrl.pathname + nextUrl.search);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/submissions/:path*", "/queue/:path*", "/dashboard/:path*", "/rules/:path*", "/team/:path*"],
};
