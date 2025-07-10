import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Player.css";

// PASO 1: Asegúrate de que esta ruta sea correcta para tu proyecto
// Este archivo define la URL de tu backend.

const Player = () => {
  useEffect(() => {
    document.title = 'Jugador | Gods of Eternia';
  }, []);

  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [profileData, setProfileData] = useState({
    username: "",
    email: "",
    description: "",
    puntajes: [],
  });
  const [editedData, setEditedData] = useState({
    username: "",
    description: "",
  });
  const [error, setError] = useState(null);

  const defaultAvatar = "https://cdn-icons-png.flaticon.com/512/4322/4322991.png";

  // Función única para obtener los datos del perfil
  const fetchProfileData = async () => {
    setLoading(true);
    setError(null);
    const userToken = localStorage.getItem("userToken");

    if (!userToken) {
      navigate("/login");
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/player`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${userToken}`,
        },
      });

      const data = await response.json();
      if (response.ok) {
        setProfileData({
          username: data.username,
          email: data.email,
          description: data.descripcion,
          puntajes: data.puntajes,
        });
        setEditedData({
          username: data.username,
          description: data.descripcion,
        });
        if (data.profileImage) {
          setProfileImage(data.profileImage);
        }
      } else {
        setError(data.error || "Error al cargar el perfil.");
        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem("userToken");
          navigate("/login");
        }
      }
    } catch (err) {
      console.error("Error al conectar con el servidor:", err);
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  // useEffect para llamar a la función al cargar el componente
  useEffect(() => {
    fetchProfileData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEdit = () => {
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setEditedData({
      username: profileData.username,
      description: profileData.description,
    });
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    const userToken = localStorage.getItem("userToken");

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/player`,{
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          descripcion: editedData.description,
          username: editedData.username,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        await fetchProfileData();
        setEditing(false);
      } else {
        setError(result.error || "Error al actualizar el perfil.");
      }
    } catch (err) {
      console.error("Error al guardar:", err);
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditedData((prevData) => ({ ...prevData, [name]: value }));
  };

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        setError("La imagen no puede ser mayor a 5MB");
        return;
      }
      if (!file.type.startsWith('image/')) {
        setError("Por favor selecciona un archivo de imagen válido");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setProfileImage(event.target.result);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetToDefaultImage = () => {
    setProfileImage(null);
  };

  if (loading) {
    return (
      <div className="profile-container">
        <div className="loading-screen">Cargando Perfil...</div>
      </div>
    );
  }

  if (error && !profileData.username) {
    return (
      <div className="profile-container">
        <div className="profile-box">
          <div className="error-message">Error: {error}</div>
          <button className="save-button" onClick={fetchProfileData}>
            🔄 Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-box">
        <h2>Perfil del Héroe</h2>

        {error && <div className="error-message">{error}</div>}

        <div className="profile-image-container">
          <div className="profile-image">
            <img 
              src={profileImage || defaultAvatar} 
              alt="Perfil del jugador"
              onError={(e) => {
                e.target.src = defaultAvatar;
              }}
            />
          </div>
          <div className="image-controls">
            <label className="image-upload-button" htmlFor="profileImageInput" title="Cambiar imagen">
              📷
            </label>
            {profileImage && (
              <button 
                className="reset-image-button" 
                onClick={resetToDefaultImage}
                title="Usar imagen por defecto"
                type="button"
              >
                🔄
              </button>
            )}
          </div>
          <input
            id="profileImageInput"
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            style={{ display: "none" }}
          />
        </div>

        {editing ? (
          <div className="profile-edit">
            <div className="input-group">
              <label htmlFor="usernameEdit">Nombre de héroe:</label>
              <input
                id="usernameEdit"
                type="text"
                name="username"
                value={editedData.username}
                onChange={handleChange}
                maxLength={20}
              />
            </div>
            <div className="input-group">
              <label htmlFor="descriptionEdit">Descripción:</label>
              <textarea
                id="descriptionEdit"
                name="description"
                value={editedData.description}
                onChange={handleChange}
                maxLength={200}
                rows={4}
                placeholder="Describe tu historia como héroe..."
              />
              <div className="char-counter">
                {editedData.description.length}/200
              </div>
            </div>
            <div className="button-group">
              <button className="save-button" onClick={handleSave} disabled={loading}>
                💾 Guardar
              </button>
              <button className="cancel-button" onClick={handleCancel} disabled={loading}>
                ❌ Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="profile-info">
            <div className="username-section">
              <h3>{profileData.username || "Héroe Anónimo"}</h3>
              <button className="edit-button" onClick={handleEdit} title="Editar perfil">
                ✏️
              </button>
            </div>
            <div className="description">
              <p>{profileData.description || "Un valiente héroe cuya historia está por escribirse..."}</p>
            </div>
            {profileData.email && (
              <div className="email-info">📧 Correo: {profileData.email}</div>
            )}
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
            {profileData.puntajes && profileData.puntajes.length > 0 && (
              <div className="stat-section">
                <h4>🏆 Puntajes por Dificultad</h4>
                {profileData.puntajes.map((p, index) => (
                  <div className="stat" key={index}>
                    <span className="stat-label">Dificultad {p.dificultad}:</span>
                    <span className="stat-value">{p.puntaje}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Player;