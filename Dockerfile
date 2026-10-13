FROM node:24-bookworm-slim AS frontend
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=10000
WORKDIR /app
COPY backend/requirements-lock.txt ./backend/requirements-lock.txt
RUN pip install --no-cache-dir -r backend/requirements-lock.txt
COPY backend/ ./backend/
COPY scripts/ ./scripts/
COPY --from=frontend /build/frontend/dist ./frontend/dist/
RUN useradd --create-home app && mkdir -p /app/data && chown -R app:app /app
USER app
EXPOSE 10000
CMD ["python", "-m", "scripts.start_server"]
