FROM python:3.11-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY app.py ./

RUN useradd -m -u 1000 orbital && chown -R orbital:orbital /app
USER orbital

EXPOSE 8000

CMD ["python", "app.py"]
