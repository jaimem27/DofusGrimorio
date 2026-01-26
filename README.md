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

👉 Guía completa en `/docs`

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
