"""Benchmark REST endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import current_user, require_min_role
from app.db.session import get_db
from app.db.tables import BenchmarkBatch, BenchmarkMetric, User
from app.eval.run_benchmark import comparison, run_batch

router = APIRouter()


@router.get("/benchmark")
def list_benchmarks(db: Session = Depends(get_db), _u: User = Depends(current_user)):
    batches = db.query(BenchmarkBatch).order_by(BenchmarkBatch.created_at.desc()).all()
    out = []
    for b in batches:
        mets = db.query(BenchmarkMetric).filter_by(batch_id=b.id).all()
        out.append(
            {
                "batch_id": b.id,
                "status": b.status,
                "metrics": {m.configuration: m.metrics_json for m in mets},
                "comparison": comparison(db, b.id) if b.status == "DONE" else {},
            }
        )
    return out


@router.get("/benchmark/{configuration}")
def benchmark_config(
    configuration: str, db: Session = Depends(get_db), _u: User = Depends(current_user)
):
    if configuration not in ("B0", "B1", "B2", "B3"):
        raise HTTPException(status_code=404, detail="unknown configuration")
    mets = (
        db.query(BenchmarkMetric)
        .filter_by(configuration=configuration)
        .order_by(BenchmarkMetric.id.desc())
        .all()
    )
    return [{"batch_id": m.batch_id, "metrics": m.metrics_json} for m in mets]


@router.post("/benchmark/run")
def run_benchmark(db: Session = Depends(get_db), user: User = Depends(require_min_role("analyst"))):
    batch_id = run_batch(db)
    return {"batch_id": batch_id, "status": "DONE"}
