import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from './App';
import { AccountProvider } from './account/AccountContext';
import './App.css';

// The admin dashboard is a separate lazy chunk — it never ships in the shopper's
// initial bundle, and it renders full-screen without the shopper chrome.
const AdminApp = lazy(() => import('./admin/AdminApp'));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<div className="admin-boot">Chargement…</div>}>
              <AdminApp />
            </Suspense>
          }
        />
        <Route
          path="/*"
          element={
            <AccountProvider>
              <App />
            </AccountProvider>
          }
        />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
