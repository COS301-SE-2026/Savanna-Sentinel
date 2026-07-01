FROM node:24-alpine AS dev

WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]


FROM node:24-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

ARG VITE_API_URL=/v1
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build


FROM nginx:stable-alpine AS prod

RUN addgroup -g 10001 sentinel && \
    adduser -G sentinel -u 10001 -D -H sentinel && \
    chown -R sentinel:sentinel /usr/share/nginx/html && \
    chown -R sentinel:sentinel /usr/cache/nginx && \
    chown -R sentinel:sentinel /var/log/nginx && \
    chown -R sentinel:sentinel /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown sentinel:sentinel /var/run/nginx.pid

COPY --from=build /app/web-build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

USER sentinel

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
