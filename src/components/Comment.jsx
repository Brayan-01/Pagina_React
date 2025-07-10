import React, { useEffect } from 'react'; // Importamos useEffect para los logs

const Comment = ({ comment, currentUser, onDelete, onEdit }) => {
    // Determinar si el usuario actual es el autor del comentario.
    // Asumimos que 'comment.autor_id' viene del backend y 'currentUser.id' es el ID del usuario logueado.
    const isOwner = currentUser && (currentUser.id === comment.autor_id);

    // --- DEBUGGING PARA BOTONES DE COMENTARIO (MÁS DETALLADO) ---
    useEffect(() => {
        console.groupCollapsed(`DEBUGGING Comment.jsx - Comment ID: ${comment.id}`); // Agrupamos los logs
        console.log("currentUser (desde props):", currentUser);
        console.log("comment.autor_id (ID del autor del comentario):", comment.autor_id, typeof comment.autor_id);
        console.log("currentUser.id (ID del usuario logueado):", currentUser ? currentUser.id : 'N/A', typeof (currentUser ? currentUser.id : 'N/A'));
        console.log("Resultado de la comparación (currentUser.id === comment.autor_id):", currentUser && (currentUser.id === comment.autor_id));
        console.log("isOwner (variable final):", isOwner);
        console.groupEnd();
    }, [currentUser, comment.autor_id, isOwner, comment.id]); // Añadimos comment.id a las dependencias
    // ----------------------------------------------------------------

    return (
        <div className="comment">
            <div className="comment-meta">
                <span className="comment-author">{comment.author}</span>
                {comment.created_at && ( // Muestra la fecha de creación si está disponible
                    <span className="comment-date">
                        el {new Date(comment.created_at).toLocaleDateString()}
                    </span>
                )}
                {isOwner && (
                    <div className="comment-controls">
                        <button onClick={() => onEdit(comment.id, prompt('Editar comentario:', comment.text))}>
                            ✏️ Editar
                        </button>
                        <button onClick={() => onDelete(comment.id)}>
                            🗑️ Borrar
                        </button>
                    </div>
                )}
            </div>
            <p className="comment-content">{comment.text}</p>
        </div>
    );
};

export default Comment;
