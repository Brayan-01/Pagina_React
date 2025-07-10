import React, { useState, useEffect, useCallback } from "react";
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from "framer-motion";
import BlogPost from '../../components/BlogPost';
import CreatePost from '../../components/CreatePost';
import { useAuth } from '../../context/AuthContext';
import './Blog.css'; // Asegúrate de que este archivo CSS contenga los estilos que hemos discutido

const BlogPage = () => {
    // --- ESTADOS ---
    const [posts, setPosts] = useState([]); // Inicia vacío, se cargará desde la API
    const [loading, setLoading] = useState(true);
    const { user, token } = useAuth(); // Obtener el 'user' y el 'token' directamente
    const [notification, setNotification] = useState({ message: '', type: '' });
    const [editingPostId, setEditingPostId] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const API_URL = import.meta.env.VITE_API_URL;

    // --- EFECTOS ---
    useEffect(() => {
        document.title = 'Crónicas de Eternia | Blog';
    }, []);

    // Efecto para manejar las notificaciones
    useEffect(() => {
        if (!notification.message) return;
        const timerId = setTimeout(() => {
            setNotification({ message: '', type: '' });
        }, 3000);
        return () => clearTimeout(timerId);
    }, [notification]);

    // --- LÓGICA DE DATOS (API) ---

    const showNotification = useCallback((message, type) => {
        setNotification({ message, type });
    }, []); // Dependencia vacía significa que la función solo se crea una vez

    // Función para obtener todos los posts
    const fetchPosts = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/publicaciones`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "No se pudieron cargar las crónicas.");
            }
            const data = await response.json();
            setPosts(data);
            console.log("DEBUG: Publicaciones cargadas:", data); // <--- NUEVO CONSOLE.LOG AQUÍ
        } catch (error) {
            showNotification(error.message, 'error');
            console.error("Error al cargar publicaciones:", error); // <--- NUEVO CONSOLE.LOG DE ERROR
        } finally {
            setLoading(false);
        }
    }, [API_URL, showNotification]); // showNotification ahora es una dependencia estable

    // Carga los posts iniciales al montar el componente
    useEffect(() => {
        fetchPosts();
    }, [fetchPosts]);

    // --- MANEJADORES DE EVENTOS ---

    // Manejador para la creación de posts (proceso de 2 pasos)
    const handlePostCreated = async ({ title, content, imageFile }) => {
        if (!token) {
            showNotification("Debes iniciar sesión para publicar.", "error");
            return;
        }

        showNotification("Forjando nueva crónica...", "loading");

        try {
            // PASO 1: Crear el post con título y texto
            const responseText = await fetch(`${API_URL}/crear-publicacion`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ titulo: title, texto: content })
            });

            const dataText = await responseText.json();
            if (!responseText.ok) throw new Error(dataText.error || "Error al crear la publicación.");

            const newPostId = dataText.publicacion_id;

            // PASO 2: Si hay un archivo de imagen, subirlo al post recién creado
            if (imageFile && newPostId) {
                const formData = new FormData();
                formData.append('imagen_publicacion', imageFile);

                const responseImg = await fetch(`${API_URL}/publicaciones/${newPostId}/upload_imagen`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });

                if (!responseImg.ok) {
                    const imgError = await responseImg.json();
                    throw new Error(imgError.error || "El texto se guardó, pero falló la subida de la imagen.");
                }
            }

            // Éxito: Cierra el modal, recarga los posts y muestra notificación de éxito
            setIsCreating(false);
            await fetchPosts();
            showNotification('¡Nueva crónica forjada con éxito!', 'success');

        } catch (error) {
            showNotification(error.message, 'error');
        }
    };
    
    // Lógica para actualizar (a implementar con la API si es necesario)
    const handlePostUpdated = async (postId, updatedData) => {
        if (!token) {
            showNotification("Debes iniciar sesión para editar.", "error");
            return;
        }
        showNotification("Actualizando crónica...", "loading");
        try {
            const response = await fetch(`${API_URL}/editar-publicacion/${postId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ titulo: updatedData.title, texto: updatedData.content })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Error al actualizar la publicación.");

            // Si hay una nueva imagen, subirla
            if (updatedData.imageFile) {
                const formData = new FormData();
                formData.append('imagen_publicacion', updatedData.imageFile);
                const responseImg = await fetch(`${API_URL}/publicaciones/${postId}/upload_imagen`, {
                    method: 'POST', // O PUT si tu backend lo soporta para reemplazar
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                if (!responseImg.ok) {
                    const imgError = await responseImg.json();
                    throw new Error(imgError.error || "El texto se actualizó, pero falló la subida de la nueva imagen.");
                }
            }

            setEditingPostId(null);
            await fetchPosts(); // Recargar posts
            showNotification('Crónica actualizada con éxito.', 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    // Lógica para eliminar un post
    const handleDeletePost = async (postId) => {
        if (!token) {
            showNotification("Debes iniciar sesión para esta acción.", "error");
            return;
        }
        if (window.confirm('¿Estás seguro de que quieres que esta crónica se pierda en el tiempo?')) {
            try {
                const response = await fetch(`${API_URL}/eliminar-publicacion/${postId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error);
                
                showNotification('La crónica ha sido borrada.', 'success');
                fetchPosts(); // Recargar la lista de posts
            } catch (error) {
                showNotification(error.message, 'error');
            }
        }
    };
    
    const handleEditClick = (postId) => {
        setIsCreating(false);
        setEditingPostId(postId);
    };

    const handleCancelEdit = () => {
        setEditingPostId(null);
    };

    // --- RENDERIZADO DEL COMPONENTE ---
    if (loading) {
        return <div className="loading-screen">Cargando crónicas de Eternia...</div>;
    }

    return (
        <>
            <div className={`notification ${notification.type} ${notification.message ? 'show' : ''}`}>
                {notification.message}
            </div>

            <div className="blog-container">
                <div className="blog-header">
                    <h1>Crónicas de Eternia</h1>
                    {user && !isCreating && !editingPostId && (
                        <button className="create-new-post-button" onClick={() => setIsCreating(true)}>
                            + Forjar Nueva Crónica
                        </button>
                    )}
                </div>

                {posts.length > 0 ? (
                    posts.map((post) => (
                        editingPostId === post.id ? (
                            <CreatePost 
                                key={`editing-${post.id}`}
                                postToEdit={post}
                                onPostUpdated={handlePostUpdated}
                                onCancelEdit={handleCancelEdit}
                                showNotification={showNotification} 
                            />
                        ) : (
                            <BlogPost
                                key={post.id}
                                post={post}
                                currentUser={user}
                                token={token}
                                onDeletePost={handleDeletePost}
                                onEditClick={handleEditClick}
                                showNotification={showNotification} 
                            />
                        )
                    ))
                ) : (
                    <p>Aún no se han escrito crónicas. ¡Sé el primero en forjar una leyenda!</p>
                )}
            </div>

            <AnimatePresence>
                {isCreating && (
                    <motion.div
                        className="create-post-modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsCreating(false)}
                    >
                        <motion.div
                            className="create-post-modal-content"
                            initial={{ y: -50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -50, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <CreatePost
                                onPostCreated={handlePostCreated}
                                onCancelCreate={() => setIsCreating(false)}
                                showNotification={showNotification} 
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default BlogPage;
