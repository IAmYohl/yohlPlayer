import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LibraryProvider } from './player/libraryContext.tsx'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LibraryProvider>
      <App />
    </LibraryProvider>
  </StrictMode>,
)