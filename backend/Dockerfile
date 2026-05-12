FROM python:3.11-slim

# ENV variables setting
#Prevents pyc files from being generated, since it bloats the container.
ENV PYTHONDONTWRITEBYTECODE=1
#Prevents buffered output for better error handling.
ENV PYTHONBUFFERED=1

WORKDIR /app

#Download build essentials for gcc tools, needed to compile certain libaries, and cleans up the image by removing the package list
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

#Package list
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

#Creates a non root user to run the application for security
RUN useradd -m myuser
#Sets the user
USER myuser

EXPOSE 8000

#uvicorn run command for now, if more workers are needed we can combine aspects
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
