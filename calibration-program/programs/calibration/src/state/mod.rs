pub mod forecaster;
pub mod forecaster_v2;
pub mod prediction;
// Compression state temporarily disabled
// pub mod compressed_prediction;

// Export V1 (for backward compatibility with existing deployed accounts)
pub use forecaster::ForecasterState as ForecasterStateV1;

// Export V2 (new schema with cross-platform support)
pub use forecaster_v2::ForecasterState;
pub use forecaster_v2::ErrorCode as ForecasterV2ErrorCode;

pub use prediction::*;
// pub use compressed_prediction::*;
