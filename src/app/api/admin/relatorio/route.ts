import { connection } from "next/server";
import { isOwnerAdmin } from "@/lib/admin";
import { buildReport, reportCsv } from "@/lib/report";

// Relatório de vendas: ?de=AAAA-MM-DD&ate=AAAA-MM-DD&formato=json|csv. Só o administrador.
export async function GET(req: Request) {
  await connection();
  if (!(await isOwnerAdmin())) return Response.json({ error: "Acesso negado." }, { status: 403 });
  const q = new URL(req.url).searchParams;
  const r = await buildReport(q.get("de") || "", q.get("ate") || "");
  if (q.get("formato") === "csv")
    return new Response(reportCsv(r), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="relatorio-corte25_${r.de}_a_${r.ate}.csv"`,
      },
    });
  return Response.json(r);
}
