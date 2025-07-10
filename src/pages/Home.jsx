import React, { useState, useEffect } from 'react';
import { Link } from "react-router-dom";
import Header from "../components/Header";
import Leaderboard from "../pages/Leaderboard"; 
import Footer from "../components/Footer";

function Home() {
    const [playLink, setPlayLink] = useState("/register");

    useEffect(() => {
        document.title = 'Inicio | Gods Of Eternia';
        const userToken = localStorage.getItem("userToken");
        if (userToken) {
            setPlayLink("/player");
        }
    }, []);

    return (
        <div className="page-container">
            <Header />
            <main className="content">
                <section className="hero-section">
                    <div className="hero-content">
                        <h2>
                            Bienvenido a <span>Gods of Eternia</span>
                        </h2>
                        <p className="subtitle">
                            Sumérgete en un mundo épico de fantasía medieval donde los dioses caminan entre los mortales.
                        </p>
                        <div className="btn-container">
                            <Link to={playLink}>
                                <button className="play-button">Jugar Ahora</button>
                            </Link>
                            <Leaderboard />
                        </div>
                    </div>
                </section>
                <section className="feature-section">
                    <div className="feature-content">
                        <h2>Desde el Escritorio del Cronista</h2>
                        <p>
                            Explora las leyendas, hazañas y misterios de Eternia contados por sus propios héroes.
                        </p>
                        <Link to="/blog">
                            <button className="feature-button">Ir al Blog</button>
                        </Link>
                    </div>
                </section>
                
            </main>
            <Footer />
        </div>
    );
}

export default Home;