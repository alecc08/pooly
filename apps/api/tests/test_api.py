from fastapi.testclient import TestClient


def login(client: TestClient):
    r = client.post(
        "/auth/login",
        json={"email": "admin@example.com", "password": "admin123"},
    )
    assert r.status_code == 200


def test_health(client: TestClient):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_get_products_empty(client: TestClient):
    login(client)
    r = client.get("/products")
    assert r.status_code == 200
    assert r.json() == []


def test_get_actions_empty(client: TestClient):
    login(client)
    r = client.get("/actions")
    assert r.status_code == 200
    assert r.json() == []


def test_create_action_structured(client: TestClient):
    login(client)
    payload = {
        "date": "2026-02-24",
        "action_type": "Ajout de chlore",
        "product_id": None,
        "qty": "60",
        "unit": "g",
        "notes": "",
    }
    r = client.post("/actions", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["action_type"] == "Ajout de chlore"
    assert data["qty"] == "60"
    assert data["unit"] == "g"
    assert data["product_id"] is None
    assert "id" in data
    assert "created_at" in data


def test_list_actions_returns_structured(client: TestClient):
    login(client)
    client.post("/actions", json={"date": "2026-02-24", "action_type": "Test", "notes": "note"})
    r = client.get("/actions")
    actions = r.json()
    assert len(actions) == 1
    assert actions[0]["action_type"] == "Test"
    assert actions[0]["notes"] == "note"


def test_delete_action(client: TestClient):
    login(client)
    r = client.post("/actions", json={"date": "2026-02-24", "action_type": "A supprimer", "notes": ""})
    action_id = r.json()["id"]
    del_r = client.delete(f"/actions/{action_id}")
    assert del_r.status_code == 204
    assert client.get("/actions").json() == []


def test_delete_action_not_found(client: TestClient):
    login(client)
    r = client.delete("/actions/999")
    assert r.status_code == 404


# ── Installations / sanitizer ───────────────────────────────────────────────

def test_create_installation_sel_sanitizer(client: TestClient):
    login(client)
    r = client.post(
        "/installations",
        json={"name": "Piscine sel", "type": "piscine", "sanitizer": "sel"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["sanitizer"] == "sel"
    assert data["type"] == "piscine"
    assert data["name"] == "Piscine sel"


def test_patch_installation_sanitizer_to_sel(client: TestClient):
    login(client)
    r = client.post(
        "/installations",
        json={"name": "Ma piscine", "type": "piscine", "sanitizer": "chlore"},
    )
    installation_id = r.json()["id"]
    patch_r = client.patch(
        f"/installations/{installation_id}",
        json={"sanitizer": "sel"},
    )
    assert patch_r.status_code == 200
    assert patch_r.json()["sanitizer"] == "sel"


def test_get_installation_params_piscine_sel(client: TestClient):
    login(client)
    r = client.post(
        "/installations",
        json={"name": "Piscine sel", "type": "piscine", "sanitizer": "sel"},
    )
    installation_id = r.json()["id"]
    params_r = client.get(f"/installations/{installation_id}/params")
    assert params_r.status_code == 200
    params = params_r.json()
    assert params["salt"]["ideal"] == [2700, 3400]
    assert params["cya"]["ideal"] == [60, 80]
    assert "cc" in params


def test_get_installation_params_spa_sel(client: TestClient):
    login(client)
    r = client.post(
        "/installations",
        json={"name": "Spa sel", "type": "spa", "sanitizer": "sel"},
    )
    installation_id = r.json()["id"]
    params_r = client.get(f"/installations/{installation_id}/params")
    assert params_r.status_code == 200
    params = params_r.json()
    assert params["temp"]["ideal"] == [36, 40]
    assert params["salt"]["ideal"] == [2500, 3200]
    assert params["cya"]["ideal"] == [30, 50]


def test_get_installation_params_chlore_includes_cc(client: TestClient):
    login(client)
    r = client.post(
        "/installations",
        json={"name": "Piscine chlore", "type": "piscine", "sanitizer": "chlore"},
    )
    installation_id = r.json()["id"]
    params_r = client.get(f"/installations/{installation_id}/params")
    assert "cc" in params_r.json()


def test_get_installation_params_brome_excludes_cc(client: TestClient):
    login(client)
    r = client.post(
        "/installations",
        json={"name": "Piscine brome", "type": "piscine", "sanitizer": "brome"},
    )
    installation_id = r.json()["id"]
    params_r = client.get(f"/installations/{installation_id}/params")
    params = params_r.json()
    assert "cc" not in params
    assert "cya" not in params


def test_get_installation_params_unknown_sanitizer_returns_empty(client: TestClient):
    login(client)
    r = client.post(
        "/installations",
        json={"name": "Mystere", "type": "piscine", "sanitizer": "inconnu"},
    )
    installation_id = r.json()["id"]
    params_r = client.get(f"/installations/{installation_id}/params")
    assert params_r.status_code == 200
    assert params_r.json() == {}


def test_create_installation_with_volume(client: TestClient):
    login(client)
    r = client.post(
        "/installations",
        json={"name": "Ma piscine", "volume": 45000, "volume_unit": "L"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["volume"] == 45000
    assert data["volume_unit"] == "L"


def test_create_installation_without_volume_defaults_null(client: TestClient):
    login(client)
    r = client.post("/installations", json={"name": "Ma piscine"})
    assert r.status_code == 200
    data = r.json()
    assert data["volume"] is None
    assert data["volume_unit"] == "L"


def test_patch_installation_volume(client: TestClient):
    login(client)
    r = client.post("/installations", json={"name": "Ma piscine"})
    installation_id = r.json()["id"]
    patch_r = client.patch(
        f"/installations/{installation_id}",
        json={"volume": 60000, "volume_unit": "gal"},
    )
    assert patch_r.status_code == 200
    data = patch_r.json()
    assert data["volume"] == 60000
    assert data["volume_unit"] == "gal"
