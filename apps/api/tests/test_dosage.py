from datetime import date

from dosage import compute_recommendations
from main import WATER_PARAMS
from models import Installation


def make_installation(**kwargs) -> Installation:
    defaults = dict(user_id=1, type="pool", sanitizer="chlorine", volume=10000, volume_unit="L")
    defaults.update(kwargs)
    return Installation(**defaults)


def current_of(**values) -> dict:
    return {field: {"value": v, "date": date.today(), "unit": None} for field, v in values.items()}


def ranges_for(installation: Installation) -> dict:
    return WATER_PARAMS[(installation.type, installation.sanitizer)]


def test_salt_raise_is_stoichiometric():
    # PoolMath's rule of thumb: 8.34 lb of salt per 1000 US gal raises salt by 1000 ppm.
    # In metric terms that's ~1000 g per 1000 L per 1000 ppm -- exactly our dose rate.
    installation = make_installation(sanitizer="salt", volume=1000, volume_unit="L")
    ranges = ranges_for(installation)
    current = current_of(salt=2000, ph=7.4, stabilizer=70, chlorine=4.0)
    recs = compute_recommendations(current, ranges, installation)
    salt_rec = next(r for r in recs if r["param"] == "salt")
    assert salt_rec["direction"] == "raise"
    option = salt_rec["options"][0]
    assert option["product_id"] == "pool_salt"
    # target midpoint of ideal (2700, 3400) = 3050; delta = 1050 ppm over 1000 L
    assert option["amount_grams"] == 1050.0


def test_tac_raise_baking_soda():
    installation = make_installation(sanitizer="bromine", volume=1000, volume_unit="L")
    ranges = ranges_for(installation)
    current = current_of(tac=50, ph=7.4, bromine=3.0)
    recs = compute_recommendations(current, ranges, installation)
    tac_rec = next(r for r in recs if r["param"] == "tac")
    assert tac_rec["direction"] == "raise"
    # ideal midpoint (80, 180) = 130; delta = 80 ppm; 17.5g / 10ppm / 1000L * 80/10 * 1 = 140.0g
    assert tac_rec["options"][0]["amount_grams"] == 140.0
    assert tac_rec["options"][0]["exact"] is True


def test_ph_raise_soda_ash_tagged_approximate():
    installation = make_installation(sanitizer="chlorine", volume=1000, volume_unit="L")
    ranges = ranges_for(installation)
    current = current_of(ph=6.5, chlorine=2.0, tac=100)
    recs = compute_recommendations(current, ranges, installation)
    ph_rec = next(r for r in recs if r["param"] == "ph")
    assert ph_rec["direction"] == "raise"
    option = ph_rec["options"][0]
    assert option["product_id"] == "soda_ash"
    assert option["notes_key"] == "dosage_ph_approximate"
    assert option["amount_grams"] is not None


def test_ph_lower_muriatic_acid_tagged_ta_side_effect():
    installation = make_installation(sanitizer="chlorine", volume=1000, volume_unit="L")
    ranges = ranges_for(installation)
    current = current_of(ph=8.2, chlorine=2.0, tac=100)
    recs = compute_recommendations(current, ranges, installation)
    ph_rec = next(r for r in recs if r["param"] == "ph")
    assert ph_rec["direction"] == "lower"
    exact_option = next(o for o in ph_rec["options"] if o["exact"])
    assert exact_option["product_id"] == "muriatic_acid"
    assert exact_option["notes_key"] == "dosage_ph_lowers_ta_too"
    assert exact_option["amount_ml"] is not None
    inexact_option = next(o for o in ph_rec["options"] if not o["exact"])
    assert inexact_option["notes_key"] == "dosage_follow_label"
    assert inexact_option["amount_grams"] is None


def test_missing_volume_returns_none_amounts_without_error():
    installation = make_installation(sanitizer="bromine", volume=None)
    ranges = ranges_for(installation)
    current = current_of(tac=50, ph=7.4, bromine=3.0)
    recs = compute_recommendations(current, ranges, installation)
    assert recs  # still generated
    tac_rec = next(r for r in recs if r["param"] == "tac")
    assert tac_rec["volume_known"] is False
    assert tac_rec["options"][0]["amount_grams"] is None


def test_in_range_param_excluded():
    installation = make_installation(sanitizer="bromine", volume=1000, volume_unit="L")
    ranges = ranges_for(installation)
    current = current_of(ph=7.4, bromine=3.0, tac=100, temp=26, hardness=300)
    recs = compute_recommendations(current, ranges, installation)
    assert recs == []


def test_salt_pool_chlorine_uses_swg_guidance_not_product():
    installation = make_installation(sanitizer="salt", volume=1000, volume_unit="L")
    ranges = ranges_for(installation)
    current = current_of(ph=7.4, salt=3000, stabilizer=70, chlorine=1.0)
    recs = compute_recommendations(current, ranges, installation)
    cl_rec = next(r for r in recs if r["param"] == "cl")
    assert cl_rec["direction"] == "raise"
    option = cl_rec["options"][0]
    assert option["product_id"] is None
    assert option["notes_key"] == "dosage_increase_swg_runtime"


def test_high_salt_is_guidance_only_dilution():
    installation = make_installation(sanitizer="salt", volume=1000, volume_unit="L")
    ranges = ranges_for(installation)
    current = current_of(ph=7.4, salt=5000, stabilizer=70, chlorine=4.0)
    recs = compute_recommendations(current, ranges, installation)
    salt_rec = next(r for r in recs if r["param"] == "salt")
    assert salt_rec["direction"] == "lower"
    option = salt_rec["options"][0]
    assert option["product_id"] is None
    assert option["notes_key"] == "dosage_dilution_required"
