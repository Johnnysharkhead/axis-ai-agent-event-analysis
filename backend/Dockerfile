FROM python:3.11-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ffmpeg \
      libglib2.0-0 libgl1 libsm6 libxext6 libxrender1 \
 && rm -rf /var/lib/apt/lists/*


WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD ["flask", "run", "--host=0.0.0.0"]
