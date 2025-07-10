import React, { useState, useEffect, useCallback } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from "framer-motion";
import Comment from './Comment';
import { useAuth } from '../context/AuthContext'; // Asegúrate de que la ruta sea correcta


// Agregamos 'token' a las props que recibe BlogPost
const BlogPost = ({ post, currentUser, token, onDeletePost, onEditClick, showNotification }) => {
    const [comments, setComments] = useState([]); // Inicializamos los comentarios como un array vacío
    const [newComment, setNewComment] = useState('');

    // Obtener la URL base de la API
    const API_URL = import.meta.env.VITE_API_URL;

    // Determinar si el usuario actual es el autor de la publicación
    // Asegúrate de que currentUser.id y post.autor_id son del mismo tipo para la comparación (ej. ambos números)
    const isPostOwner = currentUser && (currentUser.id === post.autor_id);

    // --- DEBUGGING PARA BOTONES DE PUBLICACIÓN (MÁS DETALLADO) ---
    useEffect(() => {
        console.groupCollapsed(`DEBUGGING BlogPost.jsx - Post ID: ${post.id}`); // Agrupamos los logs
        console.log("currentUser (desde props):", currentUser);
        console.log("token (desde props):", token ? "Token presente" : "Token ausente");
        console.log("post.autor_id (ID del autor del post):", post.autor_id, typeof post.autor_id);
        console.log("currentUser.id (ID del usuario logueado):", currentUser ? currentUser.id : 'N/A', typeof (currentUser ? currentUser.id : 'N/A'));
        console.log("Resultado de la comparación (currentUser.id === post.autor_id):", currentUser && (currentUser.id === post.autor_id));
        console.log("isPostOwner (variable final):", isPostOwner);
        console.groupEnd();
    }, [currentUser, post.autor_id, isPostOwner, token, post.id]); // Añadimos post.id y token a las dependencias
    // ------------------------------------------------------------------

    // Función para obtener comentarios de la API
    const fetchComments = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/publicaciones/${post.id}/comentarios`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'No se pudieron obtener los comentarios.');
            }
            const data = await response.json();
            setComments(data);
        } catch (error) {
            console.error("Error fetching comments:", error);
            showNotification(`Error al cargar comentarios: ${error.message}`, 'error');
            setComments([]); // Asegurarse de que los comentarios estén vacíos en caso de error
        }
    }, [API_URL, post.id, showNotification]);

    // Efecto para cargar los comentarios cuando el componente se monta o el post.id cambia
    useEffect(() => {
        fetchComments();
    }, [fetchComments]);

    // Manejador para añadir un comentario
    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) {
            showNotification("El comentario no puede estar vacío.", 'error');
            return;
        }
        if (!currentUser || !token) { 
            showNotification("Debes iniciar sesión para publicar un comentario.", 'error');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/comentar-publicacion`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ publicacion_id: post.id, comentario: newComment })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al añadir el comentario.');
            }

            const responseData = await response.json();
            showNotification(responseData.message || "Comentario añadido exitosamente.", 'success');
            setNewComment(''); // Limpiar el campo de texto
            fetchComments(); // Volver a cargar los comentarios para ver el nuevo
        } catch (error) {
            console.error("Error adding comment:", error);
            showNotification(`Error al añadir comentario: ${error.message}`, 'error');
        }
    };

    // Manejador para eliminar un comentario
    const handleDeleteComment = async (commentId) => {
        if (!currentUser || !token) {
            showNotification("Debes iniciar sesión para eliminar un comentario.", 'error');
            return;
        }
        if (window.confirm('¿Estás seguro de que quieres eliminar este comentario?')) {
            try {
                const response = await fetch(`${API_URL}/eliminar-comentario/${commentId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Error al eliminar el comentario.');
                }

                const responseData = await response.json();
                showNotification(responseData.message || "Comentario eliminado exitosamente.", 'success');
                fetchComments(); // Volver a cargar los comentarios
            } catch (error) {
                console.error("Error deleting comment:", error);
                showNotification(`Error al eliminar comentario: ${error.message}`, 'error');
            }
        }
    };

    // Manejador para editar un comentario
    const handleEditComment = async (commentId, newText) => {
        if (!newText.trim()) {
            showNotification("El comentario no puede estar vacío.", 'error');
            return;
        }
        if (!currentUser || !token) {
            showNotification("Debes iniciar sesión para editar un comentario.", 'error');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/editar-comentario/${commentId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ comentario: newText })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al editar el comentario.');
            }

            const responseData = await response.json();
            showNotification(responseData.message || "Comentario editado exitosamente.", 'success');
            fetchComments(); // Volver a cargar los comentarios
        } catch (error) {
            console.error("Error editing comment:", error);
            showNotification(`Error al editar comentario: ${error.message}`, 'error');
        }
    };

    return (
        <article className="blog-post">
            {post.imageUrl && <img src={post.imageUrl} alt={post.title} className="post-image" />}
            {post.imagenes_adicionales_urls && post.imagenes_adicionales_urls.length > 0 && (
                <div className="additional-images">
                    {post.imagenes_adicionales_urls.map((imgUrl, index) => (
                        <img key={index} src={imgUrl} alt={`Imagen adicional ${index + 1}`} className="additional-post-image" />
                    ))}
                </div>
            )}
            <h2>{post.title}</h2>
            <div className="post-meta">
                Escrito por: {post.author}
                {post.created_at && ` el ${new Date(post.created_at).toLocaleDateString()}`}
            </div>
            <p className="post-content">{post.content}</p>

            <div className="post-controls">
                {isPostOwner && (
                    <div className="control-buttons">
                        <button className="control-button" onClick={() => onEditClick(post.id)}>✏️ Editar</button>
                        <button className="control-button delete" onClick={() => onDeletePost(post.id)}>🗑️ Borrar</button>
                    </div>
                )}
            </div>

            <div className="comments-section">
                <h3>Comentarios de los Bardos ({comments.length})</h3>
                {comments.length > 0 ? (
                    comments.map((comment) => (
                        <Comment
                            key={comment.id}
                            comment={comment}
                            currentUser={currentUser} // Pasamos el objeto currentUser completo
                            onDelete={handleDeleteComment}
                            onEdit={handleEditComment}
                        />
                    ))
                ) : (
                    <p>Sé el primero en dejar un comentario en esta crónica.</p>
                )}
                {currentUser && ( // Solo muestra el formulario si hay un usuario logueado
                    <form className="add-comment-form" onSubmit={handleAddComment}>
                        <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Añade tu verso a esta crónica..."
                            rows="2"
                        ></textarea>
                        <button type="submit">Enviar</button>
                    </form>
                )}
            </div>
        </article>
    );
};

export default BlogPost;
