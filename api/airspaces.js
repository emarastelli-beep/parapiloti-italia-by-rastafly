export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const apiKey = process.env.OPENAIP_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENAIP_API_KEY non configurata su Vercel" });
  const bbox = String(req.query?.bbox || "");
  const values = bbox.split(",").map(Number);
  if (values.length !== 4 || values.some(v => !Number.isFinite(v)) ||
      values[0] < -180 || values[0] > 180 || values[2] < -180 || values[2] > 180 ||
      values[1] < -90 || values[1] > 90 || values[3] < -90 || values[3] > 90 ||
      values[0] >= values[2] || values[1] >= values[3]) {
    return res.status(400).json({ error: "Bounding box non valida" });
  }
  try {
    const url = new URL("https://api.core.openaip.net/api/airspaces");
    url.searchParams.set("bbox", bbox);
    url.searchParams.set("page", "1");
    url.searchParams.set("limit", "500");
    const upstream = await fetch(url, {
      headers: { "x-openaip-api-key": apiKey, "Accept": "application/json" }
    });
    const body = await upstream.text();
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    return res.status(upstream.status).send(body);
  } catch (error) {
    console.error("OpenAIP proxy error:", error);
    return res.status(502).json({ error: "Errore di collegamento al servizio OpenAIP" });
  }
}
