from fastapi.testclient import TestClient
from sqlalchemy import select

from backend.database import make_engine, make_sessions
from backend.main import create_app
from backend.models import Encounter
from scripts.start_server import prepare_database


def test_production_serves_spa_and_assets_without_exposing_source(tmp_path, monkeypatch):
    dist = tmp_path / "web"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<html>OPD application</html>")
    (dist / "assets/app.js").write_text("const synthetic = true;")
    monkeypatch.setenv("FRONTEND_DIST", str(dist))
    monkeypatch.setenv("RENDER_EXTERNAL_URL", "https://opd-example.onrender.com")
    with TestClient(create_app(f"sqlite:///{tmp_path}/web.db")) as client:
        for path in ["/", "/intake"]:
            assert "OPD application" in client.get(path).text
        assert client.get("/assets/app.js").status_code == 200
        assert client.get("/.env").status_code == 404
        assert client.get("/api/v1/unknown").status_code == 404
        assert (
            client.post(
                "/api/v1/auth/logout", headers={"origin": "https://opd-example.onrender.com"}
            ).status_code
            == 200
        )
        assert (
            client.post(
                "/api/v1/auth/logout", headers={"origin": "https://untrusted.example"}
            ).status_code
            == 403
        )


def test_host_startup_seeds_once_and_keeps_existing_changes(tmp_path, monkeypatch):
    url = f"sqlite:///{tmp_path}/hosted.db"
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.setenv("SEED_DEMO_ON_EMPTY", "true")
    prepare_database()
    engine = make_engine(url)
    with make_sessions(engine)() as db:
        rows = list(db.scalars(select(Encounter)))
        assert len(rows) == 40
        eid = rows[0].encounter_id
        rows[0].unresolved = True
        db.commit()
    prepare_database()
    with make_sessions(engine)() as db:
        assert len(list(db.scalars(select(Encounter)))) == 40
        assert db.get(Encounter, eid).unresolved is True
    engine.dispose()
