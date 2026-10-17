import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App.tsx'
import './index.css'
import { initialLocale, setAppLocale } from '@/lib/i18n'

// A saved Myanmar choice loads its strings first, so the page never flashes English.
void setAppLocale(initialLocale).finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
