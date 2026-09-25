# Suqafuran Shops App - Setup Guide

## Project Structure

```
shops-app/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── Header.tsx
│   │   ├── ShopCard.tsx
│   │   ├── ProductCard.tsx
│   │   ├── Cart.tsx
│   │   └── ...
│   ├── pages/              # Route pages
│   │   ├── Home.tsx
│   │   ├── Shops.tsx
│   │   ├── ShopDetail.tsx
│   │   ├── Product.tsx
│   │   ├── Cart.tsx
│   │   ├── Checkout.tsx
│   │   ├── Orders.tsx
│   │   └── ...
│   ├── hooks/              # Custom React hooks
│   │   ├── useCart.ts
│   │   ├── useLocation.ts
│   │   ├── useAuth.ts
│   │   └── ...
│   ├── services/           # API services
│   │   ├── api.ts
│   │   ├── listings.ts
│   │   └── ...
│   ├── store/              # Zustand state management
│   │   ├── cartStore.ts
│   │   ├── authStore.ts
│   │   ├── locationStore.ts
│   │   └── ...
│   ├── types/              # TypeScript types
│   │   ├── index.ts
│   │   ├── shop.ts
│   │   ├── product.ts
│   │   └── ...
│   ├── styles/             # Tailwind CSS
│   │   └── index.css
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── package.json
├── tsconfig.json
└── index.html
```

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview build
npm run preview
```

## Key Features

- ✅ Browse shops & products
- ✅ Shop filtering & search
- ✅ Product details
- ✅ Shopping cart
- ✅ Checkout flow
- ✅ Order history
- ✅ User authentication
- ✅ Location-based filtering
- ✅ Responsive mobile design

## Next Steps

1. Copy components from existing Next.js app
2. Create pages using React Router
3. Set up Zustand stores
4. Connect to backend API
5. Test on simulator
6. Build & sync to iOS
