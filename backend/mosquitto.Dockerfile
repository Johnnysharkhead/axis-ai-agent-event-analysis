FROM eclipse-mosquitto:2.0
 
# Base image is Alpine, so use apk instead of apt
RUN apk update && \
    apk add --no-cache mosquitto mosquitto-clients