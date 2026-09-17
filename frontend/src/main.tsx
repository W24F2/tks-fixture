import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { MotionConfig } from 'framer-motion'

// ACCESSIBILITY: honour the OS "reduce motion" setting. With reducedMotion="user",
// Framer Motion automatically skips/shortens animations for users who request it,
// preventing vestibular discomfort from the entrance/page transitions.
createRoot(document.getElementById('root')!).render(
  <MotionConfig reducedMotion="user">
    <App />
  </MotionConfig>
)
