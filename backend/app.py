import os
import sys
import uvicorn
from dotenv import load_dotenv

# Ensure the root backend directory is in the python path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Load environment variables from .env if present
load_dotenv(os.path.join(backend_dir, ".env"))

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    reload = os.getenv("RELOAD", "false").lower() in ("true", "1", "yes")

    print("Running database migrations for local development...")
    from alembic import command
    from alembic.config import Config
    alembic_cfg = Config(os.path.join(backend_dir, "alembic.ini"))
    command.upgrade(alembic_cfg, "head")

    uvicorn.run("app.main:socket_app", host=host, port=port, reload=reload)
