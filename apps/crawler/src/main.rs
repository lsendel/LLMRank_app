mod config;
mod crawler;
mod jobs;
mod lighthouse;
mod models;
mod server;
mod storage;

use axum::{middleware, routing::{get, post}, Router};
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{fmt, EnvFilter};

use crate::config::Config;

/// Shared application state passed to all Axum handlers.
#[derive(Debug, Clone)]
pub struct AppState {
    pub config: Arc<Config>,
}

#[tokio::main]
async fn main() {
    // Initialize tracing with RUST_LOG env filter (defaults to "info")
    fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    // Load configuration from environment variables
    let config = Config::from_env().expect("Failed to load configuration from environment");
    let port = config.port;

    let state = AppState {
        config: Arc::new(config),
    };

    // CORS layer — permissive for the internal service
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Routes that require HMAC authentication
    let authenticated_routes = Router::new()
        .route("/api/v1/jobs", post(server::routes::create_job))
        .route(
            "/api/v1/jobs/{id}/status",
            get(server::routes::get_job_status),
        )
        .route(
            "/api/v1/jobs/{id}/cancel",
            post(server::routes::cancel_job),
        )
        .layer(middleware::from_fn_with_state(
            state.clone(),
            server::auth::verify_hmac,
        ));

    // Public routes (no auth required)
    let public_routes = Router::new().route("/api/v1/health", get(server::routes::health));

    // Combine all routes
    let app = Router::new()
        .merge(authenticated_routes)
        .merge(public_routes)
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state);

    let addr = format!("0.0.0.0:{port}");
    tracing::info!("Crawler service starting on {addr}");

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("Failed to bind to address");

    axum::serve(listener, app)
        .await
        .expect("Server error");
}
