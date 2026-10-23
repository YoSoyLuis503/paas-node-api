# PaaS App 2: Catálogo de Microservicios Cloud (Stack Moderno)

![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=flat&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.19-000000?style=flat&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=flat&logo=postgresql&logoColor=white)
![Kubernetes](https://img.shields.io/badge/Kubernetes-Minikube-326CE5?style=flat&logo=kubernetes&logoColor=white)
![License](https://img.shields.io/badge/Evaluación-Parcial%202-success)

API RESTful desarrollada en **Node.js 20 (Express)** conectada a una base de datos relacional **PostgreSQL 15** administrada en plataforma PaaS Multi-Tenant sobre Kubernetes. Incluye interfaz SPA reactiva para interactuar con los recursos en vivo.

---

## 📋 Características Principales
- **API RESTful Completa:** Endpoints para operaciones CRUD completas (`GET`, `POST`, `PUT`, `DELETE`) sobre la entidad `servicios_cloud`.
- **Arquitectura 12-Factor App:** Cero credenciales expuestas en repositorios Git. Inyección dinámica mediante variables de entorno desde el PaaS Dashboard.
- **Frontend SPA Integrado:** Interfaz web moderna para consumo asíncrono (`fetch`), con visor de payload JSON en crudo para auditoría docente.
- **Health Check & Telemetría:** Endpoint `/api/health` con latencia de conexión a PostgreSQL, pod réplica (`os.hostname()`), uptime y consumo de memoria RAM.
- **Seguridad en Contenedores:** Imagen basada en `node:20-alpine` ejecutada como usuario no root (`UID 101`) para cumplir las directivas de seguridad del clúster (`runAsNonRoot: true`).

---

## 📡 Endpoints de la API REST

| Método | Endpoint | Descripción | Payload Ejemplo |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/servicios` | Listar todos los microservicios | N/A |
| `POST` | `/api/servicios` | Registrar nuevo microservicio | `{"nombre":"Auth API","tipo":"Microservicio","estado":"Activo"}` |
| `PUT` | `/api/servicios/:id` | Actualizar microservicio | `{"nombre":"Auth API v2","tipo":"Microservicio","estado":"Activo"}` |
| `DELETE` | `/api/servicios/:id` | Eliminar microservicio | N/A |
| `POST` | `/api/servicios/seed` | Restablecer catálogo inicial | N/A |
| `GET` | `/api/health` | Diagnóstico de salud y PostgreSQL | N/A |

---

## 🔐 Variables de Entorno Requeridas

| Variable | Descripción | Valor Típico en el Clúster |
| :--- | :--- | :--- |
| `DB_HOST` | Hostname del servicio PostgreSQL interno | `postgres-service.alquimia.svc.cluster.local` |
| `DB_PORT` | Puerto de escucha de PostgreSQL | `5432` |
| `DB_NAME` | Nombre de la base de datos relacional | `paas_alquimia_db` |
| `DB_USER` | Usuario asignado al inquilino | `alquimia_admin` |
| `DB_PASSWORD` | Contraseña segura del inquilino | Inyectada por la Bóveda del PaaS |
| `PORT` | Puerto HTTP del contenedor | `8080` (o asignado dinámicamente) |

---

## 🚀 Despliegue en el PaaS
1. Ingrese al panel del PaaS (`http://192.168.88.128:5000`).
2. Seleccione el inquilino **Alquimia**.
3. En la pestaña **Despliegue GitOps**, pegue la URL de este repositorio:
   ```text
   https://github.com/<tu-usuario>/paas-node-api.git
   ```
4. Verifique que las credenciales en la **Bóveda de Variables** correspondan a PostgreSQL.
5. Presione **🚀 Desplegar a Producción**. El pipeline automatizado clonará el código, compilará la imagen en el demonio de Minikube y actualizará el servicio mediante Helm.
