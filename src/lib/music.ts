// Playlist pronta (músicas originais do Corte25, livres para uso comercial; ver public/musicas/LICENCA.md).
export const TRACKS = [
  { slug: "animada-pop", title: "Animada Pop", mood: "animada" },
  { slug: "eletronica-house", title: "Eletrônica House", mood: "eletrônica" },
  { slug: "groove-funk", title: "Groove Funk", mood: "dançante" },
  { slug: "trap-moderno", title: "Trap Moderno", mood: "urbana" },
  { slug: "tropical-chill", title: "Tropical Chill", mood: "verão" },
  { slug: "acustica-alegre", title: "Acústica Alegre", mood: "alegre" },
  { slug: "inspiradora", title: "Inspiradora", mood: "motivacional" },
  { slug: "calma-lofi", title: "Calma Lo-fi", mood: "calma" },
] as const;

export type TrackSlug = (typeof TRACKS)[number]["slug"];
export const trackUrl = (slug: string) => `/musicas/${slug}.mp3`;
export const isTrack = (slug: string): slug is TrackSlug => TRACKS.some((t) => t.slug === slug);
