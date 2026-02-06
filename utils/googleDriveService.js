const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { paths, getUniqueFilename } = require('./storage');

function extractFileId(driveUrl) {
  let match = driveUrl.match(/\/file\/d\/([^\/]+)/);
  if (match) return match[1];

  match = driveUrl.match(/\?id=([^&]+)/);
  if (match) return match[1];

  match = driveUrl.match(/\/d\/([^\/]+)/);
  if (match) return match[1];

  if (/^[a-zA-Z0-9_-]{25,}$/.test(driveUrl.trim())) {
    return driveUrl.trim();
  }

  throw new Error('Invalid Google Drive URL format');
}

async function downloadFile(fileId, progressCallback = null, targetFolder = 'videos') {
  try {
    const targetPath = targetFolder === 'audios' ? paths.audios : paths.videos;
    const tempFilename = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const tempPath = path.join(targetPath, tempFilename);
    
    let response;
    let retryCount = 0;
    const maxRetries = 5;
    
    // List of download URL patterns to try
    const downloadUrls = [
      `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
      `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      `https://drive.google.com/uc?id=${fileId}&export=download&confirm=yes`,
      `https://docs.google.com/uc?export=download&id=${fileId}&confirm=t`
    ];
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Connection': 'keep-alive',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    };
    
    // First, try to get the confirmation token for large files
    let confirmToken = null;
    try {
      const initialUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      console.log(`Getting confirmation token from: ${initialUrl}`);
      
      const initialResponse = await axios.get(initialUrl, {
        timeout: 30000,
        maxRedirects: 0,
        validateStatus: (status) => status < 400 || status === 303,
        headers
      });
      
      // Check for confirmation token in cookies or response
      const cookies = initialResponse.headers['set-cookie'];
      if (cookies) {
        for (const cookie of cookies) {
          const match = cookie.match(/download_warning_\d+_[^=]+=([^;]+)/);
          if (match) {
            confirmToken = match[1];
            console.log(`Found confirmation token: ${confirmToken}`);
            break;
          }
        }
      }
      
      // Also check response body for confirmation link
      if (!confirmToken && typeof initialResponse.data === 'string') {
        const confirmMatch = initialResponse.data.match(/confirm=([0-9A-Za-z_-]+)/);
        if (confirmMatch) {
          confirmToken = confirmMatch[1];
          console.log(`Found confirmation token in body: ${confirmToken}`);
        }
        
        // Check for uuid token
        const uuidMatch = initialResponse.data.match(/uuid=([0-9a-f-]+)/i);
        if (uuidMatch) {
          const uuid = uuidMatch[1];
          downloadUrls.unshift(`https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t&uuid=${uuid}`);
          console.log(`Found UUID: ${uuid}`);
        }
      }
    } catch (err) {
      console.log('Could not get confirmation token:', err.message);
    }
    
    // Add URL with confirmation token if found
    if (confirmToken) {
      downloadUrls.unshift(`https://drive.google.com/uc?export=download&id=${fileId}&confirm=${confirmToken}`);
      downloadUrls.unshift(`https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=${confirmToken}`);
    }
    
    while (retryCount < maxRetries) {
      const downloadUrl = downloadUrls[retryCount % downloadUrls.length];
      
      try {
        console.log(`Attempt ${retryCount + 1}: Downloading from: ${downloadUrl}`);
        
        // Use GET request directly with stream
        response = await axios({
          method: 'GET',
          url: downloadUrl,
          responseType: 'stream',
          timeout: 600000,
          maxRedirects: 10,
          headers,
          // Handle redirects manually to capture cookies
          beforeRedirect: (options, { headers: responseHeaders }) => {
            if (responseHeaders['set-cookie']) {
              options.headers.Cookie = responseHeaders['set-cookie'].join('; ');
            }
          }
        });
        
        const contentType = response.headers['content-type'] || '';
        const contentLength = parseInt(response.headers['content-length'] || '0');
        
        console.log(`Response Content-Type: ${contentType}, Content-Length: ${contentLength}`);
        
        // If we got HTML, it's likely a confirmation page
        if (contentType.includes('text/html') && contentLength < 100000) {
          console.log('Received HTML response, trying next URL...');
          retryCount++;
          
          // Consume the stream to prevent memory leak
          response.data.resume();
          
          if (retryCount >= maxRetries) {
            throw new Error('File appears to be private or requires additional authentication. Please ensure the file is publicly accessible (Anyone with the link can view).');
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        
        // Success - we got a non-HTML response
        break;
      } catch (error) {
        retryCount++;
        console.log(`Download attempt ${retryCount} failed:`, error.message);
        
        if (retryCount >= maxRetries) {
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
      }
    }

    if (!response || response.status !== 200) {
      throw new Error(`HTTP ${response?.status || 'unknown'}: Failed to download file`);
    }
    
    const responseContentType = response.headers['content-type'] || '';
    const totalSize = parseInt(response.headers['content-length'] || '0');
    
    console.log(`Starting file download. Size: ${totalSize > 0 ? (totalSize / 1024 / 1024).toFixed(2) + ' MB' : 'unknown'}`);
    
    if (responseContentType.includes('text/html') && totalSize < 100000) {
      throw new Error('Received HTML page instead of video file. The file might be private or require additional permissions.');
    }

    let downloadedSize = 0;
    let lastProgress = 0;
    let lastProgressTime = Date.now();

    const writer = fs.createWriteStream(tempPath);

    response.data.on('data', (chunk) => {
      downloadedSize += chunk.length;
      
      const now = Date.now();
      // Update progress every 500ms or when significant progress is made
      if (progressCallback && (now - lastProgressTime > 500 || downloadedSize === totalSize)) {
        lastProgressTime = now;
        
        if (totalSize > 0) {
          const progress = Math.min(Math.round((downloadedSize / totalSize) * 100), 100);
          if (progress > lastProgress) {
            lastProgress = progress;
            progressCallback({
              id: fileId,
              filename: 'Google Drive File',
              progress: progress,
              downloaded: downloadedSize,
              total: totalSize
            });
          }
        } else {
          // Unknown size - report downloaded bytes
          progressCallback({
            id: fileId,
            filename: 'Google Drive File',
            progress: -1, // Indicates unknown progress
            downloaded: downloadedSize,
            total: 0
          });
        }
      }
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        try {
          if (!fs.existsSync(tempPath)) {
            reject(new Error('Downloaded file not found'));
            return;
          }

          const stats = fs.statSync(tempPath);
          const fileSize = stats.size;

          if (fileSize === 0) {
            fs.unlinkSync(tempPath);
            reject(new Error('Downloaded file is empty. The file might be private, not accessible, or the link is invalid.'));
            return;
          }

          if (fileSize < 1024) {
            fs.unlinkSync(tempPath);
            reject(new Error('Downloaded file is too small. Please check if the Google Drive link is correct and the file is publicly accessible.'));
            return;
          }

          const buffer = Buffer.alloc(512);
          const fd = fs.openSync(tempPath, 'r');
          fs.readSync(fd, buffer, 0, 512, 0);
          fs.closeSync(fd);
          
          const fileHeader = buffer.toString('utf8', 0, 100).toLowerCase();
          
          if (fileHeader.includes('<!doctype html') || fileHeader.includes('<html') || fileHeader.includes('<head>')) {
            fs.unlinkSync(tempPath);
            reject(new Error('Downloaded content is an HTML page, not a media file. The file might be private, require authentication, or the sharing settings are incorrect.'));
            return;
          }
          
          // Determine file type and extension based on target folder
          let fileExtension = '.mp4';
          let mimeType = 'video/mp4';
          
          if (targetFolder === 'audios') {
            // Check for audio file signatures
            const validAudioHeaders = [
              { header: [0x49, 0x44, 0x33], ext: '.mp3', mime: 'audio/mpeg' }, // ID3 (MP3)
              { header: [0xFF, 0xFB], ext: '.mp3', mime: 'audio/mpeg' }, // MP3 frame sync
              { header: [0xFF, 0xFA], ext: '.mp3', mime: 'audio/mpeg' }, // MP3 frame sync
              { header: [0x52, 0x49, 0x46, 0x46], ext: '.wav', mime: 'audio/wav' }, // RIFF (WAV)
              { header: [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70], ext: '.m4a', mime: 'audio/aac' }, // M4A
              { header: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], ext: '.m4a', mime: 'audio/aac' }, // M4A
              { header: [0x00, 0x00, 0x00, 0x1C, 0x66, 0x74, 0x79, 0x70], ext: '.m4a', mime: 'audio/aac' }, // M4A
            ];
            
            let isValidAudio = false;
            for (const audioType of validAudioHeaders) {
              let matches = true;
              for (let i = 0; i < audioType.header.length && i < buffer.length; i++) {
                if (buffer[i] !== audioType.header[i]) {
                  matches = false;
                  break;
                }
              }
              if (matches) {
                isValidAudio = true;
                fileExtension = audioType.ext;
                mimeType = audioType.mime;
                break;
              }
            }
            
            // Also check for ftyp (M4A/AAC)
            if (!isValidAudio && buffer.includes(Buffer.from('ftyp'))) {
              isValidAudio = true;
              fileExtension = '.m4a';
              mimeType = 'audio/aac';
            }
            
            if (!isValidAudio) {
              // Default to mp3 if we can't detect
              fileExtension = '.mp3';
              mimeType = 'audio/mpeg';
            }
          } else {
            // Video validation
            const validVideoHeaders = [
              [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70],
              [0x00, 0x00, 0x00, 0x1C, 0x66, 0x74, 0x79, 0x70],
              [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70],
              [0x1A, 0x45, 0xDF, 0xA3],
              [0x00, 0x00, 0x01, 0xBA],
              [0x00, 0x00, 0x01, 0xB3],
              [0x46, 0x4C, 0x56, 0x01]
            ];
            
            let isValidVideo = false;
            for (const header of validVideoHeaders) {
              let matches = true;
              for (let i = 0; i < header.length && i < buffer.length; i++) {
                if (buffer[i] !== header[i]) {
                  matches = false;
                  break;
                }
              }
              if (matches) {
                isValidVideo = true;
                break;
              }
            }
            
            if (!isValidVideo && !buffer.includes(Buffer.from('ftyp'))) {
              fs.unlinkSync(tempPath);
              reject(new Error('Downloaded file does not appear to be a valid video format. Please ensure the Google Drive link points to a video file and is publicly accessible.'));
              return;
            }
          }

          const originalFilename = `gdrive_${fileId}${fileExtension}`;
          const uniqueFilename = getUniqueFilename(originalFilename);
          const finalPath = path.join(targetPath, uniqueFilename);
          
          fs.renameSync(tempPath, finalPath);
          
          console.log(`Downloaded file from Google Drive: ${uniqueFilename} (${fileSize} bytes)`);
          resolve({
            filename: uniqueFilename,
            originalFilename: originalFilename,
            localFilePath: finalPath,
            mimeType: mimeType,
            fileSize: fileSize
          });
        } catch (error) {
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
          reject(new Error(`Error processing downloaded file: ${error.message}`));
        }
      });

      writer.on('error', (error) => {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
        reject(new Error(`Error writing file: ${error.message}`));
      });

      response.data.on('error', (error) => {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
        reject(new Error(`Error downloading file: ${error.message}`));
      });
    });
  } catch (error) {
    console.error('Error downloading file from Google Drive:', error);
    
    if (error.response) {
      if (error.response.status === 403) {
        throw new Error('File is private or sharing is disabled. Please make sure the file is publicly accessible and try again.');
      } else if (error.response.status === 404) {
        throw new Error('File not found. Please check the Google Drive URL and ensure the file exists.');
      } else if (error.response.status === 429) {
        throw new Error('Too many requests. Please wait a few minutes and try again.');
      } else if (error.response.status >= 500) {
        throw new Error('Google Drive server error. Please try again later.');
      } else {
        throw new Error(`Download failed with HTTP ${error.response.status}. Please try again or check if the file is accessible.`);
      }
    } else if (error.code === 'ENOTFOUND') {
      throw new Error('Network connection failed. Please check your internet connection and try again.');
    } else if (error.code === 'ETIMEDOUT') {
      throw new Error('Download timeout. The file might be too large or your connection is slow. Please try again.');
    } else if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') {
      throw new Error('Connection was reset. Please check your internet connection and try again.');
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Download was interrupted. Please try again.');
    } else {
      throw new Error(`Download failed: ${error.message}. Please try again or check your internet connection.`);
    }
  }
}

module.exports = {
  extractFileId,
  downloadFile
};
