import './assets/main.css'
// import './assets/output.css'
import GridBackground from './components/grid-background'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GridBackground />
    <div className="h-screen w-full z-20">
      <App />
    </div>
  </StrictMode>
)
