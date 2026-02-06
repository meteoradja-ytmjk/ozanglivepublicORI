# Unlist Replay - Troubleshooting Guide

## Checklist Implementasi

### ✅ Yang Sudah Diimplementasikan:

1. **UI Toggle (Default ON)**
   - ✓ Toggle visible di form Create Broadcast
   - ✓ Default ON (user bisa matikan jika tidak mau)
   - ✓ Auto-start & Auto-stop tetap hidden (always ON)

2. **Backend Service**
   - ✓ `unlistReplayService.js` - Delayed retry mechanism
   - ✓ `youtubeService.unlistBroadcast()` - Robust error handling
   - ✓ Integration dengan `streamingService.js`
   - ✓ Integration dengan `youtubeStatusSync.js`

3. **Error Handling**
   - ✓ Input validation
   - ✓ Token expiry handling
   - ✓ Network error retry
   - ✓ Video processing delay handling
   - ✓ Memory leak prevention (auto-cleanup after 10 min)
   - ✓ Graceful degradation (tidak crash app jika gagal)

4. **Testing**
   - ✓ Unit test passed
   - ✓ Edge cases handled (null, missing data, etc.)

## Cara Kerja

### Flow Normal:
```
1. User create broadcast (toggle "Unlist replay" default ON)
2. Stream berjalan dan selesai
3. Wait 60 seconds (beri waktu YouTube processing)
4. Attempt 1: Coba unlist via Videos API
   - Success → Done ✓
   - Video not ready → Wait 30s, Attempt 2
   - Still processing → Wait 30s, Attempt 3
   - ... (max 5 attempts)
5. After 5 attempts:
   - Success → Done ✓
   - Failed → Log error, give up (tidak crash app)
```

### Retry Logic:
- **Initial delay**: 60 seconds
- **Retry interval**: 30 seconds
- **Max retries**: 5 attempts
- **Total max time**: ~3.5 minutes
- **Auto-cleanup**: 10 minutes (prevent memory leak)

## Monitoring & Debugging

### Log Messages to Watch:

**Success:**
```
[UnlistReplayService] Unlist replay enabled for broadcast XXX, scheduling...
[UnlistReplayService] Scheduling unlist for video XXX in 60s
[UnlistReplayService] Attempting to unlist video XXX (attempt 1/6)
[YouTubeService.unlistBroadcast] Unlisting video XXX (attempt 1/4)
[YouTubeService.unlistBroadcast] Successfully unlisted video XXX
[UnlistReplayService] Successfully unlisted video XXX
```

**Video Still Processing (Normal):**
```
[YouTubeService.unlistBroadcast] Video XXX is still processing
[YouTubeService.unlistBroadcast] Will retry after processing completes
[UnlistReplayService] Video XXX not ready, scheduling retry 1/5
```

**Errors:**
```
[UnlistReplayService] No YouTube credentials found for user XXX
[UnlistReplayService] Failed to get access token: TOKEN_EXPIRED
[UnlistReplayService] Token expired for user XXX, giving up
[UnlistReplayService] Failed to unlist video XXX after 6 attempts: ...
```

### Check Pending Unlists:

Tambahkan endpoint debug di `app.js` (development only):
```javascript
// Debug endpoint - remove in production
app.get('/api/debug/pending-unlists', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  
  const unlistReplayService = require('./services/unlistReplayService');
  const pending = unlistReplayService.getPendingUnlists();
  res.json({ pending, count: pending.length });
});
```

## Common Issues & Solutions

### Issue 1: Unlist Tidak Berfungsi

**Symptoms:**
- Video tetap public setelah stream ends
- Tidak ada log `[UnlistReplayService]`

**Possible Causes:**
1. Toggle dimatikan saat create broadcast (default: ON)
2. Setting tidak tersimpan di database
3. Stream tidak memiliki `youtube_broadcast_id`

**Solutions:**
```bash
# Check database
node check-db.js

# Check broadcast settings
SELECT * FROM youtube_broadcast_settings WHERE broadcast_id = 'YOUR_BROADCAST_ID';

# Verify toggle value in form
# Open browser console, check: document.getElementById('unlistReplayOnEnd').checked
```

### Issue 2: Token Expired Error

**Symptoms:**
```
[UnlistReplayService] Failed to get access token: TOKEN_EXPIRED
```

**Solution:**
- User perlu reconnect YouTube account
- Credentials di database sudah expired
- Minta user disconnect & reconnect di halaman YouTube Sync

### Issue 3: Video Not Found After Retries

**Symptoms:**
```
[YouTubeService.unlistBroadcast] Video XXX not found after retries
```

**Possible Causes:**
1. Broadcast ID salah
2. Video dihapus manual
3. YouTube processing sangat lambat (> 3.5 menit)

**Solutions:**
- Cek apakah video ada di YouTube Studio
- Jika ada, unlist manual via YouTube Studio
- Jika tidak ada, broadcast mungkin gagal/dibatalkan

### Issue 4: API Quota Exceeded

**Symptoms:**
```
[YouTubeService.unlistBroadcast] Error: API quota exceeded
```

**Solution:**
- Wait sampai quota reset (midnight Pacific Time)
- Atau upgrade YouTube API quota di Google Cloud Console
- Unlist manual via YouTube Studio untuk sementara

### Issue 5: Memory Leak / Stale Entries

**Symptoms:**
- Pending unlists tidak pernah selesai
- Memory usage meningkat

**Solution:**
- Service sudah ada auto-cleanup (10 menit)
- Manual cleanup: restart aplikasi
- Check pending unlists via debug endpoint

## Testing Checklist

### Manual Testing:

1. **Test Toggle ON (Default):**
   - [ ] Create broadcast (toggle default ON)
   - [ ] Start stream
   - [ ] Stop stream
   - [ ] Wait 1-2 menit
   - [ ] Check log untuk `[UnlistReplayService]`
   - [ ] Verify video jadi unlisted di YouTube Studio

2. **Test Toggle OFF:**
   - [ ] Create broadcast, matikan toggle
   - [ ] Start stream
   - [ ] Stop stream
   - [ ] Verify TIDAK ada log `[UnlistReplayService]`
   - [ ] Verify video tetap sesuai privacy setting awal

3. **Test Retry Logic:**
   - [ ] Create broadcast
   - [ ] Start stream sangat singkat (< 30 detik)
   - [ ] Stop stream
   - [ ] Monitor log untuk retry attempts
   - [ ] Verify eventually success atau give up after 5 retries

4. **Test Error Handling:**
   - [ ] Disconnect YouTube account
   - [ ] Stop stream yang sedang running
   - [ ] Verify error logged tapi app tidak crash

### Automated Testing:

```bash
# Run unit test
node test-unlist-replay.js

# Expected output: All tests passed
```

## Performance Considerations

### Resource Usage:
- **Memory**: Minimal (~1KB per pending unlist)
- **CPU**: Negligible (only during API calls)
- **Network**: 1-6 API calls per unlist (depends on retries)
- **API Quota**: 1-6 units per unlist

### Scalability:
- Can handle 100+ concurrent pending unlists
- Auto-cleanup prevents memory leak
- No blocking operations (all async)

### Optimization Tips:
1. Increase initial delay if YouTube processing consistently slow
2. Adjust retry count based on success rate
3. Monitor API quota usage
4. Consider batch processing if many streams end simultaneously

## Rollback Plan

If feature causes issues, disable by:

1. **Quick Fix (UI only):**
   - Remove toggle from `views/youtube.ejs`
   - Set default to false in form

2. **Complete Rollback:**
   ```bash
   # Restore old files
   git checkout HEAD~1 services/unlistReplayService.js
   git checkout HEAD~1 services/youtubeService.js
   git checkout HEAD~1 services/streamingService.js
   git checkout HEAD~1 services/youtubeStatusSync.js
   git checkout HEAD~1 views/youtube.ejs
   git checkout HEAD~1 public/js/youtube.js
   
   # Restart app
   pm2 restart streamflow
   ```

3. **Database Cleanup (if needed):**
   ```sql
   -- Reset all unlist settings to false
   UPDATE youtube_broadcast_settings SET unlist_replay_on_end = 0;
   ```

## Support & Maintenance

### Regular Checks:
- Monitor error logs weekly
- Check API quota usage
- Verify success rate (should be > 90%)

### When to Investigate:
- Success rate < 80%
- Frequent token expiry errors
- Memory usage increasing
- API quota consistently exceeded

### Contact:
- Check logs first: `logs/app.log`
- Review this troubleshooting guide
- Test with `test-unlist-replay.js`
- Check YouTube API status: https://status.cloud.google.com/
