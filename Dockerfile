# Imagen del frontend: solo transporta el build.
#
# No sirve nada por si misma. El despliegue arranca un contenedor de un solo
# uso a partir de ella, copia /dist al volumen que lee Caddy en la instancia y
# el contenedor muere. Es una forma de mover ficheros que reutiliza el ECR y el
# SSM que ya usa el backend, sin bucket intermedio ni claves SSH.
FROM alpine:3

COPY dist /dist
