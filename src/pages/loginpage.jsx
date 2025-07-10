import { useState, useEffect } from "react";
import { FaEye, FaEyeSlash, FaTimes } from "react-icons/fa";
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext"; // Asegúrate de que la ruta sea correcta
import "./loginpage.css";

const Login = () => {
    useEffect(() => {
        document.title = 'Login | Gods Of Eternia';
    }, []);

    // Estados del formulario de Login
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [isLoginLoading, setIsLoginLoading] = useState(false);

    // Estados del modal de recuperación
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [resetEmail, setResetEmail] = useState("");
    const [resetMessage, setResetMessage] = useState("");
    const [resetError, setResetError] = useState("");
    const [isResetLoading, setIsResetLoading] = useState(false);

    // Estados para el flujo de recuperación en dos pasos
    const [resetStep, setResetStep] = useState('enterEmail');
    const [resetCode, setResetCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const navigate = useNavigate();
    // Obtenemos isAuthenticated del contexto para observar su cambio
    const { login, isAuthenticated } = useAuth();

    const API_URL = import.meta.env.VITE_API_URL;

    // *** NUEVO useEffect para manejar la redirección después de la autenticación ***
    useEffect(() => {
        // Solo redirige si isAuthenticated es true y el login no está en proceso
        if (isAuthenticated && !isLoginLoading) {
            navigate("/player");
        }
    }, [isAuthenticated, isLoginLoading, navigate]); // Dependencias: isAuthenticated, isLoginLoading, navigate

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        setIsLoginLoading(true);

        if (!API_URL) {
            setError("Error de configuración: La URL de la API no está definida.");
            setIsLoginLoading(false);
            return;
        }

        try {
            const response = await fetch(`${API_URL}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok && data.access_token) {
                login(data.access_token); // Esto actualizará el token en AuthContext, lo que a su vez actualizará isAuthenticated
                // Eliminamos el navigate aquí, ya que el useEffect de arriba lo manejará
            } else {
                setError(data.error || "Error al iniciar sesión");
            }
        } catch (err) {
            console.error("Error al conectar con el servidor de login:", err);
            setError("No se pudo conectar con el servidor. Verifica que esté activo.");
        } finally {
            setIsLoginLoading(false);
        }
    };

    const handleApiCall = async (apiFunction, onSuccess, onError) => {
        setIsResetLoading(true);
        setResetError("");
        setResetMessage("");

        try {
            const data = await apiFunction();
            onSuccess(data);
        } catch (error) {
            console.error("Error en la llamada a la API:", error);
            const errorMessage = onError(error) || "No se pudo conectar con el servidor.";
            setResetError(errorMessage);
        } finally {
            setIsResetLoading(false);
        }
    };

    const resetModalStates = () => {
        setResetEmail("");
        setResetError("");
        setResetMessage("");
        setResetStep('enterEmail');
        setResetCode("");
        setNewPassword("");
        setConfirmPassword("");
        setShowNewPassword(false);
        setShowConfirmPassword(false);
    };

    const openForgotPasswordModal = () => {
        resetModalStates();
        setShowForgotPassword(true);
    };

    const closeForgotPasswordModal = () => {
        setShowForgotPassword(false);
    };

    const handleRequestCode = (e) => {
        e.preventDefault();
        const apiFunction = async () => {
            const response = await fetch(`${API_URL}/request-password-reset`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: resetEmail }),
            });
            const data = await response.json();
            if (!response.ok) throw data;
            return data;
        };

        const onSuccess = (data) => {
            setResetMessage(data.message || "Código enviado. Revisa tu correo.");
            setResetStep('enterCode');
        };

        const onError = (error) => error.error || "Error al enviar el correo.";

        handleApiCall(apiFunction, onSuccess, onError);
    };

    const handleResetWithCode = (e) => {
        e.preventDefault();
        setResetError("");

        if (newPassword !== confirmPassword) {
            setResetError("Las contraseñas no coinciden.");
            return;
        }
        if (resetCode.length !== 6) {
            setResetError("El código de verificación debe tener 6 dígitos.");
            return;
        }

        const apiFunction = async () => {
            const response = await fetch(`${API_URL}/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    reset_code: resetCode,
                    new_password: newPassword
                }),
            });
            const data = await response.json();
            if (!response.ok) throw data;
            return data;
        };

        const onSuccess = (data) => {
            setResetMessage(data.message || "¡Contraseña actualizada con éxito!");
            setTimeout(() => {
                closeForgotPasswordModal();
            }, 2000);
        };

        const onError = (error) => error.error || "Código incorrecto o expirado.";

        handleApiCall(apiFunction, onSuccess, onError);
    };

    return (
        <div className="login-container">
            <motion.div
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="login-box"
            >
                <h2>Iniciar Sesión</h2>
                {error && <p className="error-message">{error}</p>}
                <form onSubmit={handleLogin}>
                    <div className="password-container">
                        <input
                            type="email"
                            placeholder="Correo"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="password-input"
                            required
                        />
                        <span className="eye-button" style={{ visibility: 'hidden' }}>
                            <FaEye />
                        </span>
                    </div>
                    <div className="password-container">
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Contraseña"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="password-input"
                            required
                        />
                        <span className="eye-button" onClick={() => setShowPassword(!showPassword)}>
                            {showPassword ? <FaEyeSlash /> : <FaEye />}
                        </span>
                    </div>
                    <button type="submit" disabled={isLoginLoading}>
                        {isLoginLoading ? "Ingresando..." : "Iniciar Sesión"}
                    </button>
                </form>
                <div className="forgot-password" onClick={openForgotPasswordModal}>
                    ¿Olvidaste tu contraseña?
                </div>
            </motion.div>
            <AnimatePresence>
                {showForgotPassword && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="modal-overlay"
                        onClick={closeForgotPasswordModal}
                    >
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="modal-content"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <h3>Recuperar Contraseña</h3>
                                <FaTimes className="close-button" onClick={closeForgotPasswordModal} />
                            </div>
                            <div className="modal-body">
                                {resetMessage && <p className="success-message">{resetMessage}</p>}
                                {resetError && <p className="error-message">{resetError}</p>}

                                {resetStep === 'enterEmail' ? (
                                    <form onSubmit={handleRequestCode}>
                                        <p>Ingresa tu correo y te enviaremos un código para restablecer tu contraseña.</p>
                                        <div className="password-container">
                                            <input
                                                type="email"
                                                placeholder="Correo electrónico"
                                                value={resetEmail}
                                                onChange={(e) => setResetEmail(e.target.value)}
                                                className="password-input"
                                                required
                                                disabled={isResetLoading}
                                            />
                                        </div>
                                        <div className="modal-buttons">
                                            <button type="submit" className="submit-button" disabled={isResetLoading}>
                                                {isResetLoading ? "Enviando..." : "Enviar Código"}
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <form onSubmit={handleResetWithCode}>
                                        <p>Ingresa el código que recibiste y tu nueva contraseña.</p>
                                        <div className="password-container">
                                            <input
                                                type="text"
                                                placeholder="Código de verificación"
                                                value={resetCode}
                                                onChange={(e) => setResetCode(e.target.value)}
                                                className="password-input"
                                                required
                                                disabled={isResetLoading}
                                            />
                                        </div>
                                        <div className="password-container">
                                            <input
                                                type={showNewPassword ? "text" : "password"}
                                                placeholder="Nueva contraseña"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                className="password-input"
                                                required
                                                disabled={isResetLoading}
                                            />
                                            <span className="eye-button" onClick={() => setShowNewPassword(!showNewPassword)}>
                                                {showNewPassword ? <FaEyeSlash /> : <FaEye />}
                                            </span>
                                        </div>
                                        <div className="password-container">
                                            <input
                                                type={showConfirmPassword ? "text" : "password"}
                                                placeholder="Confirmar nueva contraseña"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                className="password-input"
                                                required
                                                disabled={isResetLoading}
                                            />
                                            <span className="eye-button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                                                {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                                            </span>
                                        </div>
                                        <div className="modal-buttons">
                                            <button type="submit" className="submit-button" disabled={isResetLoading}>
                                                {isResetLoading ? "Actualizando..." : "Restablecer Contraseña"}
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Login;
