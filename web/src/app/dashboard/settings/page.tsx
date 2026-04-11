import ThemeSettingsPanel from '@/components/ThemeSettingsPanel';

export default function DashboardSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
          Preferencias
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Configure tema, padroes de mapa e estacoes favoritas salvas por usuario.
        </p>
      </div>

      <ThemeSettingsPanel />
    </div>
  );
}