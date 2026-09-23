#!/usr/bin/env bash
# Ajustes del despliegue del frontend.
#
# La infraestructura (la instancia EC2, el dominio, la base) la crea el
# repositorio del backend con su infra/aws-up.sh. Aqui solo esta lo necesario
# para dejar el build en esa instancia, asi que estos valores TIENEN que
# coincidir con los de alli.

PROJECT="${PROJECT:-diagramador}"
STACK="${STACK:-${PROJECT}-frontend}"

AWS_REGION="${AWS_REGION:-us-east-1}"

# Dominio unico del proyecto: la aplicacion en / y la API en /api.
APP_DOMAIN="${APP_DOMAIN:-galflabs.tech}"

# Ruta relativa a proposito. Al compartir origen con la API, el navegador
# resuelve /api contra el mismo host desde el que cargo la pagina: no hay CORS,
# ni preflights, ni una URL absoluta que quede obsoleta si cambia el dominio.
VITE_API_URL="${VITE_API_URL:-/api}"

# Tiene que ser el mismo nombre de instancia que usa el backend (su
# INSTANCE_NAME), porque es donde se deposita el build.
INSTANCE_NAME="${INSTANCE_NAME:-${PROJECT}}"

# Y el mismo repositorio de ECR que el backend crea para el frontend.
ECR_REPO="${ECR_REPO:-${PROJECT}-frontend}"

# El volumen de Docker que lee Caddy. Es el punto de encuentro entre los dos
# despliegues: el backend lo declara en su docker-compose.yml y aqui se escribe.
WEB_VOLUME="${WEB_VOLUME:-${PROJECT}_web}"

TAG_KEY="Project"
TAG_VALUE="${PROJECT}"
