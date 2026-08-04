# Backend

Run the API from this directory with the bundled virtual environment:

```powershell
.\run.ps1
```

That launcher prefers `backend/.venv` automatically, so it avoids the `ModuleNotFoundError: No module named 'beanie'` error that happens when the global Python installation is used instead.

If you want to start without auto-reload:

```powershell
.\run.ps1 -NoReload
```

## OCR and deployment

Prescription scanning uses `PaddleOCRVL(pipeline_version="v1.6")`. Install
the dependencies in `requirements.txt` before starting the API; the model is
downloaded on its first scan. Set `SEMENQ_OCR_DEVICE=cpu` when no CUDA GPU is
available (GPU is selected automatically when Paddle detects it).

In Docker, open the frontend port (`8083` by default). Nginx now proxies
`/api` and WebSockets to the backend so the browser and API remain
on one origin. Set `PUBLIC_BASE_URL` only when the backend is directly exposed;
leave it empty behind that proxy.

## Ubuntu server hosting (GPU)

This repo now includes a GPU container override for OCR:

- Base stack: `docker-compose.yml`
- GPU override: `docker-compose.gpu.yml`
- GPU backend image: `backend/Dockerfile.gpu`

On Ubuntu, install Docker Engine + Docker Compose plugin + NVIDIA Container Toolkit,
then run:

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d --build
```

The GPU override sets:

- `ML_DEVICE=cuda`
- `SEMENQ_OCR_DEVICE=cuda`
- `gpus: all` for both API and Celery worker

Verify GPU visibility inside the backend container:

```bash
docker compose exec backend python3 -c "import paddle; print(paddle.device.is_compiled_with_cuda(), paddle.device.get_device())"
```

If OCR still reports CPU, inspect backend logs for `PaddleOCR worker ready`.
It now prints the OCR engine and selected device at worker startup.
