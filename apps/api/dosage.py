# apps/api/dosage.py
#
# Pure-function dosage-recommendation engine (issue #16). Given already-fetched
# current readings (water_params.extract_current_conditions) and effective
# ranges (main.py's WATER_PARAMS + _merge_range_overrides), works out what to
# add — and how much, when the installation's volume is known — to bring an
# out-of-band parameter back toward its ideal midpoint. No DB access, so it's
# trivially unit-testable in isolation from FastAPI/SQLModel.
from typing import Dict, List, Optional

from models import Installation

GAL_TO_L = 3.78541

# extract_current_conditions() (water_params.py) keys its dict by the parsed
# measurement-field names, which don't all match WATER_PARAMS' range keys
# (cl/br/cya vs chlorine/bromine/stabilizer) — mirrors installationParamsToRanges
# in apps/web/src/utils.ts, which performs the same translation on the frontend.
RANGE_TO_CURRENT_FIELD = {
    "ph": "ph",
    "cl": "chlorine",
    "br": "bromine",
    "cc": "cc",
    "tac": "tac",
    "temp": "temp",
    "salt": "salt",
    "cya": "stabilizer",
    "hardness": "hardness",
}


def _exact_option(
    product_id: str,
    form: str,
    dose_amount: float,
    dose_param_delta: float,
    dose_volume_L: float = 1000.0,
    purity: Optional[float] = None,
    notes_key: Optional[str] = None,
) -> Dict:
    return {
        "product_id": product_id,
        "form": form,
        "purity": purity,
        "exact": True,
        "dose_amount": dose_amount,
        "dose_param_delta": dose_param_delta,
        "dose_volume_L": dose_volume_L,
        "notes_key": notes_key,
    }


def _inexact_option(
    product_id: str,
    form: str,
    notes_key: str,
    purity: Optional[float] = None,
) -> Dict:
    return {
        "product_id": product_id,
        "form": form,
        "purity": purity,
        "exact": False,
        "dose_amount": None,
        "dose_param_delta": None,
        "dose_volume_L": None,
        "notes_key": notes_key,
    }


# Dilution/partial drain-refill is the only fix for "too high" salt, hardness,
# CYA, and TA (and for excess chlorine/bromine) — there's no product to dose.
_DILUTION_GUIDANCE = {"guidance_only": True, "notes_key": "dosage_dilution_required"}

# One entry per WATER_PARAMS key that has an actionable treatment. cc and temp
# are deliberately absent: no universal dosing guidance applies to either.
TREATMENT_TABLE: Dict[str, Dict] = {
    "salt": {
        "raise": {"options": [_exact_option("pool_salt", "solid", 1000.0, 1000.0)]},
        "lower": _DILUTION_GUIDANCE,
    },
    "hardness": {
        "raise": {"options": [_exact_option("calcium_chloride", "solid", 15.0, 10.0, purity=0.77)]},
        "lower": _DILUTION_GUIDANCE,
    },
    "cya": {
        "raise": {
            "options": [
                _exact_option("cya_granular", "solid", 9.7, 10.0),
                _inexact_option("cya_liquid", "liquid", notes_key="dosage_follow_label"),
            ]
        },
        "lower": _DILUTION_GUIDANCE,
    },
    "tac": {
        "raise": {"options": [_exact_option("baking_soda", "solid", 17.5, 10.0, purity=0.974)]},
        "lower": _DILUTION_GUIDANCE,
    },
    "ph": {
        "raise": {
            "options": [
                _exact_option("soda_ash", "solid", 4.5, 0.2, notes_key="dosage_ph_approximate"),
            ]
        },
        "lower": {
            "options": [
                _exact_option(
                    "muriatic_acid", "liquid", 25.0, 0.2,
                    purity=0.3145, notes_key="dosage_ph_lowers_ta_too",
                ),
                _inexact_option("dry_acid", "solid", notes_key="dosage_follow_label"),
            ]
        },
    },
    "cl": {
        "raise": {
            "options": [
                _inexact_option("liquid_chlorine", "liquid", notes_key="dosage_chlorine_varies"),
                _inexact_option("cal_hypo", "solid", notes_key="dosage_chlorine_varies"),
                _inexact_option("dichlor", "solid", notes_key="dosage_chlorine_varies"),
            ]
        },
        "lower": _DILUTION_GUIDANCE,
    },
    "br": {
        "raise": {
            "options": [
                _inexact_option("bromine_tablets", "solid", notes_key="dosage_chlorine_varies"),
            ]
        },
        "lower": _DILUTION_GUIDANCE,
    },
}

# Salt pools generate chlorine via the SWG cell, not by dosing — replaces the
# "cl"/"raise" entry entirely when installation.sanitizer == "salt".
_SWG_RAISE_GUIDANCE = {"guidance_only": True, "notes_key": "dosage_increase_swg_runtime"}


def _volume_in_liters(installation: Installation) -> Optional[float]:
    if installation.volume is None:
        return None
    if installation.volume_unit == "gal":
        return installation.volume * GAL_TO_L
    return installation.volume


def _guidance_only_recommendation(
    param: str, current_value: float, target_value: float, direction: str,
    volume_known: bool, notes_key: str,
) -> Dict:
    return {
        "param": param,
        "current_value": current_value,
        "target_value": target_value,
        "direction": direction,
        "volume_known": volume_known,
        "options": [{
            "product_id": None,
            "form": None,
            "exact": False,
            "amount_grams": None,
            "amount_ml": None,
            "notes_key": notes_key,
        }],
    }


def compute_recommendations(current: Dict, ranges: Dict, installation: Installation) -> List[Dict]:
    """For each param in `ranges` whose `current` value falls outside its
    acceptable band, returns a dosing recommendation. Params with no known
    current value, or that are within their acceptable band, are omitted
    entirely. Never invents amounts for non-exact products or when the
    installation's volume isn't set — `amount_grams`/`amount_ml` are None
    in those cases."""
    volume_L = _volume_in_liters(installation)
    volume_known = volume_L is not None

    recommendations: List[Dict] = []
    for param, bands in ranges.items():
        acceptable = bands.get("acceptable")
        ideal = bands.get("ideal")
        if not acceptable or not ideal:
            continue

        current_field = RANGE_TO_CURRENT_FIELD.get(param)
        if current_field is None:
            continue
        current_entry = current.get(current_field)
        if current_entry is None:
            continue
        current_value = current_entry["value"]

        lo, hi = acceptable
        if lo <= current_value <= hi:
            continue
        direction = "raise" if current_value < lo else "lower"
        target_value = (ideal[0] + ideal[1]) / 2
        delta = target_value - current_value

        if param == "cl" and direction == "raise" and installation.sanitizer == "salt":
            direction_entry = _SWG_RAISE_GUIDANCE
        else:
            table_entry = TREATMENT_TABLE.get(param)
            if table_entry is None:
                continue
            direction_entry = table_entry.get(direction)
            if direction_entry is None:
                continue

        if direction_entry.get("guidance_only"):
            recommendations.append(_guidance_only_recommendation(
                param, current_value, target_value, direction, volume_known,
                direction_entry["notes_key"],
            ))
            continue

        options_out = []
        for opt in direction_entry["options"]:
            amount = None
            if opt["exact"] and volume_L is not None:
                amount = round(
                    opt["dose_amount"] * (abs(delta) / opt["dose_param_delta"]) * (volume_L / opt["dose_volume_L"]),
                    2,
                )
            options_out.append({
                "product_id": opt["product_id"],
                "form": opt["form"],
                "exact": opt["exact"],
                "amount_grams": amount if amount is not None and opt["form"] == "solid" else None,
                "amount_ml": amount if amount is not None and opt["form"] == "liquid" else None,
                "notes_key": opt.get("notes_key"),
            })

        recommendations.append({
            "param": param,
            "current_value": current_value,
            "target_value": target_value,
            "direction": direction,
            "volume_known": volume_known,
            "options": options_out,
        })

    return recommendations
