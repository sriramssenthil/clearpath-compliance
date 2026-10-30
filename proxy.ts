import { NextResponse, type NextRequest } from "next/server";

/**
 * Signed-out visitors to any app page get a real redirect to the landing page (instead of a 200 page
 * that redirects client-side). This only checks that a demo session cookie exists; who the user is
 * and what they may see is still decided on the server by lib/auth.ts and the service layer.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has("cp_demo_user")) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/submissions/:path*", "/queue/:path*", "/dashboard/:path*", "/rules/:path*"],
};
