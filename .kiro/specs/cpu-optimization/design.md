# Design Document: CPU Optimization for Streaming Service

## Overview

Dokumen ini menjelaskan desain teknis untuk mengoptimasi CPU usage pada streaming service. Fokus utama adalah mengurangi beban CPU dari 100% menjadi di bawah 50% untuk 5 concurrent streams, sambil menjaga stabilitas dan kualitas streaming.

### Masalah Utama yang Diidentifikasi

1. **Re-encoding yang tidak perlu**: FFmpeg melakukan re-encoding video padahal bisa menggunakan copy mode
2. **Preset encoding terlalu berat**: Menggunakan `veryfast` yang masih memakan CPU tinggi
3. **Tidak ada thread limiting**: FFmpeg menggunakan semua CPU cores tanpa batasan
4. **Buffer settings tidak optimal**: Menyebabkan CPU spike dan stream tidak stabil
5. **Sync interval terlalu sering**: `syncStreamStatuses` berjalan setiap 5 menit

### Solusi yang Diusulkan

1. Prioritaskan copy mode untuk video dan audio
2. Gunakan preset `ultrafast` saat re-encoding diperlukan
3. Batasi threads per FFmpeg process
4. Optimasi buffer settings untuk stabilitas
5. Tambahkan reconnect parameters untuk mencegah stream berhenti mendadak
6. Perbaiki kalkulasi durasi untuk akurasi

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     StreamingService                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ FFmpegArgsBuilder│  │ DurationCalc    │  │ ProcessManager  │ │
│  │                 │  │                 │  │                 │ │
│  │ - buildOptimized│  │ - calcSeconds   │  │ - startStream   │ │
│  │ - addThreadLimit│  │ - calcFromEnd   │  │ - stopStream    │ │
│  │ - addReconnect  │  │ - trackDuration │  │ - syncStatus    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    FFmpeg Process                            ││
│  │  - Thread limited (2-4 threads per stream)                  ││
│  │  - Copy mode preferred                                       ││
│  │  - Ultrafast preset for encoding                            ││
│  │  - Reconnect on disconnect                                   ││
│  │  - Accurate duration via -t parameter                       ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. FFmpeg Arguments Builder (Modified)

Komponen yang membangun arguments FFmpeg dengan optimasi CPU untuk YouTube livestreaming.

```javascript
// Optimized FFmpeg arguments structure for YouTube
interface OptimizedFFmpegConfig {
  // Thread limiting - CRITICAL for multiple streams
  threads: number;           // 2 threads per stream (optimal for 10+ streams)
  
  // Encoding settings - YouTube optimized
  preset: 'ultrafast';       // Fastest preset for minimal CPU
  tune: 'zerolatency';       // Low latency streaming
  profile: 'baseline';       // YouTube compatible, lowest CPU
  level: '3.1';              // YouTube standard level
  
  // Buffer settings (YouTube optimized)
  bufsize: string;           // '1M' for minimal memory per stream
  maxMuxingQueueSize: number; // 2048 for lower memory footprint
  
  // YouTube RTMP specific
  flvflags: 'no_duration_filesize'; // Reduce overhead
  
  // Reconnect settings (critical for YouTube)
  reconnect: boolean;
  reconnectStreamed: boolean;
  reconnectDelayMax: number;  // 10 seconds for YouTube
  reconnectAtEof: boolean;    // Reconnect at end of file
  
  // Copy mode flags - ALWAYS prefer for YouTube
  copyVideo: boolean;         // YouTube accepts most codecs
  copyAudio: boolean;
}
```

### YouTube Streaming Optimization Notes

1. **Copy Mode Priority**: YouTube accepts H.264/AAC without re-encoding
2. **Thread Limiting**: 2 threads per stream allows 15+ concurrent streams on 4-core CPU
3. **Buffer Reduction**: Smaller buffers = less memory = more streams
4. **Reconnect**: YouTube disconnects idle streams, reconnect prevents failures

### 2. Duration Calculator (Enhanced)

Komponen untuk kalkulasi durasi yang akurat.

```javascript
interface DurationConfig {
  // Input sources
  streamDurationHours: number | null;  // From duration dropdown
  duration: number | null;              // In minutes
  scheduleTime: Date | null;            // Scheduled start
  endTime: Date | null;                 // Scheduled end
  actualStartTime: Date;                // Actual start time
  
  // Output
  durationSeconds: number | null;       // Calculated duration for -t
}
```

### 3. Process Manager (Optimized)

Komponen untuk mengelola FFmpeg processes dengan efisien.

```javascript
interface ProcessManagerConfig {
  syncInterval: number;      // 10 minutes instead of 5
  maxRetryAttempts: number;  // 3 attempts
  retryDelay: number;        // 3000ms
}
```

## Data Models

### Stream Configuration (Extended)

```javascript
{
  id: string,
  video_id: string,
  audio_id: string | null,
  rtmp_url: string,
  stream_key: string,
  
  // Duration settings
  stream_duration_hours: number | null,
  duration: number | null,
  schedule_time: string | null,
  end_time: string | null,
  
  // Encoding settings
  use_advanced_settings: boolean,
  resolution: string,
  bitrate: number,
  fps: number,
  loop_video: boolean,
  
  // Status
  status: 'offline' | 'live' | 'scheduled',
  start_time: string | null
}
```

### FFmpeg Arguments Array Structure (YouTube Optimized)

```javascript
// Optimized order for FFmpeg arguments - YouTube livestreaming
[
  // 1. Global options - CRITICAL for multi-stream
  '-threads', '2',              // Limit CPU per stream
  '-thread_queue_size', '512',  // Reduce memory queue
  '-hwaccel', 'auto',           // Use GPU if available
  '-loglevel', 'error',         // Minimal logging overhead
  
  // 2. Input options
  '-re',                        // Real-time input
  '-fflags', '+genpts+igndts+discardcorrupt',  // Handle corrupt frames
  '-avoid_negative_ts', 'make_zero',
  '-stream_loop', '-1',         // if looping
  '-i', inputPath,
  
  // 3. Encoding options (PREFER copy mode for YouTube)
  '-c:v', 'copy',               // No re-encoding = minimal CPU
  '-c:a', 'copy',               // Preserve original audio
  // OR if re-encoding needed:
  // '-c:v', 'libx264',
  // '-preset', 'ultrafast',    // Fastest encoding
  // '-profile:v', 'baseline',  // YouTube compatible
  // '-tune', 'zerolatency',    // Low latency
  
  // 4. Output options - YouTube optimized
  '-flags', '+global_header',
  '-bufsize', '1M',             // Reduced from 4M
  '-max_muxing_queue_size', '2048',  // Reduced from 7000
  '-flvflags', 'no_duration_filesize',  // Reduce FLV overhead
  '-f', 'flv',
  
  // 5. Duration limit (MUST be before output URL)
  '-t', durationSeconds,
  
  // 6. Output URL (reconnect params for input, not output for RTMP)
  rtmpUrl
]

// For input reconnection (HTTP/HTTPS sources):
// Add before -i: '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '10'
```

### CPU Usage Estimation per Stream

| Mode | Threads | Est. CPU per Stream | Max Streams (4-core) |
|------|---------|---------------------|----------------------|
| Copy | 2 | ~2-5% | 20+ streams |
| Ultrafast | 2 | ~8-15% | 6-10 streams |
| Veryfast (old) | unlimited | ~20-40% | 2-4 streams |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the prework analysis, the following properties have been identified:

### Property 1: Thread Limiting Present
*For any* stream configuration, when FFmpeg arguments are built, the arguments array SHALL contain thread limiting parameter `-threads` with a value between 1 and 4.
**Validates: Requirements 1.2, 3.1**

### Property 2: Copy Mode for Non-Advanced Streams
*For any* stream with `use_advanced_settings=false`, the built FFmpeg arguments SHALL contain `-c:v copy` and `-c:a copy` (when no audio merge).
**Validates: Requirements 1.3, 1.5**

### Property 3: Ultrafast Preset for Encoding
*For any* stream that requires re-encoding (advanced settings enabled), the FFmpeg arguments SHALL contain `-preset ultrafast` instead of `veryfast`.
**Validates: Requirements 2.2, 3.2**

### Property 4: Audio Bitrate Minimum
*For any* stream with audio merge enabled, the FFmpeg arguments SHALL contain `-b:a 128k` or higher.
**Validates: Requirements 2.4**

### Property 5: Buffer Settings Optimized
*For any* stream configuration, the FFmpeg arguments SHALL contain `-bufsize` with value ≤ 4M and `-max_muxing_queue_size` with value ≤ 7000.
**Validates: Requirements 3.4, 8.1**

### Property 6: Essential Parameters Preserved
*For any* stream configuration, the built FFmpeg arguments SHALL always contain: input file path, output RTMP URL, and format specification `-f flv`.
**Validates: Requirements 6.2**

### Property 7: Playlist Optimization Compatible
*For any* playlist stream, the FFmpeg arguments SHALL contain both `-f concat` and thread limiting parameters.
**Validates: Requirements 6.4**

### Property 8: Duration Hours to Seconds Conversion
*For any* duration value in hours, the calculated seconds SHALL equal `hours * 3600` exactly.
**Validates: Requirements 9.1**

### Property 9: Duration from End Time Calculation
*For any* stream with end_time and start_time, the calculated duration SHALL equal `(endTime - startTime)` in seconds.
**Validates: Requirements 9.2**

### Property 10: Duration Parameter Placement
*For any* stream with duration set, the `-t` parameter SHALL appear in the arguments array at an index less than the RTMP URL index.
**Validates: Requirements 9.4**

### Property 11: Loop with Duration Correct Order
*For any* stream with loop enabled and duration set, the arguments SHALL contain `-stream_loop` before input and `-t` before output URL.
**Validates: Requirements 10.1**

### Property 12: Audio Loop Sync
*For any* stream with separate audio and duration limit, the audio input SHALL have `-stream_loop -1` to ensure continuous audio.
**Validates: Requirements 10.2**

## Error Handling

### FFmpeg Process Errors

1. **Startup Failure**: Log error, return failure response with details
2. **Runtime Crash (SIGSEGV)**: Retry up to 3 times with 3-second delay
3. **Exit Code Non-Zero**: Log error, attempt restart if retry count not exceeded
4. **Duration Exceeded**: Normal termination, update status to offline

### Fallback Mechanisms

1. **Hardware Acceleration Unavailable**: Continue with software encoding
2. **Copy Mode Incompatible**: Fallback to encoding with ultrafast preset
3. **Thread Limiting Issues**: Use default (no thread limit)

### Recovery Flow

```
FFmpeg Error → Check Error Type → 
  ├─ Recoverable → Increment Retry → Restart Stream
  ├─ Duration Exceeded → Normal Stop → Update Status
  └─ Max Retries → Stop → Log Error → Update Status Offline
```

## Testing Strategy

### Unit Testing

Unit tests akan memverifikasi:
- FFmpeg arguments builder menghasilkan arguments yang benar
- Duration calculation menghasilkan nilai yang akurat
- Parameter placement sesuai spesifikasi

### Property-Based Testing

Menggunakan **fast-check** library untuk JavaScript property-based testing.

Setiap property test akan:
1. Generate random stream configurations
2. Build FFmpeg arguments
3. Verify property holds for all generated inputs
4. Run minimum 100 iterations per property

Test annotations format:
```javascript
// **Feature: cpu-optimization, Property 1: Thread Limiting Present**
// **Validates: Requirements 1.2, 3.1**
```

### Integration Testing

- Test actual FFmpeg process startup with optimized arguments
- Verify stream stability over extended duration
- Test concurrent streams CPU usage

### Test File Structure

```
tests/
  cpu-optimization.test.js       # Unit tests
  cpu-optimization.property.js   # Property-based tests
```
