#!/bin/bash
set -e
echo "Applying database migrations..."
alembic upgrade head
echo "Starting ASGI application..."
exec uvicorn app.main:socket_app --host 0.0.0.0 --port ${PORT:-8000} --workers ${WEB_CONCURRENCY:-1}
