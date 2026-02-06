# Dofus Grimorio

Bot de gestión para servidores privados de Dofus 2.X+.  
Conecta la base de datos del servidor con Discord para mostrar información útil
a jugadores y staff de forma automática.

## ✨ Características

- Conexión a la base de datos del servidor
- Perfiles de personajes, gremios y alianzas
- Rankings del servidor (nivel, honor, gremios, logros)
- Sistema de códigos y votos
- Buscador de oficios
- Logs del HDV del servidor
- Creación y gestión básica de cuentas
- Jugando a ... -> Se convierte a jugadores online

## ✨ Comandos

- /instalar -> Panel para configurar la conexión a las BD y los logs de HDV (Solo admin)
- /social -> Panel donde pueden votar, canjear codigos (solo recursos,ogrinas o consumibles) y buscar oficios (como los libros) (solo admin)
- /cuentas -> Panel donde se pueden crear cuentas, cambiar la contraseña y desbugear personajes (solo admin)
- /perfil -> Muestra los stats, equipamiento, estadisticas y información de personajes
- /ranking -> Muestra ranking de nivel, gremios, honor y logros, pudiendose filtrar por clase
- /alianza -> Muestra información de esa alianza
- /gremio -> Muestra información sobre ese gremio
- /about -> Muestra información del bot

## 🧰 Requisitos

- Node.js 18 o superior
- MySQL / MariaDB
- Un servidor privado de Dofus 2.X+
- Acceso a la base de datos del servidor
- Un bot de Discord con los permisos necesarios

## 🚀 Instalación

1. Clona el repositorio:
   ```bash
   git clone https://github.com/jaimem27/dofusGrimorio.git

   ```
2. Configura el entorno:
   - Abre el .env.example
   - Rellenamos valores que nos pidan
   - Lo guardamos como .env
3. Ejecutar el instaldor:
   - En Windows, haz doble clic en setup.bat
   - El script instalará las dependencias necesarias
   - Los comandos de Discord se registrarán automáticamente
4. Inicia el bot:
   ```Ejecuta start.cmd

   ```

Si prefieres un acceso directo en Windows, puedes usar `setup.bat` para iniciar el proyecto después de configurar el `.env`.

## ⚙️ Configuración

El archivo `.env.example` contiene la configuración principal del bot y sirve como referencia para todas las opciones disponibles.

## 🕹️ Uso

- Usa `/instalar` para configurar el bot en tu servidor
- Comandos disponibles para gremios, alianzas y perfiles
- El bot se sincroniza automáticamente con la base de datos del servidor

## 🔌 Compatibilidad

Dofus Grimorio depende de la estructura de la base de datos del servidor.
Algunas funcionalidades pueden no estar disponibles si el servidor no soporta determinadas tablas o sistemas.

## 💬 Contacto

Para dudas, reportar errores o sugerencias relacionadas con el proyecto:

- Discord: **Shine#0005**
- Servidor Discord (Dutyfree Emulación): https://discord.gg/8DAhv7tvxt
- Repositorio del proyecto (issues y sugerencias)

## ⚠️ Aviso legal

Proyecto no oficial para servidores privados de Dofus.
No afiliado, respaldado ni aprobado por Ankama Games.

## 📄 Licencia

Este proyecto se distribuye bajo la licencia GPL-3.0.
