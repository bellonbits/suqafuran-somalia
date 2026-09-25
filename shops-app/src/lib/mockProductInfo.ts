// Deterministic mock product attributes helper (discount, hasPromo, etc.)
// There's no real discount/sale-price field on Listing yet -- this derives a
// stable fake one from the listing's id so the same product always shows the
// same "deal" instead of flickering between renders.
export function getMockProductInfo(product: any) {
  const idNum = typeof product.id === 'number' ? product.id : (parseInt(String(product.id).slice(0, 4), 16) || 123);
  const discountPercent = 10 + (idNum % 4) * 5; // 10%, 15%, 20%, 25%
  const hasPromo = (idNum % 3) !== 0; // 66% of items have promo
  const originalPrice = hasPromo ? Math.round((product?.price ?? 0) * (1 + discountPercent / 100)) : product.price;
  const promoText = hasPromo ? `-${discountPercent}%` : null;
  return { hasPromo, discountPercent, originalPrice, promoText };
}
