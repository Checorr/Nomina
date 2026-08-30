import AppShell from "@/components/AppShell";
import { listarEmpleados, listarPeriodos, calcularNomina } from "@/lib/queries";

// Los datos de nómina cambian con cada checada; nunca se sirven cacheados.
export const dynamic = "force-dynamic";

export default async function Page() {
  const [empleados, periodos] = await Promise.all([
    listarEmpleados(),
    listarPeriodos(),
  ]);

  // El periodo abierto es el que interesa al abrir la app; si no hay ninguno
  // abierto, se muestra el más reciente.
  const activo = periodos.find((p) => p.estado === "abierto") ?? periodos[0];
  const nomina = activo ? await calcularNomina(activo.id) : null;

  return (
    <AppShell
      empleadosIniciales={empleados}
      periodos={periodos}
      nominaInicial={nomina}
    />
  );
}
