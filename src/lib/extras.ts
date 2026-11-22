// Melhorias em teste (22/11): ficam DESLIGADAS para os clientes e só aparecem para o administrador
// (isAdmin: e-mail em ADMIN_EMAILS ou senha ADMIN_KEY). Para liberar para todos depois que o Andre
// aprovar, basta trocar quem pode mandar essas opções em /api/jobs.

// Site de teste separado (serviço próprio no Railway, sem Supabase nem Asaas): MELHORIAS_TESTE=true
// mostra as opções para qualquer pessoa NAQUELE servidor. No site dos clientes essa variável não existe.
export function testSiteEnabled() {
  return process.env.MELHORIAS_TESTE === "true";
}

export const NICHES = {
  beleza: { label: "Beleza e cuidados", tags: ["beleza", "skincare", "maquiagem"], angles: "rotina de autocuidado, textura e cheirinho, praticidade no dia a dia, dica de amiga, 'arrume-se comigo'" },
  casa: { label: "Casa e organização", tags: ["casa", "organizacao", "achadosdecasa"], angles: "antes da bagunça x organizado, praticidade, 'coisas que facilitam a casa', cantinho novo, limpeza rápida" },
  cozinha: { label: "Cozinha", tags: ["cozinha", "utensilios", "cozinhapratica"], angles: "receita rápida, economia de tempo, utensílio que eu não sabia que precisava, cozinha organizada" },
  moda: { label: "Moda e acessórios", tags: ["moda", "lookdodia", "estilo"], angles: "look do dia, provador, combinações, caimento e tecido, 'como usar de 3 jeitos'" },
  eletronicos: { label: "Eletrônicos e gadgets", tags: ["gadgets", "tecnologia", "eletronicos"], angles: "teste na prática, recurso escondido, 'vale a pena?', setup, comparação com o que eu usava" },
  pets: { label: "Pets", tags: ["pets", "cachorro", "gato"], angles: "reação do pet, rotina com o pet, praticidade para o tutor, brinquedo/acessório no uso real" },
  infantil: { label: "Infantil e bebê", tags: ["maternidade", "infantil", "bebe"], angles: "rotina de mãe/pai, praticidade, presente para criança, organização do quarto, momento em família" },
} as const;
export type Niche = keyof typeof NICHES;

export interface JobExtras {
  animatedCaptions?: boolean; // legendas da fala palavra por palavra + gancho entrando palavra por palavra
  richCopy?: boolean; // descrição mais completa e mais hashtags
  niche?: Niche; // ganchos e hashtags do nicho
}

export function parseExtras(raw: unknown): JobExtras | undefined {
  if (typeof raw !== "string" || !raw) return undefined;
  try {
    const j = JSON.parse(raw);
    const out: JobExtras = {};
    if (j.animatedCaptions === true) out.animatedCaptions = true;
    if (j.richCopy === true) out.richCopy = true;
    if (typeof j.niche === "string" && j.niche in NICHES) out.niche = j.niche as Niche;
    return Object.keys(out).length ? out : undefined;
  } catch {
    return undefined;
  }
}

export function describeExtras(x?: JobExtras): string[] {
  if (!x) return [];
  const l: string[] = [];
  if (x.animatedCaptions) l.push("Legendas animadas");
  if (x.richCopy) l.push("Descrição e hashtags turbinadas");
  if (x.niche) l.push(`Nicho: ${NICHES[x.niche].label}`);
  return l;
}
