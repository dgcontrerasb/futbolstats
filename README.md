# ⚡ SportStats Pro — Plataforma de Inteligencia Estadística y Análisis Cuantitativo Deportivo

![Version](https://img.shields.io/badge/version-1.0.0-00ff66?style=flat-square&labelColor=0b0e14)
![React](https://img.shields.io/badge/React_19-TypeScript-161b22?style=flat-square&logo=react&logoColor=00ff66)
![Backend](https://img.shields.io/badge/Express-Serverless_API-161b22?style=flat-square&logo=node.js&logoColor=00ff66)
![TailwindCSS](https://img.shields.io/badge/UI-Cyber--Fintech_Dark-161b22?style=flat-square&logo=tailwindcss&logoColor=00ff66)
![Vercel](https://img.shields.io/badge/Deploy-Vercel_Ready-161b22?style=flat-square&logo=vercel&logoColor=ffffff)
![PWA](https://img.shields.io/badge/PWA-Installable-161b22?style=flat-square&logoColor=00ff66)

**SportStats Pro** es una consola avanzada de análisis estadístico, modelado matemático de probabilidades y seguimiento en tiempo real para **Fútbol Internacional** y **NBA**. Diseñada bajo una estética **Cyber-Fintech Dark**, prioriza la alta densidad de datos, precisión tabular (`tabular-nums`) y lectura rápida de métricas de valor esperado (**+EV**).

---

## 🎯 Características Principales

### ⚽ Motor Cuantitativo de Fútbol
* **Modelado Bivariado de Poisson y Ajuste Dixon-Coles**: Estimación de goles esperados (**xG**), probabilidades reales en mercados **1X2**, **Doble Oportunidad**, **Over/Under (1.5, 2.5, 3.5)** y **Ambos Anotan (BTTS)**.
* **Simulación de Monte Carlo**: Ejecución de **10,000 iteraciones** por encuentro para proyectar marcadores exactos más probables y distribución de varianza.
* **Métricas Tácticas Avanzadas**: Proyección de **Córners**, **Tarjetas**, **Disparos a Puerta** y rachas de forma ponderadas por localía/visita.
* **Comparativa Head-to-Head (H2H) y Clasificaciones**: Historial directo, tablas de posiciones detalladas (General, Local, Visitante) y rendimiento reciente.

### 🏀 Motor de Proyección NBA
* **Análisis de Pace & Eficiencia Ofensiva/Defensiva**: Proyección de puntos totales por equipo, diferencial esperado (**Spread / Hándicap**) y líneas **Over/Under**.
* **Probabilidad de Victoria Directa (Moneyline)**: Cálculo estadístico ajustado por factor cancha, rachas y promedios de anotación e impacto defensivo.

### 💹 Herramientas de Trading Deportivo y Gestión de Riesgo
* **Detector de Valor Esperado (+EV)**: Comparación automática entre la probabilidad matemática real del modelo y la cuota implícita del mercado.
* **Calculadora Didáctica de Retorno y Criterio de Kelly**: Simulación interactiva de inversión con cálculo automático de ganancia bruta, utilidad neta y gestión fraccional de *bankroll*.
* **Constructor de Combinadas (Parlays)**: Acumulador inteligente de selecciones con cuota total combinada y probabilidad conjunta estimada.

### 🔐 Seguridad, Licencias y Panel de Administración
* **Control de Acceso por Dispositivo**: Sistema de activación por huella única de dispositivo (`Device ID`) con planes temporales (Prueba, Mensual, Trimestral, Anual y Vitalicio).
* **Panel Administrativo Protegido por PIN**: Gestión de licencias en tiempo real, generación de accesos y flujo de recuperación de credenciales vía WhatsApp.
* **Caché Inteligente Multi-Nivel**: Optimización de consultas a APIs deportivas con persistencia en memoria y sistema de archivos (`/tmp` en entornos Serverless) para máxima velocidad de respuesta.

---

## 🛠️ Arquitectura y Stack Tecnológico

| Capa | Tecnología |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Motion |
| **Visualización de Datos** | Recharts + Tablas Financieras de Alta Densidad (`tabular-nums`) |
| **Backend / API** | Node.js, Express 4 (Compatible con ejecución local y Vercel Serverless Functions) |
| **Fuentes de Datos** | API-Football (v3), Football-Data.org, The Odds API, ESPN Core API |
| **Soporte Móvil** | Progressive Web App (PWA) con Service Worker y Manifiesto Web instalable |

---

## 📂 Estructura del Proyecto

```text
sportstats-pro/
├── api/
│   └── index.ts              # Punto de entrada Serverless para Vercel
├── public/                   # Logos oficiales, iconos PWA y recursos estáticos
├── src/
│   ├── components/           # Componentes UI (Tarjetas de predicción, Tablas, Modales)
│   ├── context/              # Estado global y contexto de configuración
│   ├── hooks/                # Hooks personalizados (PWA, estado de red)
│   ├── services/             # Motores matemáticos (Poisson, NBA, caché, cliente API)
│   ├── App.tsx               # Consola principal y enrutamiento de vistas
│   ├── index.css             # Sistema de diseño Cyber-Fintech Dark
│   └── types.ts              # Definiciones de tipos TypeScript
├── server.ts                 # Servidor Express, proxy de APIs deportivas y gestión de licencias
├── vercel.json               # Reglas de enrutamiento para despliegue en Vercel
├── vite.config.ts            # Configuración de compilación Frontend y PWA
└── .env.example              # Plantilla de variables de entorno
```

---

## ⚙️ Configuración de Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto para desarrollo local (o configúralas en el panel **Settings → Environment Variables** de Vercel):

```env
# Seguridad y Administración
ADMIN_PIN=PIN_NUMERICO_PRIVADO_DE_6_O_MAS_DIGITOS
ADMIN_SESSION_SECRET=SECRETO_ALEATORIO_DE_AL_MENOS_32_CARACTERES
ADMIN_WHATSAPP=573213902708
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=CLAVE_PRIVADA_SOLO_DEL_SERVIDOR

# Claves de APIs Deportivas
API_FOOTBALL_KEY=tu_clave_de_api_football
FOOTBALL_DATA_KEY=tu_clave_de_football_data
ODDS_API_KEY=tu_clave_de_the_odds_api
```

Genera un secreto de sesión aleatorio con `openssl rand -hex 32`. No reutilices una clave del cliente ni compartas estos valores. El panel emite una cookie de sesión `HttpOnly`, `Secure` en producción y `SameSite=Strict`; el PIN no se guarda en el navegador. Configura también `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` únicamente en el servidor: la autenticación administrativa y, en producción, la de clientes fallan de forma segura si no pueden usar sus limitadores compartidos de intentos.

El acceso administrativo requiere que `ADMIN_PIN` contenga solo dígitos y tenga al menos 6 caracteres (se recomiendan 10 o más), `ADMIN_SESSION_SECRET` tenga al menos 32 bytes y la clave service-role de Supabase esté configurada. Antes de desplegar, ejecuta en el SQL Editor de Supabase las migraciones `supabase/migrations/20261022120000_admin_login_throttle.sql`, `supabase/migrations/20261022162100_client_login_throttle.sql` y `supabase/migrations/20261023120000_server_authoritative_licenses.sql`. Sin ellas, la autenticación o la gestión de licencias falla de forma segura. El inicio de sesión de clientes limita a cinco intentos por usuario y dirección IP cada 15 minutos; se guarda únicamente un HMAC y los intentos exitosos limpian el contador de esa combinación. Si olvidas el PIN administrativo, actualiza `ADMIN_PIN` en Vercel y crea un nuevo despliegue. No hay códigos maestros ni recuperación desde la aplicación.

Las licencias se autorizan consultando Supabase; ya no se confía en firmas generadas en el navegador ni se aceptan claves ausentes del registro. El servidor entrega un permiso offline Ed25519 de hasta 24 horas, ligado al dispositivo y al vencimiento del plan. `SUPABASE_SERVICE_ROLE_KEY` debe permanecer configurada solo en el servidor y no debe rotarse sin tener en cuenta que los permisos offline y credenciales de cuenta ya emitidos requerirán que los usuarios vuelvan a conectarse e iniciar sesión. Tras el cambio, los clientes con una sesión antigua creada localmente deberán iniciar sesión una vez con su usuario y PIN. Las claves FS anteriores solo continuarán funcionando si su registro está en `sportstats_licenses` en Supabase; si no aparecen en el panel, el administrador deberá emitir una clave nueva o el cliente podrá usar su cuenta.

Los PIN de clientes se guardan con hash scrypt y nunca se devuelven en el inicio de sesión ni en el listado administrativo. Para convertir de una sola vez los PIN antiguos que aún estén en texto en Supabase, configura `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en un `.env` local que no se publique y ejecuta `npm run migrate:legacy-client-pins`; el proceso migra en lotes, no imprime los PIN y puede ejecutarse de nuevo sin cambiar PIN ya protegidos. Los PIN antiguos también se actualizan a hash cuando su dueño inicia sesión correctamente. El mensaje prellenado de WhatsApp para solicitudes de registro ya no incluye el PIN. La autenticación de clientes requiere conexión al servidor; ya no se aceptan PIN guardados en caché local como alternativa offline.

---

## 🚀 Instalación y Ejecución Local

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/tu-usuario/sportstats-pro.git
   cd sportstats-pro
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Iniciar el entorno de desarrollo (Frontend + Backend unificados en el puerto 3000):**
   ```bash
   npm run dev
   ```

4. **Compilar para producción:**
   ```bash
   npm run build
   ```

---

## ☁️ Despliegue en Vercel

El proyecto incluye configuración nativa (`vercel.json` y `api/index.ts`) para desplegarse en un solo paso:

1. Sube este repositorio a tu cuenta de **GitHub**.
2. En **Vercel**, selecciona **Add New Project** e importa el repositorio.
3. Añade las variables de entorno listadas en la sección anterior (`ADMIN_PIN`, `ADMIN_SESSION_SECRET`, `ADMIN_WHATSAPP`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `API_FOOTBALL_KEY`, `FOOTBALL_DATA_KEY`, `ODDS_API_KEY`).
4. Haz clic en **Deploy**. Vercel compilará el cliente en `dist/` y desplegará la función Express de `api/index.ts` para las rutas `/api/*`.
5. Confirma que `API_FOOTBALL_KEY` esté configurada para el entorno **Production** en Vercel. Sin esta clave la API no puede consultar partidos y la aplicación mostrará un error en vez de inventar encuentros.
6. Después del despliegue, verifica `https://tu-dominio.vercel.app/api/health` (debe responder `{"status":"ok",...}`) y `/api/upcoming?date=YYYY-MM-DD`. Si `/api/health` responde con error 500, revisa los **Function Logs** de esa deployment en Vercel.

---

## 📄 Licencia y Uso Responsable

Software de uso privado y comercial bajo licencia de **SportStats Pro**.  
*Todas las proyecciones estadísticas representan estimaciones matemáticas basadas en datos históricos y rendimiento reciente; utilice las herramientas de gestión de bankroll con responsabilidad.*
