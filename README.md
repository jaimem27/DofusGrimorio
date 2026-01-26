# 📘 Dofus Grimorio

### El grimorio del servidor

> Un sistema **auto-hosteado** que conecta Discord con tu servidor Dofus 2.X.  
> Cuentas, personajes, gremios, rankings y más — **todo desde Discord**.

---

## ✨ ¿Qué es Dofus Grimorio? ✨

**DofusGrimorio** es un proyecto **open-source** diseñado para **reemplazar y ampliar**
las funciones habituales de una web de servidor Dofus, llevándolas directamente a **Discord**.

El objetivo es reducir el peso de la web y pasarlo al **Discord** como foco principal.

---

## 🧭 Cómo se usa DofusGrimorio

DofusGrimorio es un proyecto **público y open-source**, pensado para que **cualquier servidor Discord**
pueda utilizarlo **ejecutando su propia instancia**.

El flujo de uso es el siguiente:

1️⃣ **Clonas el proyecto**  
Cada servidor descarga el código y ejecuta su propia instancia del bot.

2️⃣ **Creas tu propia aplicación de Discord**  
Cada instancia utiliza **su propio token** y puede tener el nombre y apariencia que desees.

3️⃣ **Configuras el entorno**  
Defines las variables necesarias (`.env`) y la conexión a la base de datos del juego.

4️⃣ **Arrancas el bot**  
El bot se ejecuta de forma local o en tu servidor (VPS, máquina propia, etc.).

5️⃣ **Instalas la instancia en Discord**  
Dentro del servidor Discord ejecutas: `/instalar`

Este paso inicializa el Grimorio:
- bloquea la instancia a ese servidor Discord
- detecta las capacidades del servidor Dofus
- prepara la base de datos interna del bot
- activa solo las funcionalidades compatibles

6️⃣ **Empiezas a usar el Grimorio**  
A partir de ese momento, el servidor puede:
- crear y vincular cuentas
- consultar personajes y perfiles
- acceder a rankings
- gestionar gremios, mercado, votos y extras (según soporte)

> 🔍 **Importante**  
> DofusGrimorio no es un bot centralizado ni un servicio compartido.
>  
> El proyecto es público, pero **cada servidor Discord ejecuta su propia instancia del bot**,
> con su propio token y su propia configuración.

---

## 🧠 Cómo funciona 🧠

Cada instancia del bot:

- 🔒 Es **auto-hosteada**
- 🔑 Usa **su propio token**
- 🏠 Diseñado para uso **dedicado**
- 🧩 Puede adaptarse a **distintas tablas de base de datos del juego**

---

## 🧭 Filosofía del proyecto 🧭

- 🔐 **Single-tenant**  
  Una instancia = un servidor

- 🛠️ **Self-hosted**  
  Tú controlas el bot y los datos

- 🧩 **Extensible**  
  Core estable + providers adaptables

- 📜 **Transparente**  
  Sin telemetría, sin servicios externos obligatorios

---

## 🚀 Funcionalidades principales 🚀

### 🔐 Cuentas y vinculación
- Creación de cuentas desde Discord
- Vinculación Discord ↔ cuenta / personajes
- Soporte para **multicuenta** (hasta 8 cuentas)
- Gestión básica de seguridad 

### 👤 Personajes y perfiles
- Perfil detallado de personajes
- Información de stats y equipamiento
- Selección de personaje principal
- Consulta rápida desde Discord

### 🏆 Rankings
- Rankings de personajes
- Rankings de gremios
- Rankings PvP

### 🛡️ Gremios y alianzas
- Información de gremios
- Miembros y progreso
- Información de alianzas

### 🛒 Mercado (opcional)
- Notificaciones de compra/venta en un canal
- Activación automática si el servidor lo soporta

### 🎁 Extras
- Sistema de códigos de regalo
- Sistema de votos con recompensas
- Auditoría básica

---

## 🧩 Arquitectura 🧩

### 🔹 Core
- Comandos de Discord
- Interfaz (embeds, modals, botones)
- Configuración y permisos
- Base de datos interna del bot
- Logs y auditoría

👉 **No depende del esquema del servidor**

### 🔹 Providers
Módulos que conectan el bot con la base de datos real del juego.

- `standard` → esquema base gratuito de referencia
- `custom` → plantilla para adaptar otros servidores
- `disabled` → modo solo consulta

---

## ⚙️ Instalación rápida

1. Clona el repositorio
2. Crea tu **Discord Application**
3. Configura el archivo `.env`
4. Arranca el bot
5. Ejecuta `/setup install`

👉 Cada servidor repite este proceso de forma independiente.

---

## 👤 Autor 👤

**Shine**  
Antiguo administrador / desarrollador de servidores **Inquisition**

---

## 📜 Licencia 📜

Este proyecto es **open-source**  
Licencia: **Apache 2.0**

---

✨ *Que el Grimorio te guíe.* ✨
