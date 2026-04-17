# Use the latest official Python image
FROM python:3.12-slim

# Install required system dependencies
RUN apt-get update && apt-get install -y \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create working directory
WORKDIR /app

# Upgrade pip
RUN python -m pip install --upgrade pip

# Install the released titiler packages from PyPI (pins compatible deps)
# Using the project meta version 0.22.4 from the vendored source pyproject
RUN python -m pip install "titiler[application,mosaic]==0.22.4" uvicorn

# Default command
CMD ["uvicorn", "titiler.application.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--root-path", "/map"]

