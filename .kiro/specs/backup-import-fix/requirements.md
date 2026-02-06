# Requirements Document

## Introduction

Dokumen ini mendefinisikan persyaratan untuk memperbaiki sistem import backup pada aplikasi StreamFlow. Saat ini, ketika user melakukan export data berhasil, namun saat import kembali, beberapa setting tidak sesuai dengan pengaturan sebelumnya dan ada data yang tersembunyi (hidden) tidak muncul di list. Perbaikan ini bertujuan untuk memastikan konsistensi data antara export dan import.

## Glossary

- **Backup Service**: Layanan yang menangani export dan import konfigurasi stream
- **Stream**: Entitas yang merepresentasikan konfigurasi streaming ke platform seperti YouTube, Facebook, dll
- **Export Fields**: Field-field yang disertakan dalam file backup saat export
- **Import**: Proses membaca file backup dan membuat ulang stream dengan konfigurasi yang sama
- **Round-trip**: Proses export kemudian import yang harus menghasilkan data yang identik

## Requirements

### Requirement 1

**User Story:** As a user, I want to export all my stream settings completely, so that I can backup and restore them accurately.

#### Acceptance Criteria

1. WHEN a user exports stream settings THEN the Backup Service SHALL include all configuration fields including `stream_duration_minutes`, `schedule_time`, and `recurring_time`
2. WHEN a user exports stream settings THEN the Backup Service SHALL preserve the exact values of all numeric and boolean fields without conversion
3. WHEN a user exports stream settings THEN the Backup Service SHALL include `schedule_days` array in its original format

### Requirement 2

**User Story:** As a user, I want to import my backup file and have all streams appear correctly in the list, so that I can restore my previous configuration.

#### Acceptance Criteria

1. WHEN a user imports a backup file THEN the Backup Service SHALL create streams with the correct `status` based on schedule configuration
2. WHEN a user imports a backup file with scheduled streams THEN the Backup Service SHALL set status to `scheduled` for streams with valid schedule configuration
3. WHEN a user imports a backup file THEN the Backup Service SHALL preserve all duration values including `stream_duration_minutes`
4. WHEN a user imports a backup file THEN the Backup Service SHALL correctly parse and store `schedule_days` array

### Requirement 3

**User Story:** As a user, I want the import process to maintain data integrity, so that my restored streams work exactly as before.

#### Acceptance Criteria

1. WHEN export then import is performed THEN the Backup Service SHALL produce streams with equivalent configuration values (round-trip consistency)
2. WHEN a stream has `schedule_type` of `daily` or `weekly` THEN the imported stream SHALL have `recurring_enabled` set correctly
3. WHEN a stream has `recurring_time` set THEN the imported stream SHALL preserve the exact time value

### Requirement 4

**User Story:** As a user, I want imported streams to appear in the correct lists, so that I can manage them properly.

#### Acceptance Criteria

1. WHEN a stream is imported with `schedule_type` of `daily` or `weekly` THEN the stream SHALL appear in the scheduled streams list
2. WHEN a stream is imported with `schedule_time` set THEN the stream SHALL appear in the scheduled streams list
3. WHEN a stream is imported without schedule configuration THEN the stream SHALL appear in the offline streams list
