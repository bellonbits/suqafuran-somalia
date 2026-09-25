// Brand suggestions keyed by category name (lowercased, trimmed) so lookups
// work against real DB categories instead of hardcoded ids that don't match
// across different parts of the app.
export const BRANDS_BY_CATEGORY_NAME: Record<string, string[]> = {
  'commercial equipment': ['Caterpillar', 'JCB', 'Komatsu', 'Volvo', 'Hyundai', 'Doosan'],
  'electronics': ['Apple', 'Samsung', 'LG', 'Sony', 'Dell', 'HP', 'Lenovo', 'ASUS', 'Canon', 'Nikon'],
  'land & farms': ['Farmland Pro', 'Agriculture Plus', 'Local Farms', 'Agro Solutions'],
  'repair & construction': ['Bosch', 'Makita', 'DeWalt', 'Stanley', 'Hilti', 'Metabo'],
  'leisure & sports': ['Nike', 'Adidas', 'Puma', 'Decathlon', 'Reebok', 'Asics'],
  'clothing & shoes': ['Zara', 'H&M', 'Forever 21', 'ASOS', 'Shein', 'Mango'],
  'household items': ['IKEA', 'Furniture Plus', 'Home Decor Ltd', 'Interiors Pro'],
  'vehicles': ['Toyota', 'Honda', 'Nissan', 'Mazda', 'Hyundai', 'Kia', 'Mitsubishi'],
  'livestock': ['Local Farms', 'Agro Exports', 'Livestock Plus', 'Pastoral'],
  'property': ['Real Estate Ltd', 'Property Plus', 'Land Development'],
  'services': ['Service Providers', 'Professional Services', 'Local Services'],
  'food & groceries': ['Nestlé', 'Cadbury', 'Coca-Cola', 'Pepsi', 'Kimbo', 'Ushindi'],
  'agriculture & food': ['Agronomics', 'Farm Produce', 'Food Exports', 'Agriculture Hub'],
  'beauty & personal care': ['Cerave', 'Neutrogena', 'Dove', 'Olay', 'Nivea', 'Vaseline'],
  'phones': ['Apple', 'Samsung', 'Tecno', 'Infinix', 'Itel', 'Xiaomi', 'Huawei'],
  'jobs': ['Job Portal', 'Employment Agency', 'Professional Services'],
  'babies & kids': ['Pampers', 'Huggies', 'Chicco', 'Mothercare', 'Baby Plus'],
};

// Fallback list shown when the selected category has no specific brand list.
export const COMMON_BRANDS = [
  'Apple', 'Samsung', 'LG', 'Sony', 'Dell', 'HP', 'Lenovo', 'ASUS', 'Canon', 'Nikon',
  'Nike', 'Adidas', 'Puma', 'Gucci', 'Louis Vuitton', 'Zara', 'H&M', 'Forever 21',
  'Cerave', 'Neutrogena', 'Olay', 'Dove', 'Lux', 'Dettol', 'Johnson & Johnson',
  'Unilever', 'Nestlé', 'Coca-Cola', 'Pepsi', 'Cadbury', 'Mars', 'Ferrero', 'Kraft',
  'Heinz', 'Danone', 'Kimberly-Clark', 'Procter & Gamble', 'Colgate', 'Oral-B',
  'Crest', 'Gillette', 'Schick', 'Philips', 'Panasonic', 'Toyota', 'Honda', 'Nissan',
];

export const getBrandsForCategory = (categoryName?: string | null): string[] => {
  const key = categoryName?.toLowerCase().trim();
  return (key && BRANDS_BY_CATEGORY_NAME[key]) || COMMON_BRANDS;
};
