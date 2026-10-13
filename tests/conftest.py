from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from backend.auth import seed_staff
from backend.main import create_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "disabled")
    # Tests never use a developer's real credential.
    monkeypatch.setenv("OPENAI_API_KEY", "test-key-never-send")
    monkeypatch.setenv("GROQ_API_KEY", "test-key-never-send")
    app = create_app(f"sqlite:///{tmp_path / 'test.db'}")
    with TestClient(app) as client:
        with app.state.sessions() as db:
            seed_staff(db)
            db.commit()
        yield client


def login(client, role="nurse"):
    response = client.post(
        "/api/v1/auth/login", json={"username": role, "password": "DemoOnly!2026"}
    )
    assert response.status_code == 200, response.text


def intake(**updates):
    return {
        "request_id": str(uuid4()),
        "name": "Synthetic Example",
        "age_years": 40,
        "original_text": "New concern",
        "confirmed_text": "New concern",
        **updates,
    }


def create_patient(client, **updates):
    response = client.post("/api/v1/encounters", json=intake(**updates))
    assert response.status_code == 201, response.text
    token = response.json()["token"]
    return next(
        p for p in client.get("/api/v1/dashboard").json()["original_queue"] if p["token"] == token
    )
