# OrbitalWatch Backend

FastAPI backend for satellite catalog ingestion, SGP4 propagation, conjunction alerts, and Socket.IO live position streaming.

## Setup

```bash
cp .env.example .env
docker compose up -d
```

## Development

### Run Locally:
```bash
python app.py
```

### Run using Docker Compose:
```bash
docker compose -f docker-compose.dev.yml up
```

## Useful URLs

- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/health
- Satellites: http://localhost:8000/api/satellites
- ISS propagation: http://localhost:8000/api/propagate/25544

## Verification

With the backend running:

```bash
python verify_backend.py
```
