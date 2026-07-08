import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/inter';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import './styles/theme.css';
import './styles/base.css';
import './styles/app.css';

import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Items from './pages/Items.jsx';
import StyleGuide from './pages/StyleGuide.jsx';
import NotFound from './pages/NotFound.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="items" element={<Items />} />
          <Route path="style-guide" element={<StyleGuide />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
