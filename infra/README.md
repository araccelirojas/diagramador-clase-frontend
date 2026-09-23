# Despliegue del frontend en AWS

Aqui solo esta el despliegue. **La infraestructura la crea el repositorio del
backend**, en `diagramador-backend/infra/aws-up.sh`: una unica instancia EC2
que sirve las dos aplicaciones bajo el mismo dominio. Si la instancia no
existe, este script te lo dira y no hara nada.

## Donde acaba el build

```
              galflabs.tech
                    |
        +-----------v------------+   EC2, contenedor de Caddy
        |  /api/*       -> app   |
        |  /socket.io/* -> app   |
        |  todo lo demas-> /srv/www
        +-----------^------------+
                    |
              volumen "web"
                    ^
                    |  contenedor de un solo uso que copia y muere
                    |
              imagen en ECR con el dist/ dentro
```

El build viaja empaquetado en una imagen minima de Docker. El despliegue la
sube a ECR y, por SSM, arranca en la instancia un contenedor que copia `/dist`
al volumen que lee Caddy. Es una forma de mover ficheros que reutiliza el ECR y
el SSM que ya usa el backend: sin bucket intermedio, sin claves SSH y sin
abrir el puerto 22.

La copia no se hace encima de lo que hay. Se copia a un directorio nuevo y se
intercambian con dos `mv` dentro del mismo volumen, que son instantaneos: no
hay un momento en que Caddy sirva un directorio a medio copiar.

## Mismo origen que la API

El frontend se compila con `VITE_API_URL=/api`, una ruta relativa. Eso hace que
el navegador resuelva la API contra el mismo host desde el que cargo la pagina,
y a partir de ahi desaparecen tres cosas: la configuracion de CORS, los
preflights y el riesgo de que el handshake de Socket.IO se rechace por el
`Origin`. [useCollaboration.ts](../src/sync/useCollaboration.ts) deriva la URL
del socket quitandole el sufijo `/api`, y socket.io interpreta la cadena vacia
resultante como "mismo origen", que es justo lo que queremos.

## Requisitos

| Herramienta | Para que | Como |
|---|---|---|
| AWS CLI v2 | hablar con AWS | https://aws.amazon.com/cli/ y luego `aws configure` |
| Docker | empaquetar el build | Docker Desktop, arrancado |
| Node 22 | compilar | https://nodejs.org |
| Git Bash | ejecutar el script en Windows | viene con Git para Windows |

En Windows, abre el script desde **Git Bash**, no desde PowerShell ni CMD.

## Uso

```bash
./infra/aws-deploy.sh              # compila y despliega
./infra/aws-deploy.sh --sin-build  # sube el dist/ que ya tengas
```

Para cambiar a que API apunta el bundle:

```bash
VITE_API_URL=https://otro.dominio/api ./infra/aws-deploy.sh
```

Vite sustituye `import.meta.env.VITE_API_URL` en tiempo de compilacion: el
valor queda escrito dentro de los ficheros `.js`. Cambiarlo obliga a recompilar
y volver a desplegar, no basta con tocar nada en AWS.

## Pipeline

`.github/workflows/deploy.yml` se dispara en cada push a `main`: lint, tipos y
pruebas primero, y si todo pasa llama a `infra/aws-deploy.sh`. Es el mismo
script que usas en local, para que desplegar a mano y desplegar desde el
pipeline hagan exactamente lo mismo.

Es un pipeline independiente del backend. Los dos despliegan a la misma
instancia pero tocan cosas distintas —el backend reinicia contenedores, este
escribe en el volumen—, asi que no se pisan y no hace falta coordinarlos. La
unica excepcion es la primera vez: el backend tiene que haber desplegado antes,
porque es quien envia el `docker-compose.yml` y crea el volumen. Asegurate de
hacer el primer push a `main` en el backend y esperar a que su pipeline
termine, antes del primer push aqui.

### Secretos (Settings > Secrets and variables > Actions > Secrets)

| Secreto | Que es |
|---|---|
| `AWS_ACCESS_KEY_ID` | credenciales del usuario IAM de despliegue |
| `AWS_SECRET_ACCESS_KEY` | idem |

Es la misma access key que el repositorio del backend; la politica IAM esta
documentada alli. El frontend no tiene mas secretos, y no debe tenerlos: todo
lo que entra en el bundle es publico por definicion, lo lee cualquiera con el
inspector del navegador. Las claves de verdad viven en el backend.

### Variables (la pestana Variables, al lado de Secrets)

Opcionales, todas tienen valor por defecto:

| Variable | Por defecto |
|---|---|
| `AWS_REGION` | `us-east-1` |
| `APP_DOMAIN` | `galflabs.tech` |
| `VITE_API_URL` | `/api` |

Si cambias `APP_DOMAIN`, cambialo tambien en el repositorio del backend.

## Cuando algo falla

**"no encuentro la instancia".** La infraestructura no existe todavia, o su
nombre no coincide. Ejecuta `infra/aws-up.sh` desde el repositorio del backend;
si ya existe, comprueba que `PROJECT` es el mismo en los dos `infra/config.sh`.

**El sitio devuelve 404 en todo.** El volumen esta vacio: o el despliegue no
llego a copiar, o Caddy no arranco. Desde el repositorio del backend:
`./infra/logs.sh caddy`.

**404 solo al recargar en una ruta interna.** Eso lo resuelve el `try_files`
del Caddyfile, que envia el backend. Repite el despliegue del backend.

**Sigo viendo la version vieja.** Los ficheros de `assets/` se sirven con cache
de un ano, pero llevan hash en el nombre, asi que un build nuevo genera nombres
nuevos. `index.html` se sirve con `no-cache`. Si aun asi persiste, prueba una
recarga forzada; si sigue, comprueba que el despliegue termino sin errores.
