import React, { useState, useEffect } from 'react';

const CreatePost = ({ onPostCreated, postToEdit, onPostUpdated, onCancelEdit, onCancelCreate }) => {
    // --- ESTADOS INTERNOS DEL FORMULARIO ---
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [imageFile, setImageFile] = useState(null); // Guarda el archivo de imagen para subirlo
    const [imagePreview, setImagePreview] = useState(''); // Guarda la URL de previsualización

    const isEditing = !!postToEdit; // Determina si estamos en modo "edición"

    // Efecto para rellenar el formulario si estamos en modo edición
    useEffect(() => {
        if (isEditing) {
            setTitle(postToEdit.title);
            setContent(postToEdit.content);
            setImagePreview(postToEdit.imageUrl);
            setImageFile(null); // Reseteamos el archivo
        } else {
            // Limpiar el formulario si no estamos editando
            setTitle('');
            setContent('');
            setImageFile(null);
            setImagePreview('');
        }
    }, [postToEdit, isEditing]);

    // Maneja la selección de un nuevo archivo de imagen
    const handleImageChange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
            setImageFile(file); // Guardamos el objeto del archivo para la subida
            setImagePreview(URL.createObjectURL(file)); // Creamos una URL local para la vista previa
        } else {
            setImageFile(null);
            setImagePreview('');
        }
    };

    // Maneja el envío del formulario
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!title || !content) {
            // Reemplazar alert con showNotification si está disponible en este componente
            // alert("El título y el contenido son obligatorios.");
            console.error("El título y el contenido son obligatorios.");
            return;
        }

        if (isEditing) {
            // En modo edición, pasa los datos actualizados al padre
            onPostUpdated(postToEdit.id, { title, content, imageFile });
        } else {
            // En modo creación, pasa los datos nuevos al padre
            onPostCreated({ title, content, imageFile });
        }
    };

    // Decide qué función de cancelación llamar
    const handleCancel = () => {
        if (isEditing) {
            onCancelEdit();
        } else {
            onCancelCreate();
        }
    };

    return (
        <div className="create-post-container">
            <h2>{isEditing ? 'Edita tu Crónica' : 'Forja una Nueva Leyenda'}</h2>
            
            <form onSubmit={handleSubmit}>
                <div className="input-group">
                    <label htmlFor="title">Título del Manuscrito:</label>
                    <input
                        id="title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="El título de tu épica..."
                        required
                    />
                </div>

                <div className="input-group">
                    <label htmlFor="content">Contenido de la Crónica:</label>
                    <textarea
                        id="content"
                        rows="8"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Narra tus hazañas aquí..."
                        required
                    />
                </div>

                <div className="input-group">
                    <label htmlFor="imageUpload" className="image-upload-label">
                        {imagePreview ? 'Cambiar Estandarte (Imagen)' : 'Seleccionar un Estandarte (Imagen)'}
                    </label>
                    <input
                        id="imageUpload"
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                    />
                    <p className="image-recommendation">
                        Para mejor calidad, se recomienda una imagen de al menos 800px de ancho.
                    </p>
                    {imagePreview && (
                        <img src={imagePreview} alt="Vista previa" className="image-preview" />
                    )}
                </div>

                <div className="button-group">
                    {(isEditing || onCancelCreate) && (
                        <button type="button" className="cancel-button" onClick={handleCancel}>
                            Cancelar
                        </button>
                    )}
                    <button type="submit" className="save-button">
                        {isEditing ? 'Guardar Cambios' : 'Publicar Crónica'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreatePost;
