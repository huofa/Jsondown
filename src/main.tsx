import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'
import './styles/app.css'
import './styles/layout.css'
import './styles/top-toolbar.css'
import './styles/milkdown-overrides.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
