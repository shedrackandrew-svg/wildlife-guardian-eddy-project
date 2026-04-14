# Wildlife Guardian (AI + IoT + Web)

This project is an end-to-end starter platform for:
- Detecting animals from external camera images and sensor events
- Triggering immediate alerts (Console, SMS/Twilio, GSM modem, LoRa/MQTT)
- Logging detections/alerts to a database
- Monitoring live detections in a web dashboard with browser-side AI feedback
- Managing species profiles in an admin console with one-file-per-animal storage
- Public live share page for read-only remote monitoring

## Why this can scale to more species

The backend uses open-vocabulary zero-shot classification (CLIP). Instead of hard-coding only a few animals, you can extend the list in `app/species_labels.txt` with any local wildlife names.

## Architecture

- `app/main.py`: FastAPI endpoints + static web app serving
- `app/detector.py`: Open-vocabulary image classifier
- `app/services/alerts.py`: Alert decision rules
- `app/services/notifiers.py`: SMS/GSM/LoRa dispatch adapters
- `app/models.py`: SQLAlchemy models for detections and alerts
- `app/static/`: dashboard (camera, local browser AI, telemetry)
- `data/animal_profiles/`: one JSON file per species (knowledge records)

## Quick start

1. Create and activate a Python virtual environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Create `.env` from the example:

```bash
copy .env.example .env
```

4. Run the API server:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

5. Open:

`http://localhost:8000`

Extra pages:

- Dashboard: `http://localhost:8000/`
- Admin Console: `http://localhost:8000/admin`
- Public Live Share: `http://localhost:8000/live`

## API endpoints

- `POST /api/detect/image`
  - Multipart form-data:
  - `file`: image file
  - `source`: text source id (example: `camera-1`)

- `POST /api/sensor`
  - JSON example:

```json
{
  "source_id": "radar-node-3",
  "values": {
    "distance_m": 37.5,
    "motion": true,
    "battery": 88
  }
}
```

- `GET /api/detections?limit=50`
- `GET /api/alerts?limit=50`
- `GET /api/animals?search=lion&limit=200`
- `GET /api/animals/{species}`
- `POST /api/admin/animals` (requires `x-admin-token` if `ADMIN_TOKEN` is configured)
- `DELETE /api/admin/animals/{species}` (requires `x-admin-token`)
- `POST /api/admin/bootstrap` (requires `x-admin-token`)

## Admin features

- Edit or create species profiles from `/admin`
- Delete species profile files
- Bootstrap profiles from `app/species_labels.txt`
- Optional admin protection with `ADMIN_TOKEN` in `.env`

Each species profile is stored as an individual JSON file under:

`data/animal_profiles/`

## Free hosting (recommended: Render)

This repo now includes `render.yaml` and `Procfile`.

1. Push this project to GitHub.
2. Create a new Render Web Service from the repo.
3. Render auto-detects `render.yaml` and builds the app.
4. After deploy, Render provides a public URL like:
  `https://your-service-name.onrender.com`

Use these paths on that URL:

- `/` for dashboard
- `/live` for public sharing
- `/admin` for profile management

## Quick share URL from your laptop (immediate)

If you need a quick public URL before cloud deploy:

1. Run your app locally.
2. Run a tunnel command (example with localhost.run):

```bash
ssh -R 80:localhost:8000 nokey@localhost.run
```

It will print a temporary public URL you can share instantly. This quick URL is not permanent.

## IoT integration notes

- SMS:
  - Set `ENABLE_SMS=true` and Twilio credentials in `.env`
- GSM modem:
  - Set `ENABLE_GSM=true` and `GSM_SERIAL_PORT=COMx`
- LoRa gateway via MQTT bridge:
  - Set `ENABLE_LORA=true` and broker/topic values

## Production upgrades you should add next

- Replace single-image classification with detection + tracking model (e.g., OWL-ViT + ByteTrack)
- Add map view and geofencing
- Add role-based auth for dashboard access
- Add retries/dead-letter queue for failed notifications
- Add model distillation/quantization for edge devices

## Optional custom model training (recommended)

If you have labeled wildlife images, train a local detector:

```bash
python scripts/train_yolo.py --data path/to/dataset.yaml --epochs 80 --model yolo11n.pt
```

Then expose the trained detector in the API (swap `app/detector.py` implementation).

## Important limitation

No single model can perfectly identify every animal species. This starter is designed for practical deployment with an extensible species list and can be upgraded with stronger models as you collect local data.
