from flask import Blueprint, request, jsonify, current_app
from extensions import mysql, bcrypt
import random
import string
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.header import Header
import smtplib
import os
import re
from dotenv import load_dotenv
import sys
import traceback
import uuid # Importa uuid para generar tokens únicos

# Importar PyJWT (la librería 'jwt')
import jwt

load_dotenv()

auth_bp = Blueprint('auth', _name_)

MAIL_USER = os.getenv('MAIL_USER')
MAIL_PASS = os.getenv('MAIL_PASS')

# --- Configuración JWT ---
# JWT_SECRET_KEY se obtiene de app.config (establecido en app.py)
JWT_EXPIRATION_DELTA = timedelta(hours=1) # El token expirará en 1 hora


def generar_codigo_verificacion():
    """Genera un código de verificación numérico de 6 dígitos."""
    return str(random.randint(100000, 999999))

def enviar_correo_verificacion(destinatario, codigo):
    """
    Envía un correo electrónico con el código de verificación.
    Retorna True si el envío es exitoso, False en caso contrario.
    """
    try:
        remitente = MAIL_USER
        asunto = "Código de Verificación para tu Cuenta"
        cuerpo_html = f"""
        <html>
        <body>
            <p>Hola,</p>
            <p>Gracias por registrarte. Tu código de verificación es:</p>
            <h3 style="color: #0056b3;">{codigo}</h3>
            <p>Este código es válido por 15 minutos.</p>
            <p>Si no solicitaste este código, por favor ignora este correo.</p>
            <p>Atentamente,</p>
            <p>El equipo de tu aplicación</p>
        </body>
        </html>
        """

        msg = MIMEText(cuerpo_html, 'html', 'utf-8')
        msg['From'] = Header(remitente, 'utf-8')
        msg['To'] = Header(destinatario, 'utf-8')
        msg['Subject'] = Header(asunto, 'utf-8')

        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(MAIL_USER, MAIL_PASS)
            server.sendmail(remitente, destinatario, msg.as_string())
        return True
    except Exception as e:
        print(f"Error al enviar correo: {e}", file=sys.stderr)
        return False

@auth_bp.route('/register', methods=['POST', 'OPTIONS'])
def register():
    if request.method == 'OPTIONS':
        # Manejar la solicitud OPTIONS (preflight CORS)
        response = jsonify({'message': 'Preflight success'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
        return response

    try:
        data = request.get_json()
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        descrip_usuario = data.get('DescripUsuario') # Asegúrate de que esto se pase si es necesario

        if not all([username, email, password]):
            return jsonify({"error": "Faltan datos requeridos (username, email, password)."}), 400

        # Validaciones adicionales (ej. formato de correo, longitud de contraseña)
        if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
            return jsonify({"error": "Formato de correo electrónico inválido."}), 400
        if len(password) < 6:
            return jsonify({"error": "La contraseña debe tener al menos 6 caracteres."}), 400

        conn = mysql.connection
        cursor = conn.cursor()

        # Verificar si el usuario o el correo ya existen
        cursor.execute("SELECT id FROM users WHERE username = %s OR email = %s", (username, email))
        if cursor.fetchone():
            cursor.close()
            return jsonify({"error": "El nombre de usuario o correo electrónico ya está registrado."}), 409

        hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
        
        # Generar código de verificación y tiempo de expiración
        verification_code = generar_codigo_verificacion()
        code_expiration = datetime.now() + timedelta(minutes=15) # Expira en 15 minutos

        # --- Generar un token único para el usuario ---
        new_user_token = str(uuid.uuid4()) # Genera un UUID v4 como token

        # Insertar el nuevo usuario con el token generado
        cursor.execute(
            """
            INSERT INTO users (username, email, password_hash, token, verificado, verification_code, code_expiration, DescripUsuario)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (username, email, hashed_password, new_user_token, 0, verification_code, code_expiration, descrip_usuario)
        )
        conn.commit()

        # Enviar correo de verificación
        if not enviar_correo_verificacion(email, verification_code):
            print(f"Error al enviar correo de verificación a {email}", file=sys.stderr)
        
        # Cierra el cursor después de usarlo
        cursor.close()
        
        return jsonify({
            "message": "Registro exitoso. Se ha enviado un código de verificación a su correo.",
            "user_id": cursor.lastrowid # lastrowid obtiene el ID del usuario recién insertado
        }), 201

    except Exception as e:
        # Asegúrate de hacer un rollback si ocurre un error inesperado antes del commit
        if 'conn' in locals() and conn.open: # Verifica si la conexión está abierta
            conn.rollback()
        print(f"Error en /register: {str(e)}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({"error": "Error interno del servidor al registrar usuario."}), 500

@auth_bp.route('/verificar', methods=['POST'])
def verify_email():
    try:
        data = request.get_json()
        email = data.get('email')
        verification_code = data.get('verification_code')

        if not all([email, verification_code]):
            return jsonify({"error": "Faltan datos requeridos (email, verification_code)."}), 400

        conn = mysql.connection
        cursor = conn.cursor()

        # Buscar usuario por email y código de verificación
        cursor.execute("SELECT id, verification_code, code_expiration FROM users WHERE email = %s", (email,))
        user_info = cursor.fetchone()

        if not user_info:
            cursor.close()
            return jsonify({"error": "Email no encontrado."}), 404

        user_id, stored_code, code_expiration = user_info

        if stored_code != verification_code:
            cursor.close()
            return jsonify({"error": "Código de verificación inválido."}), 401

        if code_expiration is None or datetime.now() > code_expiration:
            # Limpiar el código expirado de la base de datos
            cursor.execute("UPDATE users SET verification_code = NULL, code_expiration = NULL WHERE id = %s", (user_id,))
            conn.commit() # Aplicar el cambio para limpiar el token expirado
            cursor.close()
            return jsonify({"error": "El código de verificación ha expirado."}), 401

        # Si el código es válido y no ha expirado, actualizar el estado 'verificado'
        cursor.execute("UPDATE users SET verificado = 1, verification_code = NULL, code_expiration = NULL WHERE id = %s", (user_id,))
        conn.commit()
        cursor.close()

        return jsonify({"message": "Correo electrónico verificado exitosamente."}), 200

    except Exception as e:
        if 'conn' in locals() and conn.open:
            conn.rollback()
        print(f"Error en /verify-email: {str(e)}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({"error": "Error interno del servidor al verificar correo."}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')

        if not all([email, password]):
            return jsonify({"error": "Faltan datos requeridos (email, password)."}), 400

        conn = mysql.connection
        cursor = conn.cursor()

        cursor.execute("SELECT id, username, password_hash, verificado FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()
        cursor.close()

        if user and bcrypt.check_password_hash(user[2], password): # user[2] es password_hash
            if user[3] == 0: # user[3] es verificado
                return jsonify({"error": "Cuenta no verificada. Por favor, verifica tu correo electrónico."}), 403
            
            # Generar el token JWT
            jwt_secret_key = current_app.config.get('JWT_SECRET_KEY')
            if not jwt_secret_key:
                print("ERROR: JWT_SECRET_KEY no está configurada en app.config para la generación de JWT.", file=sys.stderr)
                return jsonify({"error": "Error de configuración del servidor."}), 500

            token_payload = {
                'user_id': user[0], # user[0] es id
                'username': user[1], # user[1] es username
                'exp': datetime.utcnow() + JWT_EXPIRATION_DELTA
            }
            token = jwt.encode(token_payload, jwt_secret_key, algorithm='HS256') # Codifica el token

            return jsonify({
                "message": "Inicio de sesión exitoso.",
                "user": {
                    "id": user[0],
                    "username": user[1],
                    "email": email # Puedes devolver el email si lo consideras seguro
                },
                "access_token": token # Devuelve el token al cliente
            }), 200
        else:
            return jsonify({"error": "Credenciales inválidas."}), 401
    except Exception as e:
        print(f"Error en /login: {str(e)}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({"error": "Error interno del servidor al iniciar sesión."}), 500


@auth_bp.route('/request-password-reset', methods=['POST'])
def request_password_reset():
    try:
        data = request.get_json()
        email = data.get('email')

        if not email:
            return jsonify({"error": "El correo electrónico es requerido."}), 400

        conn = mysql.connection
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
        user_id = cursor.fetchone()

        if not user_id:
            cursor.close()
            return jsonify({"error": "Correo electrónico no registrado."}), 404
        
        user_id = user_id[0]

        # Generar token de restablecimiento y tiempo de expiración
        reset_token = generar_codigo_verificacion() # Reutilizamos la función para un código numérico
        reset_token_expira = datetime.now() + timedelta(minutes=30) # Token válido por 30 minutos

        cursor.execute(
            "UPDATE users SET reset_token = %s, reset_token_expira = %s WHERE id = %s",
            (reset_token, reset_token_expira, user_id)
        )
        conn.commit()

        # Enviar correo con el token de restablecimiento
        asunto = "Restablecimiento de Contraseña"
        cuerpo_html = f"""
        <html>
        <body>
            <p>Hola,</p>
            <p>Has solicitado un restablecimiento de contraseña. Tu código de restablecimiento es:</p>
            <h3 style="color: #0056b3;">{reset_token}</h3>
            <p>Este código es válido por 30 minutos.</p>
            <p>Si no solicitaste este restablecimiento, por favor ignora este correo.</p>
            <p>Atentamente,</p>
            <p>El equipo de tu aplicación</p>
        </body>
        </html>
        """
        if not enviar_correo_verificacion(email, reset_token): # Reutilizamos la función de envío
            print(f"Error al enviar correo de restablecimiento a {email}", file=sys.stderr)
            # Aunque falló el envío, el token se guardó. Podrías decidir cómo manejar esto.
        
        cursor.close()
        return jsonify({"message": "Si el correo electrónico está registrado, se le ha enviado un código de restablecimiento."}), 200

    except Exception as e:
        if 'conn' in locals() and conn.open:
            conn.rollback()
        print(f"Error en /request-password-reset: {str(e)}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({"error": "Error interno del servidor al solicitar restablecimiento de contraseña."}), 500

@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    try:
        data = request.get_json()
        reset_code = data.get('reset_code')
        new_password = data.get('new_password')

        if not all([reset_code, new_password]):
            return jsonify({"error": "Faltan datos requeridos (reset_code, new_password)."}), 400

        if len(new_password) < 6:
            return jsonify({"error": "La nueva contraseña debe tener al menos 6 caracteres."}), 400

        conn = mysql.connection
        cursor = conn.cursor()

        # Buscar usuario por el CÓDIGO de restablecimiento (almacenado en 'reset_token')
        cursor.execute("SELECT email, reset_token_expira FROM users WHERE reset_token = %s", (reset_code,))
        user_info = cursor.fetchone()
        
        if not user_info:
            cursor.close()
            return jsonify({"error": "Código de restablecimiento inválido."}), 400

        email, expira = user_info
        if expira is None or datetime.now() > expira:
            # Limpiar el token expirado de la base de datos
            cursor.execute("UPDATE users SET reset_token = NULL, reset_token_expira = NULL WHERE email = %s", (email,))
            conn.commit()
            cursor.close()
            return jsonify({"error": "El código de restablecimiento ha expirado."}), 400

        hashed_new_password = bcrypt.generate_password_hash(new_password).decode('utf-8')
        cursor.execute("""
            UPDATE users SET password_hash = %s, reset_token = NULL, reset_token_expira = NULL
            WHERE email = %s
        """, (hashed_new_password, email))
        conn.commit()
        cursor.close()
        return jsonify({"message": "Contraseña restablecida exitosamente."}), 200
    except Exception as e:
        if 'conn' in locals() and conn.open:
            conn.rollback()
        print(f"Error en /reset_password: {str(e)}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({"error": "Error interno del servidor al restablecer contraseña."}), 500