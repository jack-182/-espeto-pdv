export function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'R$ 0,00';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDateTime(isoString: string | undefined): string {
  if (!isoString) return '--:--';
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return isoString;
  }
}

export function formatTimeOnly(isoString: string | undefined): string {
  if (!isoString) return '--:--';
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  } catch {
    return isoString;
  }
}

export function getCategoryBadge(categoria: string): { label: string; bg: string; text: string } {
  switch (categoria) {
    case 'ESPETOS':
      return { label: 'Espetos', bg: 'bg-amber-100 text-amber-900 border-amber-300', text: 'text-amber-800' };
    case 'BEBIDAS_ALCOOLICAS':
      return { label: 'Bebidas Alcoólicas', bg: 'bg-rose-100 text-rose-900 border-rose-300', text: 'text-rose-800' };
    case 'BEBIDAS_NAO_ALCOOLICAS':
      return { label: 'Bebidas', bg: 'bg-cyan-100 text-cyan-900 border-cyan-300', text: 'text-cyan-800' };
    case 'PORCOES':
      return { label: 'Porções & Cozinha', bg: 'bg-orange-100 text-orange-900 border-orange-300', text: 'text-orange-800' };
    case 'ESSENCIAS_NARGHILE':
      return { label: 'Essências', bg: 'bg-purple-100 text-purple-900 border-purple-300', text: 'text-purple-800' };
    case 'CARVAO_ALUMINIO':
      return { label: 'Carvão & Acessórios', bg: 'bg-stone-100 text-stone-900 border-stone-300', text: 'text-stone-800' };
    case 'PODS_VAPES':
      return { label: 'Pods & Vapes', bg: 'bg-emerald-100 text-emerald-900 border-emerald-300', text: 'text-emerald-800' };
    case 'CIGARROS_FUMOS':
      return { label: 'Tabacaria Geral', bg: 'bg-yellow-100 text-yellow-900 border-yellow-300', text: 'text-yellow-800' };
    case 'COMBOS':
      return { label: 'Combos Especiais', bg: 'bg-indigo-100 text-indigo-900 border-indigo-300', text: 'text-indigo-800' };
    default:
      return { label: categoria, bg: 'bg-slate-100 text-slate-800 border-slate-300', text: 'text-slate-700' };
  }
}
