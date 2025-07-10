import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Player.css";
import knightAvatar from '../assets/knight.png';

const Player = () => {
    useEffect(() => {
        document.title = 'Jugador | Gods of Eternia';
    }, []);

    const { token, user, logout } = useAuth();
    const navigate = useNavigate();

    // --- ESTADOS DEL COMPONENTE ---
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [profileImage, setProfileImage] = useState(null);
    const [profileData, setProfileData] = useState({
        username: "",
        email: "",
        descripcion: "",
        puntajes: [],
    });
    const [editedData, setEditedData] = useState({
        username: "",
        descripcion: "",
    });
    const [error, setError] = useState(null);
    const [notification, setNotification] = useState({ message: '', type: '' });

    const defaultAvatar = knightAvatar;
    const API_URL = import.meta.env.VITE_API_URL;

    // --- LÓGICA DE LA APLICACIÓN (FUNCIONES) ---

    // Efecto para las notificaciones temporales
    useEffect(() => {
        if (notification.message && notification.type !== 'loading') {
            const timer = setTimeout(() => setNotification({ message: '', type: '' }), 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    // Función para obtener los datos del perfil desde el backend
    const fetchProfileData = useCallback(async () => {
        setLoading(true);
        setError(null);
        if (!token) {
            navigate("/login");
            return;
        }

        try {
            const response = await fetch(`${API_URL}/perfil`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
            });

            const data = await response.json();
            if (response.ok) {
                setProfileData({
                    username: data.username || "",
                    email: data.email || "",
                    descripcion: data.descripcion || "Un valiente héroe cuya historia está por escribirse...",
                    puntajes: data.puntajes || [],
                });
                setEditedData({
                    username: data.username || "",
                    descripcion: data.descripcion || "",
                });
                setProfileImage(data.foto_perfil || defaultAvatar);
            } else {
                setError(data.error || "Error al cargar el perfil.");
                if (response.status === 401 || response.status === 403) {
                    logout();
                }
            }
        } catch (err) {
            setError("No se pudo conectar con el servidor.");
        } finally {
            setLoading(false);
        }
    }, [token, navigate, logout, API_URL]);

    // Llama a fetchProfileData cuando el componente se monta
    useEffect(() => {
        fetchProfileData();
    }, [fetchProfileData]);

    const handleImageUpload = async (file) => {
        if (!file || !token) return;
        setNotification({ message: 'Subiendo imagen...', type: 'loading' });
        const formData = new FormData();
        formData.append('profile_picture', file);

        try {
            const response = await fetch(`${API_URL}/perfil/foto`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });
            const result = await response.json();
            if (response.ok) {
                setProfileImage(result.foto_perfil_url);
                setNotification({ message: result.message || '¡Imagen actualizada!', type: 'success' });
            } else {
                setNotification({ message: result.error || 'Error al subir la imagen.', type: 'error' });
                fetchProfileData();
            }
        } catch (err) {
            setNotification({ message: 'Error de conexión.', type: 'error' });
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            setNotification({ message: "La imagen no puede ser mayor a 5MB", type: 'error' });
            return;
        }
        if (!file.type.startsWith('image/')) {
            setNotification({ message: "Por favor selecciona un archivo de imagen válido.", type: 'error' });
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => setProfileImage(event.target.result);
        reader.readAsDataURL(file);
        handleImageUpload(file);
        setError(null);
    };

    const handleEdit = () => setEditing(true);

    const handleCancel = () => {
        setEditing(false);
        setEditedData({
            username: profileData.username,
            descripcion: profileData.descripcion,
        });
        setError(null);
    };

    const handleSave = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_URL}/perfil`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({
                    username: editedData.username,
                    descripcion: editedData.descripcion,
                }),
            });
            const result = await response.json();
            if (response.ok) {
                await fetchProfileData();
                setEditing(false);
                setNotification({ message: 'Perfil actualizado correctamente.', type: 'success' });
            } else {
                setError(result.error || "Error al actualizar el perfil.");
            }
        } catch (err) {
            setError("No se pudo conectar con el servidor.");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setEditedData((prevData) => ({ ...prevData, [name]: value }));
    };

    // --- RENDERIZADO DEL COMPONENTE ---
    if (loading && !profileData.username) {
        return <div className="loading-screen">Cargando Perfil...</div>;
    }

    return (
        <>
            <div className={`notification ${notification.type} ${notification.message ? 'show' : ''}`}>
                {notification.message}
            </div>
            <div className="profile-container">
                {error && !profileData.username ? (
                    <div className="profile-box">
                        <div className="error-message">Error: {error}</div>
                        <button className="save-button" onClick={fetchProfileData}>
                            🔄 Reintentar
                        </button>
                    </div>
                ) : (
                    <div className="profile-box">
                        <h2>Perfil del Héroe</h2>
                        {error && <div className="error-message">{error}</div>}

                        {/* Contenedor principal para el layout de dos columnas */}
                        <div className="profile-main-content">
                            
                            {/* --- Columna Izquierda: Imagen --- */}
                            <div className="profile-image-container">
                                <img
                                    src={profileImage || defaultAvatar}
                                    alt="Perfil del jugador"
                                    className="profile-image"
                                    onError={(e) => { e.target.src = defaultAvatar; }}
                                />
                                <label className="image-upload-button" htmlFor="profileImageInput" title="Cambiar imagen">
                                    📷
                                </label>
                                <input
                                    id="profileImageInput"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    style={{ display: "none" }}
                                />
                            </div>

                            {/* --- Columna Derecha: Detalles --- */}
                            <div className="profile-details">
                                {editing ? (
                                    // --- Vista de Edición ---
                                    <div className="profile-edit">
                                        <div className="input-group">
                                            <label htmlFor="usernameEdit">Nombre de héroe:</label>
                                            <input
                                                id="usernameEdit" type="text" name="username"
                                                value={editedData.username} onChange={handleChange} maxLength={20}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label htmlFor="descriptionEdit">Descripción:</label>
                                            <textarea
                                                id="descriptionEdit" name="descripcion"
                                                value={editedData.descripcion} onChange={handleChange}
                                                maxLength={200} rows={4}
                                                placeholder="Describe tu historia como héroe..."
                                            />
                                            <div className="char-counter">{editedData.descripcion?.length || 0}/200</div>
                                        </div>
                                        <div className="button-group">
                                            <button className="save-button" onClick={handleSave} disabled={loading}>
                                                {loading ? 'Guardando...' : '💾 Guardar'}
                                            </button>
                                            <button className="cancel-button" onClick={handleCancel} disabled={loading}>
                                                ❌ Cancelar
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    // --- Vista de Información ---
                                    <div className="profile-info">
                                        <div className="username-section">
                                            <h3>{profileData.username || (user && user.username) || "Héroe Anónimo"}</h3>
                                            <button className="edit-button" onClick={handleEdit} title="Editar perfil">✏️</button>
                                        </div>
                                        <div className="description">
                                            <p>{profileData.descripcion}</p>
                                        </div>
                                        {profileData.email && <div className="email-info">📧 {profileData.email}</div>}
                                        <div className="stats">
                                            <div className="stat">
                                                <span className="stat-label">Nivel</span>
                                                <span className="stat-value">5</span>
                                            </div>
                                            <div className="stat">
                                                <span className="stat-label">Victorias</span>
                                                <span className="stat-value">12</span>
                                            </div>
                                            <div className="stat">
                                                <span className="stat-label">Insignias</span>
                                                <span className="stat-value">Dragones del Alba</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default Player;