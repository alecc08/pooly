import os
import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine, select
from sqlmodel.pool import StaticPool

import database

os.environ.setdefault("SESSION_SECRET", "test-secret")
os.environ.setdefault("ADMIN_EMAIL", "admin@example.com")
os.environ.setdefault("ADMIN_PASSWORD", "admin123")

from main import app, limiter, _hash_password  # noqa: E402
from models import User  # noqa: E402


@pytest.fixture(name="client")
def client_fixture():
    limiter.reset()
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(test_engine)

    def get_session_override():
        with Session(test_engine) as session:
            yield session

    app.dependency_overrides[database.get_session] = get_session_override
    with Session(test_engine) as session:
        existing = session.exec(select(User).where(User.email == "admin@example.com")).first()
        if not existing:
            user = User(email="admin@example.com", password_hash=_hash_password("admin123"))
            session.add(user)
            session.commit()
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()
