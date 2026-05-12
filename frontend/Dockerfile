FROM node:18-alpine AS build-stage

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

#Generate with the pwa settings
RUN npm run build:pwa

#Start new nginx environment now that everything has been compiled
FROM nginx:stable-alpine

#Grab the compiled files
COPY --from=build-stage /app/web-build /usr/share/nginx/html

#MIGHT HAVE TO BE UPDATED TO HTTPS LATER, but for now uses HTTP port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
