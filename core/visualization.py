"""Privacy-trimmed, read-only views for the local visualization UI."""

from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

from . import profile
from .access import extract_summary, get_access_level


def _safe_text(root: Path, path: Path) -> str:
    return profile.safe_vault_file(root, path).read_text(encoding="utf-8")


def _audit_tail(root: Path, path: Path, max_bytes: int = 262_144) -> list[str]:
    path = profile.safe_vault_file(root, path)
    with path.open("rb") as handle:
        handle.seek(0, 2)
        size = handle.tell()
        handle.seek(max(0, size - max_bytes))
        data = handle.read()
    return data.decode("utf-8", errors="replace").splitlines()[-500:]


def _sections(body: str) -> list[dict[str, Any]]:
    parts = re.split(r"(?m)^##\s+", body)
    result = []
    for part in parts[1:]:
        title, _, text = part.partition("\n")
        items = [line[2:].strip() for line in text.splitlines() if line.startswith("- ") and line[2:].strip()]
        result.append({"title": title.strip()[:80], "items": items[:12]})
    return result


def _has_visible_confirmed_memory(root: Path) -> bool:
    for path in (root / profile.MEMORY_ROOT / "Confirmed").glob("*.md"):
        text = _safe_text(root, path)
        metadata, _ = profile.read_record(path)
        if metadata.get("status") == "confirmed" and get_access_level(text) in {"allowed", "summary-only"}:
            return True
    return False


def profile_overview(root: Path) -> dict[str, Any]:
    text = _safe_text(root, root / "10 Profile" / "Profile.md")
    metadata, body = profile.parse_record(text)
    access = get_access_level(text)
    has_confirmed_memories = _has_visible_confirmed_memory(root)
    if access in {"denied", "local-only"}:
        return {"access": access, "sections": [], "protected": True, "hasConfirmedMemories": False}
    if access == "summary-only":
        return {"access": access, "sections": [{"title": "摘要", "items": [extract_summary(body)]}], "protected": False, "hasConfirmedMemories": has_confirmed_memories}
    template = (profile.ROOT / "template" / "10 Profile" / "Profile.md").read_text(encoding="utf-8")
    sections = _sections(body) if text != template else []
    return {"access": access, "sections": sections, "protected": False, "visibility": metadata.get("visibility", "private"), "hasConfirmedMemories": has_confirmed_memories}


def _memory_files(root: Path):
    for folder in profile.MEMORY_FOLDERS.values():
        for path in (root / profile.MEMORY_ROOT / folder).glob("*.md"):
            yield folder, path


def timeline(root: Path, limit: int = 100) -> list[dict[str, Any]]:
    rows = []
    for folder, path in _memory_files(root):
        path = profile.safe_vault_file(root, path)
        metadata, body = profile.read_record(path)
        access = get_access_level(path.read_text(encoding="utf-8"))
        status = metadata["status"]
        can_preview = folder == "Confirmed" and status == "confirmed" and access in {"allowed", "summary-only"}
        rows.append({
            "id": metadata["id"], "status": status, "type": metadata.get("type", "note") if can_preview else "protected",
            "subject": metadata.get("subject", "") if can_preview else "",
            "sourceAgent": metadata.get("source_agent", "unknown") if can_preview else "protected",
            "created": metadata.get("created", ""), "updated": metadata.get("updated", ""),
            "access": access, "previewAvailable": can_preview,
            "preview": extract_summary(body) if can_preview else "",
        })
    return sorted(rows, key=lambda row: row["updated"] or row["created"], reverse=True)[:limit]


def memory_graph(root: Path, statuses: set[str] | None = None, limit: int = 200) -> dict[str, Any]:
    """Build a read-only graph from memories and their explicit tags only.

    No similarity, shared-source, shared-type or inferred relationship becomes
    an edge.  This keeps the visual projection honest without changing the
    persisted Vault schema.
    """
    allowed = statuses or {"confirmed", "candidate"}
    rows: list[tuple[dict[str, str], str]] = []
    for _, path in _memory_files(root):
        path = profile.safe_vault_file(root, path)
        metadata, body = profile.read_record(path)
        if metadata.get("status") not in allowed:
            continue
        rows.append((metadata, body))
    rows.sort(key=lambda item: item[0].get("updated") or item[0].get("created") or "", reverse=True)
    total = len(rows)
    truncated = total > limit
    rows = rows[:limit]

    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    topics: dict[str, dict[str, Any]] = {}
    for metadata, body in rows:
        raw_tags = metadata.get("tags", "")
        if isinstance(raw_tags, list):
            tags = [str(value).strip() for value in raw_tags if str(value).strip()][:20]
        else:
            tags = [value.strip().strip("[]'\"") for value in str(raw_tags).split(",") if value.strip().strip("[]'\"")][:20]
        status = metadata.get("status", "candidate")
        record_id = metadata["id"]
        nodes.append({
            "id": record_id, "kind": "memory", "status": status,
            "label": metadata.get("subject") or metadata.get("type", "note"),
            "type": metadata.get("type", "note"), "sourceAgent": metadata.get("source_agent", "unknown"),
            "created": metadata.get("created", ""), "updated": metadata.get("updated", ""),
            "tags": tags, "preview": extract_summary(body)[:240], "reviewable": status == "candidate",
        })
        for tag in tags:
            normalized = tag.casefold()
            topic_id = f"topic-{hashlib.sha256(normalized.encode('utf-8')).hexdigest()[:16]}"
            topic = topics.setdefault(topic_id, {"id": topic_id, "kind": "topic", "label": tag, "memberCount": 0})
            topic["memberCount"] += 1
            edges.append({
                "id": f"edge-{record_id}-{topic_id}", "kind": "explicit-tag",
                "source": record_id, "target": topic_id,
                "evidence": {"field": "tags", "value": tag},
            })
    nodes.extend(topics.values())
    return {"nodes": nodes, "edges": edges, "total": total, "truncated": truncated, "relationshipBasis": "explicit-tags-only"}


def memory_events(root: Path, limit: int = 100) -> dict[str, Any]:
    """Return real lifecycle audit events plus labelled record-time fallbacks."""
    from . import security

    records: dict[str, dict[str, str]] = {}
    for _, path in _memory_files(root):
        metadata, _ = profile.read_record(profile.safe_vault_file(root, path))
        records[metadata["id"]] = metadata

    audit = security.query_events(root, resource_type="memory", page_size=min(max(limit, 1), 100))
    events: list[dict[str, Any]] = []
    covered: set[str] = set()
    for event in audit["items"]:
        record_id = str(event.get("details", {}).get("resourceId", ""))
        metadata = records.get(record_id, {})
        if record_id:
            covered.add(record_id)
        events.append({
            "eventId": event["eventId"], "timestamp": event["timestamp"], "eventType": event["eventType"],
            "origin": "audit", "clientId": event["clientId"], "result": event["result"],
            "reasonCode": event["reasonCode"], "correlationId": event["correlationId"],
            "memoryId": record_id, "status": metadata.get("status", ""),
            "type": metadata.get("type", "protected"), "subject": metadata.get("subject", ""),
            "sourceAgent": metadata.get("source_agent", event["clientId"]),
        })
    for record_id, metadata in records.items():
        if record_id in covered:
            continue
        timestamp = metadata.get("updated") or metadata.get("created") or ""
        if not timestamp:
            continue
        events.append({
            "eventId": f"record-{record_id}", "timestamp": timestamp, "eventType": "memory.record_timestamp",
            "origin": "record", "clientId": metadata.get("source_agent", "unknown"), "result": "allowed",
            "reasonCode": "RECORD_TIMESTAMP", "correlationId": "", "memoryId": record_id,
            "status": metadata.get("status", ""), "type": metadata.get("type", "protected"),
            "subject": metadata.get("subject", ""), "sourceAgent": metadata.get("source_agent", "unknown"),
        })
    events.sort(key=lambda item: item["timestamp"], reverse=True)
    return {"items": events[:limit], "integrity": audit["integrity"], "total": len(events)}


def privacy_audit(root: Path) -> dict[str, Any]:
    status: Counter[str] = Counter()
    access: Counter[str] = Counter()
    sources: Counter[str] = Counter()
    issues = []
    for _, path in _memory_files(root):
        text = _safe_text(root, path)
        metadata, _ = profile.parse_record(text)
        status[metadata.get("status", "invalid")] += 1
        level = get_access_level(text)
        access[level] += 1
        sources[metadata.get("source_agent", "unknown")] += 1
        if "ai_access" not in metadata or metadata.get("ai_access") not in {"allowed", "summary-only", "local-only", "denied"}:
            issues.append({"id": metadata.get("id", path.name), "issue": "ai_access 缺失或无效，已按 denied 处理"})
    audit_events: Counter[str] = Counter()
    audit_file = root / "90 System" / "Audit" / "mcp.jsonl"
    if audit_file.is_file():
        for line in _audit_tail(root, audit_file):
            try:
                value = json.loads(line)
                audit_events[str(value.get("event", "unknown"))] += 1
            except json.JSONDecodeError:
                audit_events["invalid_record"] += 1
    return {
        "totalMemories": sum(status.values()), "byStatus": dict(status), "byAccess": dict(access),
        "bySource": dict(sources.most_common(10)), "mcpEvents": dict(audit_events), "issues": issues[:50],
        "rules": ["未确认记忆不会出现在可视化预览中", "denied 与 local-only 不返回预览", "所有统计仅在本机生成"],
    }


def human3_trend(root: Path) -> dict[str, Any]:
    points = []
    history = root / "40 Reviews" / "Human3" / "History"
    for path in sorted(history.glob("*.md"))[-24:]:
        text = _safe_text(root, path)
        metadata, body = profile.parse_record(text)
        access = get_access_level(text)
        if metadata.get("status") != "confirmed" or access in {"denied", "local-only"}:
            continue
        scores = {}
        for key in ("mind", "body", "spirit", "vocation"):
            value = metadata.get(key, "")
            if re.fullmatch(r"(?:10|[0-9])(?:\.\d+)?", value):
                scores[key] = float(value)
        points.append({"date": metadata.get("date", path.stem), "scores": scores, "summary": extract_summary(body)})
    return {"disclaimer": "Human 3.0 仅用于自我反思，不是医学或心理诊断。", "dimensions": ["mind", "body", "spirit", "vocation"], "points": points}


def monthly_trend(root: Path) -> dict[str, Any]:
    """Cross-month Human 3.0 aggregation over confirmed monthly reflections.

    Read-only and local: shows the user's own confirmed monthly records as a
    time series with objective counts. It never infers a growth score.
    """
    from . import monthly_reflection
    points: list[dict[str, Any]] = []
    for item in monthly_reflection.overview(root)["reflections"]:
        if item["status"] != "confirmed":
            continue
        goals = item["goals"]
        points.append({
            "month": item["month"],
            "dimensions": item["dimensions"],
            "completedDimensions": item["completedDimensions"],
            "events": item["events"],
            "eventCount": len(item["events"]),
            "goals": goals,
            "goalTotal": len(goals),
            "goalCompleted": sum(1 for goal in goals if goal.get("completed")),
            "summary": item["summary"],
            "updated": item["updated"],
        })
    points.sort(key=lambda point: point["month"])
    return {
        "disclaimer": "月度复盘仅用于自我反思，不推断成长分数。",
        "dimensions": [{"key": key, "title": title} for key, title in monthly_reflection.DIMENSIONS.items()],
        "points": points,
    }
