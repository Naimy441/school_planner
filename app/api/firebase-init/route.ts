// Served at /__/firebase/init.json (see next.config.ts). Firebase's auth
// handler fetches it when it runs on our domain; without Firebase Hosting the
// upstream copy doesn't exist, so we provide the public web config ourselves.
export function GET(req: Request) {
  const host = req.headers.get("x-forwarded-host") || new URL(req.url).host;
  return Response.json(
    {
      apiKey: "AIzaSyCpkjfMZOvTxui8qtEtanJgaHCy0h-4EX4",
      appId: "1:207808771926:web:6dc5315c94894dbd9448f7",
      authDomain: host,
      messagingSenderId: "207808771926",
      projectId: "school-planner-8fd73",
      storageBucket: "school-planner-8fd73.firebasestorage.app",
    },
    { headers: { "cache-control": "public, max-age=3600" } },
  );
}
