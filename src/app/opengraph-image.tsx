import { ImageResponse } from "next/og";

// Imagem que aparece quando o link do site é colado no WhatsApp, Instagram, Facebook etc.
export const alt = "Corte25: 25 vídeos + 2 grátis para o TikTok Shop";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#f7f7f2",
          color: "#14141a",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 64, fontWeight: 900 }}>
          Corte<span style={{ color: "#8b7bff" }}>25</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 30, fontSize: 54, fontWeight: 900, lineHeight: 1.1 }}>
          <span>Grave 3 ganchos, 3 corpos e 3 CTAs.</span>
          <span style={{ display: "flex", marginTop: 10 }}>
            Receba
            <span style={{ background: "#c8f135", padding: "0 18px", margin: "0 16px", borderRadius: 16 }}>25 vídeos</span>
            + 2 grátis
          </span>
        </div>
        <div style={{ display: "flex", marginTop: 40, fontSize: 34, color: "#55556a" }}>
          Para vendedores do TikTok Shop · Teste grátis · corte25.com.br
        </div>
      </div>
    ),
    size,
  );
}
