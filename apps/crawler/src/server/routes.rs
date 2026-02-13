use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;

use crate::models::{CrawlJobPayload, JobStatus, JobStatusKind};
use crate::AppState;

/// POST /api/v1/jobs
///
/// Accepts a new crawl job payload. Validates the input and returns 202 Accepted.
/// Actual job processing will be wired up in Task 8.
pub async fn create_job(
    State(_state): State<AppState>,
    Json(payload): Json<CrawlJobPayload>,
) -> impl IntoResponse {
    tracing::info!(
        job_id = %payload.job_id,
        seed_urls = ?payload.config.seed_urls,
        max_pages = payload.config.max_pages,
        "Received crawl job"
    );

    // TODO (Task 8): Send payload to the job manager via mpsc channel.
    // For now, just acknowledge receipt.

    (
        StatusCode::ACCEPTED,
        Json(json!({
            "job_id": payload.job_id,
            "status": "queued"
        })),
    )
}

/// GET /api/v1/jobs/:id/status
///
/// Returns the current status of a crawl job. Stub implementation for now.
pub async fn get_job_status(
    State(_state): State<AppState>,
    Path(job_id): Path<String>,
) -> impl IntoResponse {
    tracing::info!(job_id = %job_id, "Status request");

    // TODO (Task 8): Look up actual job status from the job manager.
    let status = JobStatus {
        job_id,
        status: JobStatusKind::Pending,
        stats: None,
    };

    (StatusCode::OK, Json(status))
}

/// POST /api/v1/jobs/:id/cancel
///
/// Cancels a running crawl job. Stub implementation for now.
pub async fn cancel_job(
    State(_state): State<AppState>,
    Path(job_id): Path<String>,
) -> impl IntoResponse {
    tracing::info!(job_id = %job_id, "Cancel request");

    // TODO (Task 8): Send cancellation signal to the job manager.

    (
        StatusCode::OK,
        Json(json!({
            "job_id": job_id,
            "status": "cancelled"
        })),
    )
}

/// GET /api/v1/health
///
/// Health check endpoint.
pub async fn health() -> impl IntoResponse {
    Json(json!({ "status": "ok" }))
}
