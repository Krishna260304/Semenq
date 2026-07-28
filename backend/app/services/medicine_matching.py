from __future__ import annotations

import re
import unicodedata
from collections import Counter
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any, Iterable, Sequence


_FORM_WORDS = {
    "ampoule",
    "bottle",
    "box",
    "cap",
    "caps",
    "capsule",
    "capsules",
    "drop",
    "drops",
    "injection",
    "inj",
    "ointment",
    "pack",
    "patch",
    "sachet",
    "syrup",
    "strip",
    "tablet",
    "tablets",
    "tab",
    "tabs",
    "vial",
}

_CORPORATE_SUFFIXES = {
    "co",
    "co.",
    "company",
    "inc",
    "inc.",
    "llc",
    "ltd",
    "ltd.",
    "limited",
    "pvt",
    "pvt.",
    "private",
    "corp",
    "corp.",
    "corporation",
    "labs",
}

_GENERAL_NOISE = {
    "bp",
    "dr",
    "mrp",
    "mrps",
    "mr",
    "mrs",
    "of",
    "oral",
    "otc",
    "pack",
    "product",
    "protected",
    "rx",
    "strip",
    "usp",
    "with",
}

_UNIT_WORDS = {
    "g",
    "gm",
    "mg",
    "mcg",
    "iu",
    "ml",
    "unit",
    "units",
}


@dataclass(frozen=True)
class RankedMedicine:
    medicine: Any
    score: float
    match_type: str
    matched_query: str
    matched_alias: str


def _strip_accents(text: str) -> str:
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")


def _unique_preserve_order(items: Iterable[str], limit: int | None = None) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for item in items:
        cleaned = item.strip()
        if not cleaned:
            continue
        key = cleaned.lower()
        if key in seen:
            continue
        seen.add(key)
        ordered.append(cleaned)
        if limit is not None and len(ordered) >= limit:
            break
    return ordered


def _tokenize(text: str) -> list[str]:
    if not text:
        return []

    cleaned = _strip_accents(text)
    cleaned = cleaned.lower().replace("µg", "mcg").replace("μg", "mcg")
    cleaned = re.sub(r"(?<=\d)(?=[a-z])", " ", cleaned)
    cleaned = re.sub(r"(?<=[a-z])(?=\d)", " ", cleaned)
    cleaned = re.sub(r"[^a-z0-9]+", " ", cleaned)

    tokens: list[str] = []
    for token in cleaned.split():
        if not token:
            continue
        if token in _FORM_WORDS or token in _GENERAL_NOISE or token in _CORPORATE_SUFFIXES:
            continue
        tokens.append(token)
    return tokens


def normalize_medicine_text(text: str) -> str:
    return " ".join(_tokenize(text))


def build_medicine_queries(*texts: str | None, max_queries: int = 10) -> list[str]:
    fragments: list[str] = []
    for text in texts:
        if not text:
            continue
        for line in str(text).splitlines():
            candidate = re.sub(r"^[\s•*\-]+", "", line).strip()
            candidate = re.sub(r"\s+", " ", candidate)
            if not candidate:
                continue
            if any(char.isalpha() for char in candidate):
                fragments.append(candidate)
            normalized = normalize_medicine_text(candidate)
            if normalized:
                fragments.append(normalized)

    collapsed = normalize_medicine_text(" ".join(str(text) for text in texts if text))
    if collapsed:
        fragments.append(collapsed)

    return _unique_preserve_order(fragments, limit=max_queries)


def _field_texts(medicine: Any) -> list[tuple[str, str]]:
    search_keywords = getattr(medicine, "search_keywords", None) or []
    if isinstance(search_keywords, (list, tuple, set)):
        keywords_text = " ".join(str(value) for value in search_keywords if str(value).strip())
    else:
        keywords_text = str(search_keywords).strip()

    fields: list[tuple[str, str]] = [
        ("name", str(getattr(medicine, "name", "") or "")),
        ("generic_name", str(getattr(medicine, "generic_name", "") or "")),
        ("composition", str(getattr(medicine, "composition", "") or "")),
        ("brand_name", str(getattr(medicine, "brand_name", "") or "")),
        ("manufacturer", str(getattr(medicine, "manufacturer", "") or "")),
        ("strength", str(getattr(medicine, "strength", "") or "")),
        ("category_name", str(getattr(medicine, "category_name", "") or "")),
        ("search_keywords", keywords_text),
    ]

    composites: list[tuple[str, str]] = []
    name = fields[0][1].strip()
    generic = fields[1][1].strip()
    composition = fields[2][1].strip()
    brand_name = fields[3][1].strip()
    manufacturer = fields[4][1].strip()
    strength = fields[5][1].strip()

    if name and generic:
        composites.append(("name_generic", f"{name} {generic}"))
    if name and composition:
        composites.append(("name_composition", f"{name} {composition}"))
    if generic and composition and generic != composition:
        composites.append(("generic_composition", f"{generic} {composition}"))
    if name and strength:
        composites.append(("name_strength", f"{name} {strength}"))
    if brand_name and manufacturer:
        composites.append(("brand_manufacturer", f"{brand_name} {manufacturer}"))

    return [*fields, *composites]


def _token_weight(token: str) -> float:
    if token in _UNIT_WORDS:
        return 0.4
    if re.fullmatch(r"\d+(?:\.\d+)?", token):
        return 1.5
    if len(token) <= 2:
        return 0.8
    return 1.0


def _token_similarity(left: str, right: str) -> float:
    left_norm = normalize_medicine_text(left)
    right_norm = normalize_medicine_text(right)
    if not left_norm or not right_norm:
        return 0.0
    if left_norm == right_norm:
        return 1.0

    left_tokens = _tokenize(left_norm)
    right_tokens = _tokenize(right_norm)
    if not left_tokens or not right_tokens:
        return SequenceMatcher(None, left_norm, right_norm).ratio()

    left_counts = Counter(left_tokens)
    right_counts = Counter(right_tokens)
    shared = left_counts & right_counts
    shared_weight = sum(_token_weight(token) * count for token, count in shared.items())

    if shared_weight == 0:
        ratio = SequenceMatcher(None, left_norm, right_norm).ratio()
        return round(ratio, 4)

    left_weight = sum(_token_weight(token) * count for token, count in left_counts.items()) or 1.0
    right_weight = sum(_token_weight(token) * count for token, count in right_counts.items()) or 1.0

    precision = shared_weight / left_weight
    recall = shared_weight / right_weight
    f1 = 0.0 if precision + recall == 0 else 2 * precision * recall / (precision + recall)
    ratio = SequenceMatcher(None, left_norm, right_norm).ratio()
    score = max(f1, ratio)

    left_numbers = {token for token in left_tokens if re.fullmatch(r"\d+(?:\.\d+)?", token)}
    right_numbers = {token for token in right_tokens if re.fullmatch(r"\d+(?:\.\d+)?", token)}
    if left_numbers and right_numbers:
        number_overlap = len(left_numbers & right_numbers) / len(left_numbers | right_numbers)
        score += number_overlap * 0.1

    if left_norm in right_norm or right_norm in left_norm:
        score = max(score, min(0.98, score + 0.08))

    return round(min(score, 1.0), 4)


def score_medicine_against_query(query: str, medicine: Any) -> tuple[float, str, str]:
    query_norm = normalize_medicine_text(query)
    if not query_norm:
        return 0.0, "none", ""

    best_score = 0.0
    best_field = "none"
    best_alias = ""

    for field_name, alias in _field_texts(medicine):
        if not alias:
            continue
        score = _token_similarity(query_norm, alias)
        if score > best_score:
            best_score = score
            best_field = field_name
            best_alias = alias

    query_tokens = set(_tokenize(query_norm))
    name_tokens = set(_tokenize(str(getattr(medicine, "name", "") or "")))
    generic_tokens = set(_tokenize(str(getattr(medicine, "generic_name", "") or "")))
    composition_tokens = set(_tokenize(str(getattr(medicine, "composition", "") or "")))
    brand_tokens = set(_tokenize(str(getattr(medicine, "brand_name", "") or "")))
    manufacturer_tokens = set(_tokenize(str(getattr(medicine, "manufacturer", "") or "")))

    if query_tokens & name_tokens:
        best_score += 0.03
    if query_tokens & generic_tokens:
        best_score += 0.025
    if query_tokens & composition_tokens:
        best_score += 0.02
    if query_tokens & brand_tokens:
        best_score += 0.02
    if query_tokens & manufacturer_tokens:
        best_score += 0.01

    best_score = min(best_score, 1.0)

    if best_score >= 0.98:
        match_type = "exact"
    elif best_field == "brand_name" and best_score >= 0.7:
        match_type = "brand"
    elif best_field in {"generic_name", "composition", "generic_composition"} and best_score >= 0.7:
        match_type = "generic"
    elif best_field == "name" and best_score >= 0.7:
        match_type = "typo"
    elif best_field == "manufacturer" and best_score >= 0.68:
        match_type = "brand"
    else:
        match_type = "none"

    return round(best_score, 4), match_type, best_alias


def rank_medicines_for_queries(
    queries: Sequence[str],
    medicines: Sequence[Any],
    limit: int = 5,
) -> list[RankedMedicine]:
    ranked: list[RankedMedicine] = []

    for medicine in medicines:
        per_query_scores: list[tuple[float, str, str, str]] = []
        for query in queries:
            score, match_type, alias = score_medicine_against_query(query, medicine)
            if score <= 0:
                continue
            per_query_scores.append((score, match_type, query, alias))

        if not per_query_scores:
            continue

        per_query_scores.sort(key=lambda item: item[0], reverse=True)
        top_score, top_type, top_query, top_alias = per_query_scores[0]
        aggregate = top_score
        if len(per_query_scores) > 1:
            aggregate += per_query_scores[1][0] * 0.2
        if len(per_query_scores) > 2:
            aggregate += per_query_scores[2][0] * 0.1
        aggregate = min(aggregate, 1.0)

        ranked.append(
            RankedMedicine(
                medicine=medicine,
                score=round(aggregate, 4),
                match_type=top_type,
                matched_query=top_query,
                matched_alias=top_alias,
            )
        )

    ranked.sort(
        key=lambda item: (
            item.score,
            len(normalize_medicine_text(str(getattr(item.medicine, "name", "") or ""))),
            str(getattr(item.medicine, "name", "") or "").lower(),
        ),
        reverse=True,
    )
    return ranked[:limit]
