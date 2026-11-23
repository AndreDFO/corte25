import MyVideos from "./my-videos";

export const metadata = { title: "Meus vídeos · Corte25", robots: { index: false, follow: false } };

export default function Page() {
  return <MyVideos />;
}
