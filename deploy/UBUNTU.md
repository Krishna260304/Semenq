# Ubuntu server deployment

Install Docker Engine and the Compose plugin, copy the project to `/opt/semenq`,
and create `backend/.env` with the production secrets. Set the public server
host/domain in `ALLOWED_HOSTS` (for example
`["semenq.example.com", "203.0.113.10", "localhost"]`). Then run:

```bash
sudo cp deploy/semenq.service /etc/systemd/system/semenq.service
sudo systemctl daemon-reload
sudo systemctl enable --now docker
sudo systemctl enable --now semenq.service
```

The service starts the complete stack after every server reboot. Container
health checks wait for MongoDB and Redis before starting the API and worker,
and Docker's `restart: always` policy brings containers back after a crash.

For a CPU-only Ubuntu host:

```bash
cd /opt/semenq
sudo docker compose up -d --build
```

For an NVIDIA host with the NVIDIA Container Toolkit installed:

```bash
cd /opt/semenq
sudo docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d --build
```

Check startup with:

```bash
sudo docker compose ps
curl http://127.0.0.1:8083/api/healthz
```
