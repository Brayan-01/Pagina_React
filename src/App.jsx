import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute'; // Asegúrate de crear este archivo

// Importa tus páginas
import Header from './components/Header';
import Home from './pages/Home';
import Login from './pages/loginpage';
import Register from './pages/Register';
import Verification from './pages/Verification'; // Página de verificación
import Player from './pages/Player'; 
import BlogPage from './pages/Blog/BlogPage'; // Página del blog
import About from './pages/About';

const App = () => {
  return (
      <AuthProvider>
        <Header /> {/* El Header necesita estar dentro del Provider para saber si el usuario está logueado */}
        <Routes>
          {/* --- Rutas Públicas --- */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verificar" element={<Verification />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/about" element={<About />} />

          {/* --- Rutas Protegidas --- */}
          <Route element={<ProtectedRoute />}>
            <Route path="/player" element={<Player />} />
            {/* Aquí irían otras rutas protegidas como /dashboard, /jugar, etc. */}
          </Route>
        </Routes>
      </AuthProvider>
  );
};

export default App;