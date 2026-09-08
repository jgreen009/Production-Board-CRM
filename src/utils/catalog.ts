// Active items, plus a specific current value even if it's since been
// disabled in Settings — otherwise a <select> silently falls back to the
// first active option and corrupts an existing order's data the moment
// its field re-renders. Used anywhere a real catalog (garment types,
// brands, services) drives a form control.
export function selectableCatalogNames(catalog: { name: string; active: boolean }[], currentValue: string): string[] {
  const names = catalog.filter((c) => c.active).map((c) => c.name)
  return !currentValue || names.includes(currentValue) ? names : [currentValue, ...names]
}
