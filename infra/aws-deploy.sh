#!/usr/bin/env bash
#
# Compila el frontend y deja el build en la instancia EC2 del proyecto.
#
#   ./infra/aws-deploy.sh              compila y despliega
#   ./infra/aws-deploy.sh --sin-build  sube el dist/ que ya tengas
#
# El mismo script lo usa el pipeline de GitHub Actions, para que desplegar a
# mano y desplegar automaticamente hagan exactamente lo mismo.
#
# Como llega el build a la instancia: se empaqueta en una imagen minima de
# Docker, se sube a ECR y por SSM se arranca alli un contenedor de un solo uso
# que copia los ficheros al volumen que lee Caddy. Ni bucket intermedio ni
# claves SSH, y el mismo mecanismo que usa el backend.
#
# Requisito: la instancia tiene que existir ya. La crea el repositorio del
# backend con ./infra/aws-up.sh.

cd "$(dirname "$0")/.."
source infra/config.sh
source infra/lib.sh

CONSTRUIR=1
if [ "${1:-}" = "--sin-build" ]; then CONSTRUIR=0; fi

check_aws
need docker

INSTANCE_ID="$(find_instance)"
[ -n "$INSTANCE_ID" ] || die "no encuentro la instancia '$INSTANCE_NAME'. Crea la infraestructura desde el repositorio del backend: ./infra/aws-up.sh"

REPO_URI="$(ecr_uri)"
[ -n "$REPO_URI" ] || die "no encuentro el repositorio ECR '$ECR_REPO'. Crea la infraestructura desde el repositorio del backend: ./infra/aws-up.sh"

TAG="$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)"
if [ -n "$(git status --porcelain 2>/dev/null || true)" ]; then TAG="$TAG-dirty"; fi
IMAGE="$REPO_URI:$TAG"

log "Instancia $INSTANCE_ID, imagen $IMAGE"

# ---------------------------------------------------------------------------
# 1. Compilar
# ---------------------------------------------------------------------------
if [ "$CONSTRUIR" = "1" ]; then
  need npm
  # Vite congela VITE_API_URL dentro del bundle: el valor queda escrito en los
  # ficheros .js. Cambiarlo obliga a recompilar, no basta con tocar nada en AWS.
  log "Compilando con VITE_API_URL=$VITE_API_URL"
  if [ ! -d node_modules ]; then npm ci; fi
  VITE_API_URL="$VITE_API_URL" npm run build
  ok "build listo"
else
  skip "usando el dist/ existente"
fi

[ -d dist ] || die "no hay carpeta dist/. Ejecuta 'npm run build' o quita --sin-build."

# ---------------------------------------------------------------------------
# 2. Empaquetar y subir
# ---------------------------------------------------------------------------
log "Autenticando Docker contra ECR"
awsc ecr get-login-password | docker login --username AWS --password-stdin "${REPO_URI%%/*}"

# --platform explicito: la instancia es x86_64 y aqui se puede estar
# construyendo desde un portatil ARM.
log "Empaquetando el build en una imagen"
docker build --platform linux/amd64 -t "$IMAGE" -t "$REPO_URI:latest" .

log "Subiendo a ECR"
docker push "$IMAGE"
docker push "$REPO_URI:latest"
ok "imagen publicada"

# ---------------------------------------------------------------------------
# 3. Publicar en la instancia
# ---------------------------------------------------------------------------
# El intercambio se hace con dos mv dentro del mismo volumen, que son
# instantaneos: asi no hay un instante en que Caddy sirva un directorio a
# medio copiar y los usuarios vean 404.
ssm_run "$INSTANCE_ID" "publicar frontend $TAG" <<REMOTE
set -euo pipefail

aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS --password-stdin ${REPO_URI%%/*}

docker pull $IMAGE

docker run --rm -v $WEB_VOLUME:/srv $IMAGE sh -c '
  rm -rf /srv/.nuevo /srv/.viejo
  cp -a /dist /srv/.nuevo
  if [ -d /srv/www ]; then mv /srv/www /srv/.viejo; fi
  mv /srv/.nuevo /srv/www
  rm -rf /srv/.viejo
  echo "--- publicado ---"
  ls /srv/www
'

docker image prune -af --filter "until=168h" || true
REMOTE

# ---------------------------------------------------------------------------
# 4. Comprobar
# ---------------------------------------------------------------------------
log "Comprobando https://$APP_DOMAIN"
for intento in $(seq 1 12); do
  if curl -fsS --max-time 10 "https://$APP_DOMAIN" 2>/dev/null | grep -qi '<div id="root"'; then
    ok "la aplicacion responde en https://$APP_DOMAIN"
    exit 0
  fi
  skip "intento $intento/12, reintento en 10s"
  sleep 10
done

warn "https://$APP_DOMAIN no devolvio el index esperado."
warn "Si acabas de crear el DNS o el certificado, dale unos minutos."
warn "Para mirar los logs, desde el repositorio del backend: ./infra/logs.sh caddy"
exit 1
