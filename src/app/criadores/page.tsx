import Criadores from "./criadores";

const DESCRICAO =
  "Cole o link do produto e receba com IA o plano de gravação completo para o TikTok Shop: roteiro de ganchos, corpos e CTAs, público, objeções, legenda, hashtags e teleprompter.";

export const metadata = {
  title: "Criadores · plano de gravação com IA para o TikTok Shop · Corte25",
  description: DESCRICAO,
  alternates: { canonical: "/criadores" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/criadores",
    siteName: "Corte25",
    title: "Plano de gravação com IA para o TikTok Shop · Corte25",
    description: DESCRICAO,
  },
};

export default function Page() {
  return <Criadores />;
}
