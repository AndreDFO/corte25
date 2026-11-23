import { Suspense } from "react";
import JobView from "./job-view";

export const metadata = { title: "Seus vídeos · Corte25", robots: { index: false, follow: false } };

async function Loader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobView id={id} />;
}

export default function TarefaPage({ params }: PageProps<"/tarefa/[id]">) {
  return (
    <Suspense fallback={<p className="p-10 text-center text-foreground/60">Carregando…</p>}>
      <Loader params={params} />
    </Suspense>
  );
}
