from flask import Blueprint, request, jsonify, current_app
from extensions import mysql
from MySQLdb.cursors import DictCursor
from werkzeug.utils import secure_filename
import os
import sys
import traceback
from datetime import datetime

# Importar PyJWT
import jwt

user_bp = Blueprint('user', _name_)

# --- Configuración JWT ---
# Definiendo una función auxiliar para obtener el payload del JWT
def get_user_from_jwt(auth_header):
    """
    Extrae el token del encabezado de autorización y decodifica el JWT.
    Retorna el payload decodificado o None en caso de error/token inválido.
    """
    token = None
    if auth_header and "Bearer " in auth_header:
        token = auth_header.split(" ")[1]
    else:
        print("Advertencia: Encabezado de autorización sin 'Bearer ' o no proporcionado.", file=sys.stderr)
        return None

    if not token:
        print("Advertencia: Token real no extraído del encabezado de autorización.", file=sys.stderr)
        return None

    try:
        # Usar la JWT_SECRET_KEY configurada globalmente en app.py
        jwt_secret_key = current_app.config.get('JWT_SECRET_KEY')
        if not jwt_secret_key:
            print("ERROR: JWT_SECRET_KEY no está configurada en app.config.", file=sys.stderr)
            return None

        payload = jwt.decode(token, jwt_secret_key, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        print("Advertencia: Token expirado.", file=sys.stderr)
        return None
    except jwt.InvalidTokenError:
        print("Advertencia: Token inválido.", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Error al decodificar JWT: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return None

# Función auxiliar para obtener detalles completos del usuario desde la DB
def get_user_details(user_id):
    cursor = mysql.connection.cursor(DictCursor)
    try:
        cursor.execute("SELECT id, username, email, DescripUsuario, verificado, foto_perfil FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        return user
    except Exception as e:
        print(f"Error al obtener detalles del usuario {user_id}: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return None
    finally:
        cursor.close()

# --- Rutas protegidas ---

@user_bp.route('/logeado', methods=['GET'])
def logeado():
    auth_header = request.headers.get('Authorization')
    user_payload = get_user_from_jwt(auth_header)

    if not user_payload:
        return jsonify({"logeado": 0, "error": "Token de autorización inválido o ausente."}), 401

    if not user_payload.get('verificado'):
        return jsonify({"logeado": 0, "error": "Cuenta no verificada."}), 403

    return jsonify({
        "logeado": 1,
        "user_id": user_payload.get('user_id'),
        "username": user_payload.get('username'),
        "email": user_payload.get('email')
    }), 200

@user_bp.route('/perfil', methods=['GET', 'PUT'])
def perfil():
    auth_header = request.headers.get('Authorization')
    user_payload = get_user_from_jwt(auth_header)

    if not user_payload:
        return jsonify({"error": "No autorizado: Token inválido o ausente."}), 401

    if not user_payload.get('verificado'):
        return jsonify({"error": "Usuario no verificado."}), 403

    current_user_id = user_payload.get('user_id')
    username_from_jwt = user_payload.get('username')
    email_from_jwt = user_payload.get('email')

    user_details_from_db = get_user_details(current_user_id)
    if not user_details_from_db:
        return jsonify({"error": "Usuario no encontrado en la base de datos."}), 404

    descripcion = user_details_from_db.get('DescripUsuario')
    foto_perfil = user_details_from_db.get('foto_perfil')

    cursor = mysql.connection.cursor()
    try:
        if request.method == 'GET':
            cursor.execute("SELECT dificultad_id, puntaje_actual FROM partidas WHERE user_id = %s", (current_user_id,))
            puntajes = cursor.fetchall()

            return jsonify({
                "username": username_from_jwt, # Usamos el username del JWT
                "email": email_from_jwt,     # Usamos el email del JWT
                "descripcion": descripcion,  # Obtenido de la DB
                "foto_perfil": foto_perfil,  # Obtenido de la DB
                "puntajes": [{"dificultad": p[0], "puntaje": p[1]} for p in puntajes]
            }), 200

        elif request.method == 'PUT':
            data = request.get_json()
            nueva_descripcion = data.get("descripcion")
            nuevo_username = data.get("username")

            if nueva_descripcion is None or nuevo_username is None:
                return jsonify({"error": "Faltan campos requeridos: descripcion y username."}), 400

            # Verificar si el nuevo username ya está en uso por otro usuario
            cursor.execute("SELECT id FROM users WHERE username = %s AND id != %s", (nuevo_username, current_user_id))
            if cursor.fetchone():
                return jsonify({"error": "El nombre de usuario ya está en uso."}), 409

            cursor.execute("UPDATE users SET DescripUsuario = %s, username = %s WHERE id = %s", (nueva_descripcion, nuevo_username, current_user_id))
            mysql.connection.commit()

            # Nota: Si el username cambia, el JWT actual seguirá teniendo el viejo.
            # Para reflejar el cambio inmediatamente, el cliente debería solicitar un nuevo JWT (volver a iniciar sesión).
            return jsonify({"mensaje": "Perfil actualizado correctamente. El nombre de usuario en tu token actual puede no estar actualizado hasta un nuevo login."}), 200

    except Exception as e:
        print(f"ERROR en /perfil: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({"error": "Error interno del servidor al obtener/actualizar perfil."}), 500
    finally:
        cursor.close()


@user_bp.route('/publicaciones', methods=['GET'])
def publicaciones():
    # Este endpoint ahora es público, no requiere autenticación JWT.
    cursor = mysql.connection.cursor(DictCursor)
    try:
        # Obtener todas las publicaciones y todas sus URLs de imágenes asociadas
        cursor.execute("""
            SELECT
                p.id,
                p.autor_id,
                u.username AS author,
                p.titulo AS title,
                p.texto AS content,
                p.created_at,
                GROUP_CONCAT(ip.url ORDER BY ip.orden ASC) AS all_image_urls -- Obtener todas las URLs de imágenes ordenadas
            FROM publicaciones p
            JOIN users u ON p.autor_id = u.id
            LEFT JOIN imagenes_publicacion ip ON p.id = ip.publicacion_id
            GROUP BY p.id, p.autor_id, u.username, p.titulo, p.texto, p.created_at
            ORDER BY p.created_at DESC
        """)
        publicaciones = cursor.fetchall()

        for pub in publicaciones:
            # Obtener cantidad de comentarios para cada publicación
            cursor.execute("SELECT COUNT(*) AS cantidad FROM comentarios WHERE publicacion_id = %s", (pub['id'],))
            pub['cantidad_comentarios'] = cursor.fetchone()['cantidad']

            pub['created_at'] = pub['created_at'].isoformat() if pub['created_at'] else None

            # Procesar las URLs de las imágenes en Python
            all_urls_str = pub.pop('all_image_urls') # Eliminar la cadena combinada del diccionario
            if all_urls_str:
                # Filtrar valores None/vacíos que puedan resultar de GROUP_CONCAT con datos inconsistentes
                all_urls = [url for url in all_urls_str.split(',') if url]
                pub['imageUrl'] = all_urls[0] if all_urls else None # La primera URL como imagen principal
                pub['imagenes_adicionales_urls'] = all_urls[1:] if len(all_urls) > 1 else [] # El resto como adicionales
            else:
                pub['imageUrl'] = None
                pub['imagenes_adicionales_urls'] = []


        return jsonify(publicaciones), 200
    except Exception as e:
        print(f"Error en /publicaciones: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({"error": "Error interno del servidor al obtener publicaciones."}), 500
    finally:
        cursor.close()

@user_bp.route('/crear-publicacion', methods=['POST'])
def crear_publicacion():
    auth_header = request.headers.get('Authorization')
    user_payload = get_user_from_jwt(auth_header)

    if not user_payload:
        return jsonify({"error": "No autorizado"}), 401

    if not user_payload.get('verificado'):
        return jsonify({"error": "Usuario no verificado."}), 403

    current_user_id = user_payload.get('user_id')
    texto = request.json.get('texto')
    titulo = request.json.get('titulo') # NUEVO: Recibimos el título también

    if not texto or not titulo:
        return jsonify({"error": "Título y texto de la publicación son requeridos."}), 400

    cursor = mysql.connection.cursor()
    try:
        # NUEVO: Insertamos el título
        cursor.execute("INSERT INTO publicaciones (autor_id, titulo, texto) VALUES (%s, %s, %s)", (current_user_id, titulo, texto))
        mysql.connection.commit()

        # CLAVE: Devolvemos el ID de la publicación recién creada
        new_post_id = cursor.lastrowid
        return jsonify({"message": "Publicación creada exitosamente.", "publicacion_id": new_post_id}), 201
    except Exception as e:
        print(f"Error al crear publicación: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr) # Añadido para mejor depuración
        return jsonify({"error": "Error interno del servidor"}), 500
    finally:
        cursor.close()

@user_bp.route('/editar-publicacion/<int:publicacion_id>', methods=['PUT'])
def editar_publicacion(publicacion_id):
    auth_header = request.headers.get('Authorization')
    user_payload = get_user_from_jwt(auth_header)

    if not user_payload:
        return jsonify({"error": "No autorizado: Token inválido o ausente."}), 401

    current_user_id = user_payload.get('user_id')
    nuevo_texto = request.json.get('texto')
    nuevo_titulo = request.json.get('titulo') # Añadido para edición

    if not nuevo_texto or not nuevo_titulo: # Ambos son requeridos para la edición
        return jsonify({"error": "Nuevo título y texto de publicación son requeridos."}), 400

    cursor = mysql.connection.cursor()
    try:
        cursor.execute("SELECT autor_id FROM publicaciones WHERE id = %s", (publicacion_id,))
        resultado = cursor.fetchone()
        if not resultado or resultado[0] != current_user_id:
            return jsonify({"error": "No autorizado para editar esta publicación."}), 403

        # Actualizar título y texto
        cursor.execute("UPDATE publicaciones SET texto = %s, titulo = %s WHERE id = %s", (nuevo_texto, nuevo_titulo, publicacion_id))
        mysql.connection.commit()
        return jsonify({"message": "Publicación editada correctamente."}), 200
    except Exception as e:
        print(f"Error al editar publicación: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({"error": "Error interno del servidor al editar publicación."}), 500
    finally:
        cursor.close()

@user_bp.route('/eliminar-publicacion/<int:publicacion_id>', methods=['DELETE'])
def eliminar_publicacion(publicacion_id):
    auth_header = request.headers.get('Authorization')
    user_payload = get_user_from_jwt(auth_header)

    if not user_payload:
        return jsonify({"error": "No autorizado: Token inválido o ausente."}), 401

    current_user_id = user_payload.get('user_id')

    cursor = mysql.connection.cursor()
    try:
        cursor.execute("SELECT autor_id FROM publicaciones WHERE id = %s", (publicacion_id,))
        resultado = cursor.fetchone()
        if not resultado or resultado[0] != current_user_id:
            return jsonify({"error": "No autorizado para eliminar esta publicación."}), 403

        # Traer todas las URLs de imágenes asociadas a esta publicación desde imagenes_publicacion
        cursor.execute("SELECT url FROM imagenes_publicacion WHERE publicacion_id = %s", (publicacion_id,))
        image_urls_to_delete = cursor.fetchall()

        for img_url_tuple in image_urls_to_delete:
            img_url = img_url_tuple[0]
            if current_app.config.get('API_BASE_URL') and img_url.startswith(current_app.config.get('API_BASE_URL')):
                relative_path = img_url.replace(current_app.config.get('API_BASE_URL'), '').lstrip('/')
                filepath_to_delete = os.path.join(current_app.root_path, relative_path)
                if os.path.exists(filepath_to_delete):
                    os.remove(filepath_to_delete)
                    print(f"Imagen de publicación eliminada del disco: {filepath_to_delete}", file=sys.stderr)


        cursor.execute("DELETE FROM publicaciones WHERE id = %s", (publicacion_id,))
        mysql.connection.commit()
        return jsonify({"message": "Publicación eliminada correctamente."}), 200
    except Exception as e:
        print(f"Error al eliminar publicación: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({"error": "Error interno del servidor al eliminar publicación."}), 500
    finally:
        cursor.close()

@user_bp.route('/comentar-publicacion', methods=['POST'])
def comentar_publicacion():
    auth_header = request.headers.get('Authorization')
    user_payload = get_user_from_jwt(auth_header)

    if not user_payload:
        return jsonify({"error": "No autorizado: Token inválido o ausente."}), 401

    if not user_payload.get('verificado'):
        return jsonify({"error": "Usuario no verificado."}), 403

    current_user_id = user_payload.get('user_id')
    publicacion_id = request.json.get('publicacion_id')
    comentario = request.json.get('comentario')

    if publicacion_id is None or not comentario:
        return jsonify({"error": "ID de publicación y comentario son requeridos."}), 400

    cursor = mysql.connection.cursor()
    try:
        cursor.execute("SELECT id FROM publicaciones WHERE id = %s", (publicacion_id,))
        if not cursor.fetchone():
            return jsonify({"error": "La publicación no existe."}), 404

        cursor.execute(
            "INSERT INTO comentarios (publicacion_id, autor_id, texto) VALUES (%s, %s, %s)",
            (publicacion_id, current_user_id, comentario)
        )
        mysql.connection.commit()
        return jsonify({"message": "Comentario publicado exitosamente."}), 201
    except Exception as e:
        print(f"Error al comentar publicación: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({"error": "Error interno del servidor al comentar."}), 500
    finally:
        cursor.close()


@user_bp.route('/editar-comentario/<int:comentario_id>', methods=['PUT'])
def editar_comentario(comentario_id):
    auth_header = request.headers.get('Authorization')
    user_payload = get_user_from_jwt(auth_header)

    if not user_payload:
        return jsonify({"error": "No autorizado: Token inválido o ausente."}), 401

    current_user_id = user_payload.get('user_id')
    nuevo_texto = request.json.get('comentario')

    if not nuevo_texto:
        return jsonify({"error": "Nuevo texto del comentario requerido."}), 400

    cursor = mysql.connection.cursor()
    try:
        cursor.execute("SELECT autor_id FROM comentarios WHERE id = %s", (comentario_id,))
        resultado = cursor.fetchone()
        if not resultado or resultado[0] != current_user_id:
            return jsonify({"error": "No autorizado para editar este comentario."}), 403

        cursor.execute("UPDATE comentarios SET texto = %s WHERE id = %s", (nuevo_texto, comentario_id))
        mysql.connection.commit()
        return jsonify({"message": "Comentario editado correctamente."}), 200
    except Exception as e:
        print(f"Error al editar comentario: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({"error": "Error interno del servidor al editar comentario."}), 500
    finally:
        cursor.close()

@user_bp.route('/eliminar-comentario/<int:comentario_id>', methods=['DELETE'])
def eliminar_comentario(comentario_id):
    auth_header = request.headers.get('Authorization')
    user_payload = get_user_from_jwt(auth_header)

    if not user_payload:
        return jsonify({"error": "No autorizado: Token inválido o ausente."}), 401

    current_user_id = user_payload.get('user_id')

    cursor = mysql.connection.cursor()
    try:
        cursor.execute("SELECT autor_id FROM comentarios WHERE id = %s", (comentario_id,))
        resultado = cursor.fetchone()
        if not resultado or resultado[0] != current_user_id:
            return jsonify({"error": "No autorizado para eliminar este comentario."}), 403

        cursor.execute("DELETE FROM comentarios WHERE id = %s", (comentario_id,))
        mysql.connection.commit()
        return jsonify({"message": "Comentario eliminado correctamente."}), 200
    except Exception as e:
        print(f"Error al eliminar comentario: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({"error": "Error interno del servidor al eliminar comentario."}), 500
    finally:
        cursor.close()


@user_bp.route('/perfil/foto', methods=['PUT'])
def upload_profile_picture():
    auth_header = request.headers.get('Authorization')
    user_payload = get_user_from_jwt(auth_header)

    if not user_payload:
        return jsonify({"error": "No autorizado: Token inválido o ausente."}), 401

    if not user_payload.get('verificado'):
        return jsonify({"error": "Usuario no verificado."}), 403

    current_user_id = user_payload.get('user_id')
    username = user_payload.get('username') # Obtener el username del payload del JWT

    # Obtener la URL de la foto de perfil actual desde la base de datos
    cursor = mysql.connection.cursor()
    try:
        cursor.execute("SELECT foto_perfil FROM users WHERE id = %s", (current_user_id,))
        result = cursor.fetchone()
        old_profile_picture_url = result[0] if result else None
    except Exception as e:
        print(f"Error al obtener foto_perfil antigua para user {current_user_id}: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({"error": "Error interno al obtener la foto de perfil existente."}), 500
    finally:
        cursor.close()

    if 'profile_picture' not in request.files:
        return jsonify({'error': 'No se encontró el archivo de imagen en la solicitud. El campo esperado es "profile_picture".'}), 400

    file = request.files['profile_picture']

    if file.filename == '':
        return jsonify({'error': 'No se seleccionó ningún archivo.'}), 400

    allowed_extensions = current_app.config.get('ALLOWED_EXTENSIONS', {'png', 'jpg', 'jpeg', 'gif'})

    if file and '.' in file.filename and \
       file.filename.rsplit('.', 1)[1].lower() in allowed_extensions:

        file_extension = file.filename.rsplit('.', 1)[1].lower()

        upload_folder = current_app.config.get('UPLOAD_FOLDER')
        if not upload_folder:
            print("ERROR: UPLOAD_FOLDER no está configurado en app.config.", file=sys.stderr)
            return jsonify({"error": "Error de configuración del servidor (UPLOAD_FOLDER no definido)."}, 500)

        # Crear la carpeta específica para el usuario dentro de 'fotos_perfil': UPLOAD_FOLDER/fotos_perfil/username/
        base_profile_pictures_path = os.path.join(upload_folder, 'fotos_perfil')
        user_folder = os.path.join(base_profile_pictures_path, str(username))

        if not os.path.exists(user_folder):
            os.makedirs(user_folder)

        new_filename = secure_filename(f"profile_picture.{file_extension}")
        filepath = os.path.join(user_folder, new_filename)

        try:
            # Eliminar la foto de perfil antigua si existe
            if old_profile_picture_url:
                # La URL antigua sería como http://base_url/uploads/fotos_perfil/username/old_filename.ext
                # Necesitamos extraer "/uploads/fotos_perfil/username/old_filename.ext" para construir la ruta local
                if current_app.config.get('API_BASE_URL') and old_profile_picture_url.startswith(current_app.config.get('API_BASE_URL')):
                    relative_path = old_profile_picture_url.replace(current_app.config.get('API_BASE_URL'), '').lstrip('/')
                    old_filepath_from_url = os.path.join(current_app.root_path, relative_path)
                    if os.path.exists(old_filepath_from_url) and old_filepath_from_url != filepath: # Evitar borrar si es el mismo archivo
                        os.remove(old_filepath_from_url)
                        print(f"Old profile picture removed: {old_filepath_from_url}", file=sys.stderr)
                else: # Si la URL no tiene la API_BASE_URL, intenta derivar la ruta local directamente
                    old_filename_from_url = os.path.basename(old_profile_picture_url)
                    # Intentamos construir la ruta asumiendo la estructura actual: UPLOAD_FOLDER/fotos_perfil/username/old_filename
                    old_filepath = os.path.join(user_folder, old_filename_from_url)
                    if os.path.exists(old_filepath) and old_filepath != filepath:
                        os.remove(old_filepath)
                        print(f"Old profile picture removed (derived path): {old_filepath}", file=sys.stderr)


            file.save(filepath)

            base_url = current_app.config.get('API_BASE_URL', request.url_root.rstrip('/'))
            # Ajustar la URL para reflejar la nueva ruta de fotos de perfil
            image_url = f"{base_url}/uploads/fotos_perfil/{username}/{new_filename}"

            cursor = mysql.connection.cursor()
            try:
                cursor.execute("UPDATE users SET foto_perfil = %s WHERE id = %s", (image_url, current_user_id))
                mysql.connection.commit()
                return jsonify({
                    'message': 'Foto de perfil actualizada exitosamente.',
                    'foto_perfil_url': image_url
                }), 200
            except Exception as db_e:
                if os.path.exists(filepath):
                    os.remove(filepath)
                print(f"Error DB al actualizar foto de perfil para user {current_user_id}: {db_e}", file=sys.stderr)
                traceback.print_exc(file=sys.stderr)
                return jsonify({"error": "Error interno del servidor al guardar la URL de la foto de perfil."}), 500
            finally:
                cursor.close()

        except Exception as save_e:
            print(f"Error al guardar el archivo: {save_e}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            return jsonify({"error": "Error interno del servidor al guardar la imagen."}), 500
    else:
        return jsonify({'error': f"Tipo de archivo no permitido o nombre de archivo inválido. Solo se permiten {', '.join(allowed_extensions)}."}), 400


@user_bp.route('/publicaciones/<int:publicacion_id>/upload_imagen', methods=['POST'])
def upload_publicacion_image(publicacion_id):
    auth_header = request.headers.get('Authorization')
    user_payload = get_user_from_jwt(auth_header)

    if not user_payload:
        return jsonify({"error": "No autorizado: Token inválido o ausente."}), 401

    if not user_payload.get('verificado'):
        return jsonify({"error": "Usuario no verificado."}), 403

    current_user_id = user_payload.get('user_id')
    username = user_payload.get('username')

    cursor = mysql.connection.cursor()
    try:
        # 1. Verificar si la publicación existe y pertenece al usuario actual
        cursor.execute("SELECT autor_id FROM publicaciones WHERE id = %s", (publicacion_id,))
        publicacion = cursor.fetchone()
        if not publicacion:
            return jsonify({"error": "Publicación no encontrada."}), 404
        if publicacion[0] != current_user_id:
            return jsonify({"error": "No tienes permiso para subir imágenes a esta publicación."}), 403

        if 'imagen_publicacion' not in request.files:
            return jsonify({'error': 'No se encontró el archivo de imagen en la solicitud. El campo esperado es "imagen_publicacion".'}), 400

        file = request.files['imagen_publicacion']

        if file.filename == '':
            return jsonify({'error': 'No se seleccionó ningún archivo.'}), 400

        allowed_extensions = current_app.config.get('ALLOWED_EXTENSIONS', {'png', 'jpg', 'jpeg', 'gif'})

        if file and '.' in file.filename and \
           file.filename.rsplit('.', 1)[1].lower() in allowed_extensions:

            file_extension = file.filename.rsplit('.', 1)[1].lower()

            upload_folder = current_app.config.get('UPLOAD_FOLDER')
            if not upload_folder:
                print("ERROR: UPLOAD_FOLDER no está configurado en app.config.", file=sys.stderr)
                return jsonify({"error": "Error de configuración del servidor (UPLOAD_FOLDER no definido)."}, 500)

            # Crear la carpeta específica para la publicación: UPLOAD_FOLDER/publicaciones/username-public-publicacion_id/
            base_publicaciones_path = os.path.join(upload_folder, 'publicaciones')
            publicacion_folder_name = f"{username}-public-{publicacion_id}"
            publicacion_folder_path = os.path.join(base_publicaciones_path, publicacion_folder_name)

            if not os.path.exists(publicacion_folder_path):
                os.makedirs(publicacion_folder_path)

            # Generar un nombre de archivo seguro y único (puedes añadir un timestamp o UUID si se permite más de una imagen)
            new_filename = secure_filename(file.filename)
            filepath = os.path.join(publicacion_folder_path, new_filename)

            try:
                file.save(filepath)

                base_url = current_app.config.get('API_BASE_URL', request.url_root.rstrip('/'))
                # Ajustar la URL para reflejar la nueva ruta de publicaciones
                image_url = f"{base_url}/uploads/publicaciones/{publicacion_folder_name}/{new_filename}"

                # Guardar la URL de la imagen en la tabla 'imagenes_publicacion'
                # Si se permite más de una imagen, se podría pasar un 'orden' en el request o calcularlo
                # Para esta implementación, asumimos orden=1 si es la primera, o puedes manejarlo como quieras
                # Aquí, insertaremos un nuevo registro por cada imagen subida.
                cursor.execute("INSERT INTO imagenes_publicacion (publicacion_id, url) VALUES (%s, %s)", (publicacion_id, image_url))
                mysql.connection.commit()

                return jsonify({
                    'message': 'Imagen de publicación subida exitosamente.',
                    'imagen_url': image_url
                }), 201
            except Exception as save_e:
                # Si falla al guardar en disco o DB, intentar limpiar el archivo si ya se había guardado
                if os.path.exists(filepath):
                    os.remove(filepath)
                print(f"Error al guardar el archivo o DB para publicación {publicacion_id}: {save_e}", file=sys.stderr)
                traceback.print_exc(file=sys.stderr)
                return jsonify({"error": "Error interno del servidor al guardar la imagen de la publicación."}), 500
        else:
            return jsonify({'error': f"Tipo de archivo no permitido o nombre de archivo inválido. Solo se permiten {', '.join(allowed_extensions)}."}), 400
    finally:
        cursor.close()