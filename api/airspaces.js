export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAIP_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OPENAIP_API_KEY non configurata nell'ambiente Preview di Vercel." });
  }

  const bbox = String(req.query?.bbox || "");
  const values = bbox.split(",").map(Number);
  if (
    values.length !== 4 ||
    values.some(v => !Number.isFinite(v)) ||
    values[0] < -180 || values[0] > 180 ||
    values[2] < -180 || values[2] > 180 ||
    values[1] < -90 || values[1] > 90 ||
    values[3] < -90 || values[3] > 90 ||
    values[0] >= values[2] || values[1] >= values[3]
  ) {
    return res.status(400).json({ error: "Bounding box non valida." });
  }

  try {
    const url = new URL("https://api.core.openaip.net/api/airspaces");
    url.searchParams.set("bbox", values.join(","));
    url.searchParams.set("page", "1");
    // Richieste più leggere e affidabili durante gli spostamenti della mappa.
    url.searchParams.set("limit", "100");

    // Use the documented apiKey query authentication for the Core API.
    // The key remains server-side and is never sent to the browser.
    url.searchParams.set("apiKey", apiKey);
    const upstream = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "PilotAdvisor/1.0"
      }
    });
    const body = await upstream.text();

    if (!upstream.ok) {
      console.error("OpenAIP response:", upstream.status, body.slice(0, 1000));
      return res.status(502).json({
        error: "OpenAIP non ha completato la richiesta.",
        upstreamStatus: upstream.status,
        details: upstream.status === 403 ? "OpenAIP ha rifiutato la richiesta (403). Verificare che la chiave API sia valida e autorizzata per Core API." : body.slice(0, 180)
      });
    }

    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    return res.status(200).send(body);
  } catch (error) {
    console.error("OpenAIP proxy error:", error);
    return res.status(502).json({ error: "Errore di collegamento al servizio OpenAIP." });
  }
}
