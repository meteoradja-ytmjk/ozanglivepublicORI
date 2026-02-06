# Requirements Document

## Introduction

Dokumen ini mendefinisikan requirements untuk optimasi CPU usage pada streaming service. Saat ini dengan hanya 5 stream aktif, CPU usage mencapai 100% yang sangat tidak efisien. Target adalah membuat streaming service super ringan dengan tetap menjaga kualitas streaming yang baik.

## Glossary

- **StreamingService**: Komponen yang mengelola proses FFmpeg untuk live streaming ke platform RTMP
- **FFmpeg**: Tool multimedia untuk encoding dan streaming video/audio
- **CPU Usage**: Persentase penggunaan processor oleh aplikasi
- **Hardware Acceleration (hwaccel)**: Penggunaan GPU untuk encoding/decoding video
- **Preset**: Konfigurasi encoding FFmpeg yang menentukan trade-off antara kecepatan dan kualitas
- **Thread**: Unit eksekusi paralel dalam CPU
- **Copy Mode**: Mode FFmpeg yang menyalin stream tanpa re-encoding

## Requirements

### Requirement 1

**User Story:** As a system administrator, I want the streaming service to use minimal CPU resources, so that the server can handle more concurrent streams without overloading.

#### Acceptance Criteria

1. WHEN streaming service runs 5 concurrent streams THEN the StreamingService SHALL maintain CPU usage below 50%
2. WHEN FFmpeg process starts THEN the StreamingService SHALL limit thread usage to prevent CPU saturation
3. WHEN video codec is compatible with output THEN the StreamingService SHALL use copy mode instead of re-encoding
4. WHEN hardware acceleration is available THEN the StreamingService SHALL utilize GPU for encoding tasks
5. WHEN advanced settings are disabled THEN the StreamingService SHALL use copy mode for both video and audio

### Requirement 2

**User Story:** As a content creator, I want the streaming quality to remain good despite CPU optimization, so that viewers have a pleasant viewing experience.

#### Acceptance Criteria

1. WHEN using copy mode THEN the StreamingService SHALL preserve original video and audio quality
2. WHEN re-encoding is required THEN the StreamingService SHALL use efficient preset that balances quality and CPU usage
3. WHEN streaming to RTMP THEN the StreamingService SHALL maintain stable bitrate output
4. WHEN audio is merged with video THEN the StreamingService SHALL encode audio at minimum 128kbps AAC

### Requirement 3

**User Story:** As a developer, I want FFmpeg arguments to be optimized for low CPU usage, so that the system runs efficiently.

#### Acceptance Criteria

1. WHEN building FFmpeg arguments THEN the StreamingService SHALL include thread limiting parameters
2. WHEN using libx264 encoder THEN the StreamingService SHALL use ultrafast preset instead of veryfast
3. WHEN multiple streams run concurrently THEN the StreamingService SHALL distribute CPU load evenly
4. WHEN buffer settings are configured THEN the StreamingService SHALL use minimal buffer sizes that maintain stability

### Requirement 4

**User Story:** As a system administrator, I want background processes to be lightweight, so that they don't consume unnecessary CPU cycles.

#### Acceptance Criteria

1. WHEN syncStreamStatuses runs THEN the StreamingService SHALL execute with minimal database queries
2. WHEN stream status sync interval is set THEN the StreamingService SHALL use longer intervals to reduce overhead
3. WHEN checking stream status THEN the StreamingService SHALL use efficient lookup methods
4. WHEN logging stream events THEN the StreamingService SHALL avoid excessive I/O operations

### Requirement 5

**User Story:** As a system administrator, I want to monitor CPU optimization effectiveness, so that I can verify the improvements are working.

#### Acceptance Criteria

1. WHEN stream starts THEN the StreamingService SHALL log the FFmpeg arguments being used
2. WHEN CPU optimization is applied THEN the StreamingService SHALL log the optimization mode (copy/encode)
3. WHEN hardware acceleration is detected THEN the StreamingService SHALL log the acceleration method being used

### Requirement 6

**User Story:** As a developer, I want the CPU optimization to be backward compatible, so that existing functionality remains unaffected.

#### Acceptance Criteria

1. WHEN optimization is applied THEN the StreamingService SHALL maintain all existing stream start/stop functionality
2. WHEN FFmpeg arguments are modified THEN the StreamingService SHALL preserve all existing parameters that affect stream behavior
3. WHEN copy mode fails THEN the StreamingService SHALL fallback to encoding mode automatically
4. WHEN playlist streaming is used THEN the StreamingService SHALL apply same optimization without breaking concat functionality
5. WHEN audio merge is enabled THEN the StreamingService SHALL maintain audio sync with video

### Requirement 7

**User Story:** As a system administrator, I want error handling to be robust, so that optimization failures don't crash the streaming service.

#### Acceptance Criteria

1. IF FFmpeg process fails with optimized settings THEN the StreamingService SHALL log the error and attempt recovery
2. IF hardware acceleration is unavailable THEN the StreamingService SHALL fallback to software encoding gracefully
3. IF thread limiting causes issues THEN the StreamingService SHALL use default thread settings as fallback
4. WHEN stream encounters error THEN the StreamingService SHALL preserve existing retry mechanism

### Requirement 8

**User Story:** As a content creator, I want FFmpeg streaming to be stable and not stop unexpectedly, so that my live streams run continuously without interruption.

#### Acceptance Criteria

1. WHEN FFmpeg process runs THEN the StreamingService SHALL use stable buffer settings to prevent sudden stops
2. WHEN network fluctuation occurs THEN the StreamingService SHALL use reconnect parameters to maintain stream
3. WHEN video source has variable framerate THEN the StreamingService SHALL normalize output to prevent desync
4. WHEN stream runs for extended duration THEN the StreamingService SHALL maintain stable memory usage
5. WHEN FFmpeg encounters recoverable error THEN the StreamingService SHALL continue streaming without stopping

### Requirement 9

**User Story:** As a content creator, I want stream duration to be accurate and synchronized, so that my stream ends exactly when I specified.

#### Acceptance Criteria

1. WHEN user sets duration in hours THEN the StreamingService SHALL calculate exact seconds for FFmpeg -t parameter
2. WHEN user sets end time THEN the StreamingService SHALL calculate duration from current time to end time accurately
3. WHEN stream starts late from schedule THEN the StreamingService SHALL use intended duration not fixed end time
4. WHEN FFmpeg -t parameter is set THEN the StreamingService SHALL place it correctly before output URL
5. WHEN duration tracking is enabled THEN the StreamingService SHALL monitor actual elapsed time vs expected duration
6. WHEN stream approaches end time THEN the StreamingService SHALL allow FFmpeg to terminate naturally via -t parameter

### Requirement 10

**User Story:** As a content creator, I want looping streams to respect duration limits, so that looped content stops at the specified time.

#### Acceptance Criteria

1. WHEN loop is enabled with duration THEN the StreamingService SHALL use -stream_loop with -t parameter correctly
2. WHEN audio loops independently THEN the StreamingService SHALL sync audio loop with video duration
3. WHEN playlist loops THEN the StreamingService SHALL respect overall duration limit
4. WHEN duration is reached during loop THEN the StreamingService SHALL stop cleanly without corruption
