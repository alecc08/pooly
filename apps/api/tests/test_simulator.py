import pytest

from simulator import simulate_dosage, simulate_heating_energy


def test_simulate_dosage_tac_raise_baking_soda():
    # Same stoichiometry as test_dosage.py's test_tac_raise_baking_soda, but driven by
    # freestyle inputs instead of a stored installation reading.
    result = simulate_dosage("tac", current_value=50, target_value=130, volume_L=1000, sanitizer="bromine")
    assert result["direction"] == "raise"
    assert result["options"][0]["amount_grams"] == 140.0
    assert result["options"][0]["exact"] is True


def test_simulate_dosage_salt_raise_is_stoichiometric():
    result = simulate_dosage("salt", current_value=2000, target_value=3050, volume_L=1000, sanitizer="salt")
    assert result["direction"] == "raise"
    assert result["options"][0]["amount_grams"] == 1050.0


def test_simulate_dosage_lower_direction():
    result = simulate_dosage("ph", current_value=8.2, target_value=7.4, volume_L=1000, sanitizer="chlorine")
    assert result["direction"] == "lower"
    exact_option = next(o for o in result["options"] if o["exact"])
    assert exact_option["product_id"] == "muriatic_acid"
    assert exact_option["amount_ml"] is not None


def test_simulate_dosage_salt_pool_chlorine_uses_swg_guidance():
    result = simulate_dosage("cl", current_value=1.0, target_value=4.0, volume_L=1000, sanitizer="salt")
    assert result["direction"] == "raise"
    option = result["options"][0]
    assert option["product_id"] is None
    assert option["notes_key"] == "dosage_increase_swg_runtime"


def test_simulate_dosage_dilution_guidance_only():
    result = simulate_dosage("salt", current_value=5000, target_value=3050, volume_L=1000, sanitizer="salt")
    assert result["direction"] == "lower"
    option = result["options"][0]
    assert option["product_id"] is None
    assert option["notes_key"] == "dosage_dilution_required"


def test_simulate_dosage_same_value_raises():
    with pytest.raises(ValueError):
        simulate_dosage("ph", current_value=7.4, target_value=7.4, volume_L=1000, sanitizer="chlorine")


def test_simulate_dosage_unsupported_param_raises():
    with pytest.raises(ValueError):
        simulate_dosage("temp", current_value=20, target_value=28, volume_L=1000, sanitizer="chlorine")


def test_simulate_heating_energy_matches_hand_calc():
    # 10,000 L raised 5C at 90% efficiency ~= 64.6 kWh.
    result = simulate_heating_energy(volume_L=10000, current_temp_c=20, target_temp_c=25, efficiency=0.9)
    assert result["kwh"] == pytest.approx(64.6, abs=0.1)
    assert result["delta_temp_c"] == 5
    assert result["efficiency"] == 0.9


def test_simulate_heating_energy_negative_delta_for_cooling():
    result = simulate_heating_energy(volume_L=1000, current_temp_c=30, target_temp_c=28)
    assert result["kwh"] < 0
    assert result["delta_temp_c"] == -2
