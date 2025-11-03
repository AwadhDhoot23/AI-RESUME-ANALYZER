// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { SnackbarProvider } from 'notistack'; // <-- NEW IMPORT

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* V-- ADD THIS WRAPPER --V */}
    <SnackbarProvider maxSnack={3} autoHideDuration={3000} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
      <App />
    </SnackbarProvider>
    {/* ^-- ADD THIS WRAPPER --^ */}
  </React.StrictMode>
);

reportWebVitals();