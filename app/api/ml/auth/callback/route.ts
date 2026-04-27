export async function GET(req: Request) {
  return Response.json({ ok: true, route: "ml-auth-callback" });
}
