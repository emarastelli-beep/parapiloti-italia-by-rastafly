export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAIP_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OPENAIP_API_KEY non configurata nell'ambiente Preview di Vercel." });
  }

  const z = Number(req.query?.z);
  const x = Number(req.query?.x);
  const y = Number(req.query?.y);
  if (![z, x, y].every(Number.isInteger) || z < 0 || z > 18 || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) {
    return res.status(400).json({ error: "Coordinate tile non valide." });
  }

  try {
    const url = new URL(`https://a.api.tiles.openaip.net/api/data/openaip/${z}/${x}/${y}.png`);
    const upstream = await fetch(url, {
      headers: { "x-openaip-api-key": apiKey, "Accept": "image/png" }
    });
    if (!upstream.ok) {
      const details = await upstream.text();
      console.error("OpenAIP tile response:", upstream.status, details.slice(0, 500));
      return res.status(502).json({ error: "OpenAIP tile non disponibile.", upstreamStatus: upstream.status });
    }
    const image = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "image/png");
    res.setHeader("Content-Length", String(image.length));
    return res.status(200).send(image);
  } catch (error) {
    console.error("OpenAIP tile proxy error:", error);
    return res.status(502).json({ error: "Errore di collegamento al servizio OpenAIP." });
  }
}
