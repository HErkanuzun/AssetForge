// SPDX-License-Identifier: AGPL-3.0-only
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@xyflow/react/dist/style.css'
import './styles.css'
import './assistant.css'
import './animsys.css'
import App from './App'
import { StoreProvider } from './store'
import { installWebBridge } from './webBridge'

// Tarayıcıdan açıldıysa (web sunucusu) masaüstü köprüsünün yerine HTTP köprüsü
installWebBridge()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>
)
