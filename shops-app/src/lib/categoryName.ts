/**
 * Short form of a category name for tight spots (icon labels, nav links).
 * Somali names run long -- "Korontada & Elektaroonik", "Raashinka &
 * Badeecadaha" -- so keep the first part before " & " and drop a bilingual
 * "(English)" suffix. The full name should still go in a title/aria-label.
 */
export function shortCategoryName(name: string): string {
    const base = name.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const first = base.split(/\s+&\s+|\s+and\s+|\s*\/\s*/i)[0]?.trim();
    return first || base || name;
}
