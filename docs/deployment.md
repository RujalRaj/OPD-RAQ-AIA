# Public demo deployment

The Docker image includes the React production build and FastAPI. Both are served on the same origin. API keys stay on the server. `scripts.start_server` creates staff accounts and seeds the curated queue only when the database is empty.

## Render

1. Create a **Web Service** from this repository, or use its `render.yaml` Blueprint.
2. Select **Docker** and the **Free** instance for the synthetic hackathon demo.
3. Set these environment variables:

| Variable | Value |
| --- | --- |
| `AI_PROVIDER` | `groq` |
| `GROQ_MODEL` | `openai/gpt-oss-120b` |
| `GROQ_API_KEY` | Your private Groq key |
| `DATABASE_URL` | `sqlite:///./data/opd.db` |
| `SEED_DEMO_ON_EMPTY` | `true` |
| `COOKIE_SECURE` | `true` |

4. Use `/api/v1/health` for the health check. Render supplies `PORT` and `RENDER_EXTERNAL_URL`; the app uses them for serving and the allowed browser origin.
5. Deploy. Check the landing page, staff login, the 3/7/30 queue and a bilingual patient report. The health endpoint reports configuration only; test a synthetic model request to confirm a working provider connection.

Render free instances sleep after inactivity and have an ephemeral filesystem. SQLite changes can disappear after restarts or redeployments; a new empty instance starts from the curated demo queue. This is suitable only for the synthetic demonstration. For persistent hosting, configure a persistent disk and set `DATABASE_URL` to a SQLite file on that disk. Do not run multiple replicas against separate SQLite files.

[Render free-service limits](https://render.com/docs/free) · [Render web services](https://render.com/docs/web-services)

## Other Docker hosts

Set the same environment variables, plus `PUBLIC_BASE_URL=https://your-public-host`. Use a single application process and attach persistent storage if you need to keep records. Never bake `.env` or a local database into the image.

Local Docker example, after creating `.env`:

```sh
docker build -t opd-raq-aia .
docker run --rm -p 8000:10000 --env-file .env -e PORT=10000 -e SEED_DEMO_ON_EMPTY=true -v opd-data:/app/data opd-raq-aia
```

Open `http://localhost:8000`. Local HTTP requires `COOKIE_SECURE=false`; public HTTPS requires `true`.
