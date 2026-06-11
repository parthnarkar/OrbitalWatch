#!/bin/sh
set -e

echo "Running Alembic Migrations..."
alembic upgrade head

echo "Starting Gunicorn Server..."
exec gunicorn app.main:socket_app --workers ${WEB_CONCURRENCY:-1} --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT:-8000}
