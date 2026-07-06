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
