FROM node:22.22.1-bookworm-slim AS builder

WORKDIR /app

ARG VITE_ENABLE_TEST_FEATURES=false
ENV VITE_ENABLE_TEST_FEATURES=$VITE_ENABLE_TEST_FEATURES

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


FROM nginx:stable-alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
