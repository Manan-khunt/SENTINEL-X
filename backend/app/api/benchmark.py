"""Benchmark REST endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import current_user, require_min_role
from app.db.session import get_db
from app.db.tables import BenchmarkBatch, BenchmarkMetric, User
from app.eval.run_benchmark import comparison, run_batch

router = APIRouter()


@router.get(
    "/benchmark",
    tags=["Benchmarks"],
    summary="List benchmark batches",
    description="Evaluation batches with per-configuration metrics (`B0` alert-only, `B1` static "
    "playbook, `B2` no-replan, `B3` full agent) and Fisher/Wilson comparisons when `DONE`. "
    "Requires any authenticated role.",
)
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


@router.get(
    "/benchmark/{configuration}",
    tags=["Benchmarks"],
    summary="Metrics for one configuration",
    description="`configuration` is one of `B0`, `B1`, `B2`, `B3`. Requires any authenticated role.",  # noqa: E501
    responses={404: {"description": "Unknown configuration."}},
)
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


@router.post(
    "/benchmark/run",
    tags=["Benchmarks"],
    summary="Run a full benchmark batch",
    description="Executes the deterministic harness across scenarios x seeds x configurations. "
    "Long-running (CLI-scale); requires role `analyst`+.",
    responses={403: {"description": "Requires analyst+."}},
)
def run_benchmark(db: Session = Depends(get_db), user: User = Depends(require_min_role("analyst"))):
    batch_id = run_batch(db)
    return {"batch_id": batch_id, "status": "DONE"}
