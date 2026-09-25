import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import Providers from './Providers.tsx'
import { CacheBuster } from './components/shared/CacheBuster.tsx'
import './index.css'
import { startAutoTranslate } from './lib/autoTranslate'

// Somali-first interface: swaps English UI text for Somali as it renders
// (and back when the user picks EN). See src/lib/autoTranslate.ts.
startAutoTranslate()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Providers>
        <CacheBuster />
        <App />
      </Providers>
    </BrowserRouter>
  </React.StrictMode>,
)
