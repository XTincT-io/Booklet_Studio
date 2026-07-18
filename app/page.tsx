export default function Home() {
  return (
    <main style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Booklet Studio API</h1>
      <p>
        This app hosts the API routes under <code>/api</code> that back the Booklet Studio front end.
        Wire the front-end prototype (<code>booklet-studio.jsx</code>) up to these routes to replace its
        local storage calls with real network requests once the front end is ported into this project
        under <code>app/(dashboard)</code> / <code>app/(editor)</code>.
      </p>
    </main>
  );
}
