/**
 * YouTube Sync Client-Side JavaScript
 */

// Get CSRF token from meta tag or form
function getCsrfToken() {
  const metaTag = document.querySelector('meta[name="csrf-token"]');
  if (metaTag) return metaTag.getAttribute('content');
  
  const hiddenInput = document.querySelector('input[name="_csrf"]');
  if (hiddenInput) return hiddenInput.value;
  
  return '';
}

// Show toast notification
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `fixed bottom-24 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg z-50 transition-all duration-300 ${
    type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'
  } text-white`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Credentials Form Handler
const credentialsForm = document.getElementById('credentialsForm');
if (credentialsForm) {
  credentialsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const connectBtn = document.getElementById('connectBtn');
    const originalText = connectBtn.innerHTML;
    connectBtn.innerHTML = '<i class="ti ti-loader animate-spin"></i> Connecting...';
    connectBtn.disabled = true;
    
    try {
      const formData = {
        clientId: document.getElementById('clientId').value,
        clientSecret: document.getElementById('clientSecret').value,
        refreshToken: document.getElementById('refreshToken').value
      };
      
      const response = await fetch('/api/youtube/credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrfToken()
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        showToast('YouTube account connected successfully!');
        setTimeout(() => window.location.reload(), 1000);
      } else {
        showToast(data.error || 'Failed to connect', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showToast('An error occurred', 'error');
    } finally {
      connectBtn.innerHTML = originalText;
      connectBtn.disabled = false;
    }
  });
}

// Disconnect specific YouTube account
async function disconnectAccount(accountId, channelName) {
  if (!confirm(`Are you sure you want to disconnect "${channelName}"?`)) {
    return;
  }
  
  try {
    const response = await fetch(`/api/youtube/credentials/${accountId}`, {
      method: 'DELETE',
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('YouTube account disconnected');
      setTimeout(() => window.location.reload(), 1000);
    } else {
      showToast(data.error || 'Failed to disconnect', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('An error occurred', 'error');
  }
}

// Set primary account
async function setPrimaryAccount(accountId) {
  try {
    const response = await fetch(`/api/youtube/credentials/${accountId}/primary`, {
      method: 'PUT',
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('Primary account updated');
      setTimeout(() => window.location.reload(), 1000);
    } else {
      showToast(data.error || 'Failed to set primary', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('An error occurred', 'error');
  }
}

// Legacy disconnect function for backward compatibility
async function disconnectYouTube() {
  if (!confirm('Are you sure you want to disconnect your YouTube account?')) {
    return;
  }
  
  try {
    const response = await fetch('/api/youtube/credentials', {
      method: 'DELETE',
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('YouTube account disconnected');
      setTimeout(() => window.location.reload(), 1000);
    } else {
      showToast(data.error || 'Failed to disconnect', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('An error occurred', 'error');
  }
}

// Add Account Modal
function openAddAccountModal() {
  document.getElementById('addAccountModal').classList.remove('hidden');
}

function closeAddAccountModal() {
  document.getElementById('addAccountModal').classList.add('hidden');
  document.getElementById('addAccountForm').reset();
}

// Add Account Form Handler
const addAccountForm = document.getElementById('addAccountForm');
if (addAccountForm) {
  addAccountForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const addBtn = document.getElementById('addAccountBtn');
    const originalText = addBtn.innerHTML;
    addBtn.innerHTML = '<i class="ti ti-loader animate-spin"></i> Adding...';
    addBtn.disabled = true;
    
    try {
      const formData = {
        clientId: document.getElementById('newClientId').value,
        clientSecret: document.getElementById('newClientSecret').value,
        refreshToken: document.getElementById('newRefreshToken').value
      };
      
      const response = await fetch('/api/youtube/credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrfToken()
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        showToast('YouTube account added successfully!');
        closeAddAccountModal();
        setTimeout(() => window.location.reload(), 1000);
      } else {
        showToast(data.error || 'Failed to add account', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showToast('An error occurred', 'error');
    } finally {
      addBtn.innerHTML = originalText;
      addBtn.disabled = false;
    }
  });
}

// Fetch available stream keys for specific account
async function fetchStreams(accountId = null) {
  const select = document.getElementById('streamKeySelect');
  const loading = document.getElementById('streamKeyLoading');
  
  if (!select) return;
  
  if (loading) loading.classList.remove('hidden');
  
  try {
    let url = '/api/youtube/streams';
    if (accountId) {
      url += `?accountId=${accountId}`;
    }
    
    console.log('[fetchStreams] Fetching from:', url);
    
    const response = await fetch(url, {
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    console.log('[fetchStreams] Response:', data);
    
    // Clear existing options except first
    select.innerHTML = '<option value="">Create new stream key</option>';
    
    if (data.success && data.streams && data.streams.length > 0) {
      console.log('[fetchStreams] Found', data.streams.length, 'stream keys');
      data.streams.forEach(stream => {
        const option = document.createElement('option');
        option.value = stream.id;
        option.textContent = `${stream.title} (${stream.resolution} @ ${stream.frameRate})`;
        select.appendChild(option);
      });
    } else {
      console.log('[fetchStreams] No stream keys found or error:', data.error || 'empty response');
    }
  } catch (error) {
    console.error('[fetchStreams] Error:', error);
  } finally {
    if (loading) loading.classList.add('hidden');
  }
}

// Handle account change in create broadcast modal
function onAccountChange(accountId) {
  if (accountId) {
    fetchStreams(accountId);
    fetchChannelDefaults(accountId);
  }
}

// Handle stream key change - auto-select bound folder if exists
async function onStreamKeyChange(streamKeyId) {
  const mappingInput = document.getElementById('streamKeyFolderMapping');
  
  if (!streamKeyId) return;
  
  // First check form mapping
  let boundFolder = undefined;
  if (mappingInput) {
    try {
      const mapping = JSON.parse(mappingInput.value || '{}');
      if (mapping[streamKeyId] !== undefined) {
        boundFolder = mapping[streamKeyId];
      }
    } catch (e) {
      // Ignore parse error
    }
  }
  
  // If not found in form, check server database
  if (boundFolder === undefined) {
    boundFolder = await getStreamKeyFolderMappingFromServer(streamKeyId);
  }
  
  // If found, auto-select the bound folder
  if (boundFolder !== undefined) {
    console.log(`[onStreamKeyChange] Stream key ${streamKeyId} bound to folder: ${boundFolder || 'root'}`);
    // Pass the exact value - empty string for root, folder name for folder
    openThumbnailFolder(boundFolder);
    showToast(`Folder "${boundFolder || 'Root'}" otomatis dipilih (terikat ke stream key)`);
  }
}

// Current thumbnail folder state
let currentThumbnailFolder = null;

// Fetch thumbnail folders
async function fetchThumbnailFolders() {
  const folderList = document.getElementById('thumbnailFolderList');
  if (!folderList) return;
  
  try {
    const response = await fetch('/api/thumbnail-folders', {
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    
    if (data.success && data.folders) {
      folderList.innerHTML = '';
      
      data.folders.forEach(folder => {
        const div = document.createElement('div');
        div.className = `folder-item flex items-center gap-2 py-1.5 text-sm cursor-pointer transition-colors hover:bg-dark-600/50 rounded border-b border-gray-700/50 ${
          currentThumbnailFolder === folder.name 
            ? 'text-primary' 
            : 'text-white'
        }`;
        div.onclick = () => openThumbnailFolder(folder.name);
        div.innerHTML = `
          <i class="ti ti-folder text-gray-400 shrink-0"></i>
          <span class="flex-1 truncate">${escapeHtml(folder.name)}</span>
          <button type="button" class="shrink-0 text-red-500 hover:text-red-400 font-bold" onclick="event.stopPropagation(); deleteThumbnailFolder('${escapeJsString(folder.name)}')" title="Delete">
            ✕
          </button>
        `;
        folderList.appendChild(div);
      });
    }
  } catch (error) {
    console.error('Error fetching thumbnail folders:', error);
  }
}

// Open thumbnail folder
function openThumbnailFolder(folderName) {
  currentThumbnailFolder = folderName;
  
  // Update hidden input
  const folderInput = document.getElementById('currentThumbnailFolder');
  if (folderInput) {
    folderInput.value = folderName || '';
  }
  
  // Update folder indicator
  const indicator = document.getElementById('currentFolderIndicator');
  const folderNameEl = document.getElementById('currentFolderName');
  const rootBtn = document.getElementById('thumbnailRootBtn');
  
  if (folderName) {
    if (indicator) indicator.classList.remove('hidden');
    if (folderNameEl) folderNameEl.textContent = folderName;
    if (rootBtn) {
      rootBtn.classList.remove('bg-primary/20', 'text-primary');
      rootBtn.classList.add('bg-dark-600', 'text-gray-300');
    }
  } else {
    if (indicator) indicator.classList.add('hidden');
    if (rootBtn) {
      rootBtn.classList.add('bg-primary/20', 'text-primary');
      rootBtn.classList.remove('bg-dark-600', 'text-gray-300');
    }
  }
  
  // Update folder items
  document.querySelectorAll('.folder-item').forEach(item => {
    const itemFolder = item.querySelector('span.truncate')?.textContent;
    if (itemFolder === folderName) {
      item.classList.add('text-primary');
      item.classList.remove('text-white');
    } else {
      item.classList.remove('text-primary');
      item.classList.add('text-white');
    }
  });
  
  // Auto-bind folder to stream key (automatic binding)
  autoBindFolderToStreamKey(folderName);
  
  // Fetch thumbnails for this folder
  fetchThumbnails(folderName);
}

// Auto-bind folder to stream key when folder is selected
function autoBindFolderToStreamKey(folderName) {
  const streamKeySelect = document.getElementById('streamKeySelect');
  const mappingInput = document.getElementById('streamKeyFolderMapping');
  
  console.log('[autoBindFolderToStreamKey] Called with folder:', folderName);
  console.log('[autoBindFolderToStreamKey] Stream key select:', streamKeySelect?.value);
  
  if (!streamKeySelect || !mappingInput || !streamKeySelect.value) {
    console.log('[autoBindFolderToStreamKey] Skipped - no stream key selected');
    return;
  }
  
  // Create or update mapping
  let mapping = {};
  try {
    mapping = JSON.parse(mappingInput.value || '{}');
  } catch (e) {
    mapping = {};
  }
  
  // Map current stream key to current folder (empty string for root)
  mapping[streamKeySelect.value] = folderName || '';
  mappingInput.value = JSON.stringify(mapping);
  
  console.log('[autoBindFolderToStreamKey] Saving mapping:', streamKeySelect.value, '->', folderName || 'root');
  
  // Save to database for persistence across sessions
  saveStreamKeyFolderMappingToServer(streamKeySelect.value, folderName || '');
}

// Save stream key folder mapping to server database
async function saveStreamKeyFolderMappingToServer(streamKeyId, folderName) {
  try {
    const response = await fetch('/api/stream-key-folder-mapping', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken()
      },
      body: JSON.stringify({ streamKeyId, folderName })
    });
    
    const data = await response.json();
    if (data.success) {
      console.log(`[Server] Saved mapping: ${streamKeyId} -> ${folderName || 'root'}`);
    } else {
      console.warn('[Server] Failed to save mapping:', data.error);
    }
  } catch (e) {
    console.warn('[Server] Failed to save stream key folder mapping:', e.message);
  }
}

// Get stream key folder mapping from server database
async function getStreamKeyFolderMappingFromServer(streamKeyId) {
  try {
    const response = await fetch(`/api/stream-key-folder-mapping/${encodeURIComponent(streamKeyId)}`, {
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    if (data.success && data.found) {
      return data.folderName;
    }
    return undefined;
  } catch (e) {
    console.warn('[Server] Failed to get stream key folder mapping:', e.message);
    return undefined;
  }
}

// Get stream key thumbnail index from server database
async function getStreamKeyThumbnailIndexFromServer(streamKeyId) {
  try {
    const response = await fetch(`/api/stream-key-folder-mapping/${encodeURIComponent(streamKeyId)}`, {
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    if (data.success && data.found) {
      return {
        thumbnailIndex: data.thumbnailIndex || 0,
        folderName: data.folderName || ''
      };
    }
    return { thumbnailIndex: 0, folderName: '' };
  } catch (e) {
    console.warn('[Server] Failed to get stream key thumbnail index:', e.message);
    return { thumbnailIndex: 0, folderName: '' };
  }
}

// Get GLOBAL thumbnail index for a folder (shared across all stream keys)
async function getGlobalThumbnailIndexFromServer(folderName) {
  try {
    const globalStreamKeyId = '__GLOBAL__' + (folderName || '');
    const response = await fetch(`/api/stream-key-folder-mapping/${encodeURIComponent(globalStreamKeyId)}`, {
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    if (data.success && data.found) {
      return {
        thumbnailIndex: data.thumbnailIndex || 0,
        folderName: data.folderName || ''
      };
    }
    return { thumbnailIndex: 0, folderName: folderName || '' };
  } catch (e) {
    console.warn('[Server] Failed to get global thumbnail index:', e.message);
    return { thumbnailIndex: 0, folderName: folderName || '' };
  }
}

// Increment stream key thumbnail index (for reschedule)
async function incrementStreamKeyThumbnailIndex(streamKeyId, totalThumbnails = null) {
  try {
    const response = await fetch(`/api/stream-key-folder-mapping/${encodeURIComponent(streamKeyId)}/increment-thumbnail`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken()
      },
      body: JSON.stringify({ totalThumbnails })
    });
    
    const data = await response.json();
    if (data.success) {
      console.log(`[incrementStreamKeyThumbnailIndex] Incremented: ${streamKeyId} ${data.previousIndex} -> ${data.thumbnailIndex}`);
      return {
        success: true,
        previousIndex: data.previousIndex,
        thumbnailIndex: data.thumbnailIndex,
        folderName: data.folderName || ''
      };
    }
    return { success: false };
  } catch (e) {
    console.warn('[Server] Failed to increment stream key thumbnail index:', e.message);
    return { success: false };
  }
}

// Get broadcast settings (including thumbnail folder) from server
async function getBroadcastSettingsFromServer(broadcastId, accountId = null) {
  try {
    let url = `/api/youtube/broadcast-settings/${encodeURIComponent(broadcastId)}`;
    if (accountId) {
      url += `?accountId=${accountId}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    if (data.success && data.found) {
      return data.settings;
    }
    return null;
  } catch (e) {
    console.warn('[Server] Failed to get broadcast settings:', e.message);
    return null;
  }
}

// Create folder modal functions
function openCreateFolderModal() {
  console.log('[DEBUG] openCreateFolderModal called - for THUMBNAIL folder');
  const modal = document.getElementById('createFolderModal');
  if (!modal) {
    console.error('createFolderModal not found');
    return;
  }
  console.log('[DEBUG] Opening createFolderModal');
  modal.classList.remove('hidden');
  const input = document.getElementById('newFolderName');
  if (input) {
    input.value = '';
    input.focus();
  }
}

// NEW: Add Thumbnail Folder Modal Functions (unique names to avoid conflict)
function openAddThumbnailFolderModal() {
  console.log('[THUMBNAIL] Opening Add Thumbnail Folder Modal');
  const modal = document.getElementById('addThumbnailFolderModal');
  if (!modal) {
    console.error('[THUMBNAIL] addThumbnailFolderModal not found!');
    showToast('Error: Modal not found', 'error');
    return;
  }
  modal.classList.remove('hidden');
  const input = document.getElementById('newThumbnailFolderName');
  if (input) {
    input.value = '';
    input.focus();
  }
}

function closeAddThumbnailFolderModal() {
  const modal = document.getElementById('addThumbnailFolderModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

async function submitAddThumbnailFolder(event) {
  event.preventDefault();
  
  const folderName = document.getElementById('newThumbnailFolderName').value.trim();
  if (!folderName) {
    showToast('Please enter folder name', 'error');
    return;
  }
  
  const csrfToken = getCsrfToken();
  console.log('[THUMBNAIL] CSRF Token:', csrfToken ? 'present (' + csrfToken.substring(0, 10) + '...)' : 'MISSING');
  
  if (!csrfToken) {
    showToast('Session expired. Please refresh the page.', 'error');
    return;
  }
  
  const btn = document.getElementById('addThumbnailFolderBtn2');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="ti ti-loader animate-spin"></i> Creating...';
  btn.disabled = true;
  
  try {
    console.log('[THUMBNAIL] Creating folder:', folderName);
    const response = await fetch('/api/thumbnail-folders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      body: JSON.stringify({ name: folderName })
    });
    
    console.log('[THUMBNAIL] Response status:', response.status);
    
    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('[THUMBNAIL] Non-JSON response:', contentType);
      const text = await response.text();
      console.error('[THUMBNAIL] Response text:', text.substring(0, 200));
      showToast('Server error. Please refresh the page and try again.', 'error');
      return;
    }
    
    const data = await response.json();
    console.log('[THUMBNAIL] Response:', data);
    
    if (data.success) {
      showToast('Thumbnail folder created: ' + data.folder.name);
      closeAddThumbnailFolderModal();
      fetchThumbnailFolders();
      openThumbnailFolder(data.folder.name);
    } else {
      showToast(data.error || 'Failed to create folder', 'error');
    }
  } catch (error) {
    console.error('[THUMBNAIL] Error creating folder:', error);
    showToast('Failed to create folder', 'error');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

function closeCreateFolderModal() {
  document.getElementById('createFolderModal').classList.add('hidden');
}

async function submitCreateFolder(event) {
  event.preventDefault();
  
  const folderName = document.getElementById('newFolderName').value.trim();
  if (!folderName) return;
  
  const btn = document.getElementById('createFolderBtn');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="ti ti-loader animate-spin"></i> Creating...';
  btn.disabled = true;
  
  try {
    const response = await fetch('/api/thumbnail-folders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken()
      },
      body: JSON.stringify({ name: folderName })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('Folder created successfully');
      closeCreateFolderModal();
      fetchThumbnailFolders();
      openThumbnailFolder(data.folder.name);
    } else {
      showToast(data.error || 'Failed to create folder', 'error');
    }
  } catch (error) {
    console.error('Error creating folder:', error);
    showToast('Failed to create folder', 'error');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

// Rename folder modal functions
function openRenameFolderModal(folderName) {
  document.getElementById('renameFolderModal').classList.remove('hidden');
  document.getElementById('renameFolderOldName').value = folderName;
  document.getElementById('renameFolderNewName').value = folderName;
  document.getElementById('renameFolderNewName').focus();
  document.getElementById('renameFolderNewName').select();
}

function closeRenameFolderModal() {
  document.getElementById('renameFolderModal').classList.add('hidden');
}

async function submitRenameFolder(event) {
  event.preventDefault();
  
  const oldName = document.getElementById('renameFolderOldName').value;
  const newName = document.getElementById('renameFolderNewName').value.trim();
  
  if (!newName || newName === oldName) {
    closeRenameFolderModal();
    return;
  }
  
  const btn = document.getElementById('renameFolderBtn');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="ti ti-loader animate-spin"></i> Renaming...';
  btn.disabled = true;
  
  try {
    const response = await fetch(`/api/thumbnail-folders/${encodeURIComponent(oldName)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken()
      },
      body: JSON.stringify({ newName })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('Folder renamed successfully');
      closeRenameFolderModal();
      
      // Update current folder if it was renamed
      if (currentThumbnailFolder === oldName) {
        currentThumbnailFolder = data.folder.name;
      }
      
      fetchThumbnailFolders();
      if (currentThumbnailFolder === data.folder.name) {
        openThumbnailFolder(data.folder.name);
      }
    } else {
      showToast(data.error || 'Failed to rename folder', 'error');
    }
  } catch (error) {
    console.error('Error renaming folder:', error);
    showToast('Failed to rename folder', 'error');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

// Delete thumbnail folder
async function deleteThumbnailFolder(folderName) {
  if (!confirm(`Are you sure you want to delete folder "${folderName}" and all its thumbnails?`)) {
    return;
  }
  
  try {
    const response = await fetch(`/api/thumbnail-folders/${encodeURIComponent(folderName)}`, {
      method: 'DELETE',
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('Folder deleted successfully');
      
      // Go back to root if current folder was deleted
      if (currentThumbnailFolder === folderName) {
        openThumbnailFolder(null);
      }
      
      fetchThumbnailFolders();
    } else {
      showToast(data.error || 'Failed to delete folder', 'error');
    }
  } catch (error) {
    console.error('Error deleting folder:', error);
    showToast('Failed to delete folder', 'error');
  }
}

// Fetch available thumbnails from gallery (per user, supports folder)
async function fetchThumbnails(folder = null) {
  // Use provided folder or current folder
  const targetFolder = folder !== undefined ? folder : currentThumbnailFolder;
  
  const grid = document.getElementById('thumbnailGalleryGrid');
  const loading = document.getElementById('thumbnailGalleryLoading');
  const empty = document.getElementById('thumbnailGalleryEmpty');
  const countEl = document.getElementById('thumbnailCount');
  const uploadBtn = document.getElementById('uploadThumbnailGalleryBtn');
  
  if (!grid) return;
  
  grid.innerHTML = '';
  loading.classList.remove('hidden');
  empty.classList.add('hidden');
  
  // Get GLOBAL thumbnail index for "NEXT" indicator (shared across all stream keys)
  let nextThumbnailIndex = 0;
  const globalIndexData = await getGlobalThumbnailIndexFromServer(targetFolder);
  nextThumbnailIndex = globalIndexData.thumbnailIndex || 0;
  console.log('[fetchThumbnails] GLOBAL thumbnail index for folder "' + (targetFolder || 'root') + '":', nextThumbnailIndex);
  
  try {
    let url = '/api/thumbnails';
    if (targetFolder) {
      url += `?folder=${encodeURIComponent(targetFolder)}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    
    // Update count display
    if (countEl) {
      countEl.textContent = `(${data.count || 0}/${data.maxAllowed || 20})`;
    }
    
    // Disable upload button if at max
    if (uploadBtn && data.count >= data.maxAllowed) {
      uploadBtn.disabled = true;
      uploadBtn.classList.add('opacity-50', 'cursor-not-allowed');
      uploadBtn.title = 'Maximum 20 thumbnails reached in this folder. Delete some to upload new ones.';
    } else if (uploadBtn) {
      uploadBtn.disabled = false;
      uploadBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      uploadBtn.title = '';
    }
    
    // Get current thumbnail mode
    const thumbnailMode = document.querySelector('input[name="thumbnailMode"]:checked')?.value || 'sequential';
    const pinnedThumbnailPath = document.getElementById('pinnedThumbnail')?.value || '';
    
    // Get currently selected thumbnail path for "SAVED" indicator (user's manual selection in UI)
    const selectedThumbnailPath = document.getElementById('selectedThumbnailPath')?.value || '';
    
    if (data.success && data.thumbnails && data.thumbnails.length > 0) {
      const totalThumbnails = data.thumbnails.length;
      
      // For rotation mode:
      // - nextThumbnailIndex from DB is the index that WILL BE USED next
      // - So NEXT = nextThumbnailIndex % totalThumbnails
      // - And SAVED (last used) = (nextThumbnailIndex - 1) % totalThumbnails
      const actualNextIndex = nextThumbnailIndex % totalThumbnails;
      // Calculate last used index (the one before nextThumbnailIndex)
      // If nextThumbnailIndex is 0, last used was totalThumbnails - 1
      const lastUsedIndex = nextThumbnailIndex > 0 ? (nextThumbnailIndex - 1) % totalThumbnails : -1;
      
      console.log('[fetchThumbnails] Rotation: nextThumbnailIndex=' + nextThumbnailIndex + ', actualNextIndex=' + actualNextIndex + ', lastUsedIndex=' + lastUsedIndex);
      
      data.thumbnails.forEach((thumb, index) => {
        const div = document.createElement('div');
        const isPinned = pinnedThumbnailPath === thumb.path;
        // SAVED: either user's manual selection OR last used from rotation (if no manual selection)
        const isManualSelection = selectedThumbnailPath === thumb.path;
        const isLastUsedFromRotation = !selectedThumbnailPath && lastUsedIndex >= 0 && index === lastUsedIndex;
        const isSaved = isManualSelection || isLastUsedFromRotation;
        const isNext = !isPinned && !isSaved && index === actualNextIndex;
        
        div.className = `thumbnail-item w-full aspect-video bg-dark-600 rounded-lg cursor-pointer overflow-hidden border-2 ${isPinned ? 'border-green-500 ring-2 ring-green-500/50' : (isSaved ? 'border-primary ring-2 ring-primary/50' : (isNext ? 'border-yellow-500 ring-2 ring-yellow-500/50' : 'border-transparent'))} hover:border-primary/70 transition-all relative group shadow-sm hover:shadow-md`;
        div.innerHTML = `
          <img src="${thumb.url}" class="w-full h-full object-cover" alt="Thumbnail" loading="lazy">
          <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
          <div class="absolute top-1 left-1 w-5 h-5 bg-dark-800/80 rounded-full flex items-center justify-center text-[10px] text-gray-300 font-medium">${index + 1}</div>
          ${isPinned ? '<div class="absolute top-1 left-7 px-1.5 py-0.5 bg-green-500/90 rounded text-[9px] text-white font-medium flex items-center gap-0.5"><i class="ti ti-pin-filled text-[8px]"></i>PIN</div>' : ''}
          ${isSaved && !isPinned ? '<div class="absolute top-1 left-7 px-1.5 py-0.5 bg-primary/90 rounded text-[9px] text-white font-medium">SAVED</div>' : ''}
          ${isNext && !isSaved && !isPinned ? '<div class="absolute top-1 left-7 px-1.5 py-0.5 bg-yellow-500/90 rounded text-[9px] text-white font-medium">NEXT</div>' : ''}
          <button type="button" onclick="event.stopPropagation(); pinThumbnail('${escapeJsString(thumb.path)}', '${escapeJsString(thumb.filename)}')" 
            class="absolute top-1 right-7 w-5 h-5 sm:w-6 sm:h-6 ${isPinned ? 'bg-green-500' : 'bg-yellow-500/90 hover:bg-yellow-500'} rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100"
            title="${isPinned ? 'Thumbnail di-pin' : 'Pin thumbnail ini'}">
            <i class="ti ti-pin${isPinned ? '-filled' : ''} text-white text-[10px] sm:text-xs"></i>
          </button>
          <button type="button" onclick="event.stopPropagation(); deleteThumbnail('${thumb.filename}', '${thumb.folder || ''}')" 
            class="absolute top-1 right-1 w-5 h-5 sm:w-6 sm:h-6 bg-red-500/90 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100"
            title="Delete thumbnail">
            <i class="ti ti-x text-white text-[10px] sm:text-xs"></i>
          </button>
          <div class="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
        `;
        div.dataset.path = thumb.path;
        div.dataset.filename = thumb.filename;
        div.dataset.folder = thumb.folder || '';
        div.dataset.index = index;
        div.onclick = () => selectGalleryThumbnail(div, thumb.url, thumb.path);
        grid.appendChild(div);
      });
    } else {
      empty.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Error fetching thumbnails:', error);
    empty.classList.remove('hidden');
  } finally {
    loading.classList.add('hidden');
  }
}

// Pin thumbnail
function pinThumbnail(path, filename) {
  const pinnedInput = document.getElementById('pinnedThumbnail');
  const indicator = document.getElementById('pinnedThumbnailIndicator');
  const nameEl = document.getElementById('pinnedThumbnailName');
  
  if (pinnedInput) {
    pinnedInput.value = path;
  }
  
  if (indicator && nameEl) {
    indicator.classList.remove('hidden');
    nameEl.textContent = filename;
  }
  
  // Set thumbnail mode to pinned
  const pinnedRadio = document.querySelector('input[name="thumbnailMode"][value="pinned"]');
  if (pinnedRadio) {
    pinnedRadio.checked = true;
  }
  
  // Refresh gallery to show pin indicator
  fetchThumbnails(currentThumbnailFolder);
  
  showToast(`Thumbnail "${filename}" di-pin`);
}

// Unpin thumbnail
function unpinThumbnail() {
  const pinnedInput = document.getElementById('pinnedThumbnail');
  const indicator = document.getElementById('pinnedThumbnailIndicator');
  
  if (pinnedInput) {
    pinnedInput.value = '';
  }
  
  if (indicator) {
    indicator.classList.add('hidden');
  }
  
  // Set thumbnail mode back to sequential
  const sequentialRadio = document.querySelector('input[name="thumbnailMode"][value="sequential"]');
  if (sequentialRadio) {
    sequentialRadio.checked = true;
  }
  
  // Refresh gallery to remove pin indicator
  fetchThumbnails(currentThumbnailFolder);
  
  showToast('Pin thumbnail dihapus');
}

// Update thumbnail mode
function updateThumbnailMode(mode) {
  const pinnedInput = document.getElementById('pinnedThumbnail');
  const indicator = document.getElementById('pinnedThumbnailIndicator');
  
  if (mode === 'sequential') {
    // Clear pinned thumbnail when switching to sequential
    if (pinnedInput && pinnedInput.value) {
      pinnedInput.value = '';
    }
    if (indicator) {
      indicator.classList.add('hidden');
    }
    fetchThumbnails(currentThumbnailFolder);
  } else if (mode === 'pinned') {
    // Pinned mode - user will select a specific thumbnail
  }
}

// Select thumbnail from gallery
function selectGalleryThumbnail(element, url, path) {
  // Get the index from element dataset
  const index = element ? parseInt(element.dataset.index || '0') : 0;
  
  // Store the selected thumbnail index and path for create broadcast
  window.createSelectedThumbnailIndex = index;
  window.createSelectedThumbnailPath = path;
  
  console.log('[selectGalleryThumbnail] Selected thumbnail index:', index, 'path:', path);
  
  // Remove selection from all thumbnails and update labels
  document.querySelectorAll('.thumbnail-item').forEach(item => {
    item.classList.remove('border-primary', 'border-primary/70', 'border-red-500', 'ring-2', 'ring-primary/50');
    // Keep green border for pinned thumbnail, yellow for NEXT
    if (!item.classList.contains('border-green-500') && !item.classList.contains('border-yellow-500')) {
      item.classList.add('border-transparent');
    }
    
    // Remove SAVED label from all items
    const savedLabel = item.querySelector('.saved-label');
    if (savedLabel) savedLabel.remove();
  });
  
  // Add selection to clicked thumbnail
  element.classList.remove('border-transparent', 'border-yellow-500', 'ring-yellow-500/50');
  element.classList.add('border-primary', 'ring-2', 'ring-primary/50');
  
  // Add SAVED label to selected thumbnail (if not pinned)
  const isPinned = element.classList.contains('border-green-500');
  if (!isPinned) {
    // Remove NEXT label if exists
    const nextLabel = element.querySelector('div[class*="bg-yellow-500"]');
    if (nextLabel && nextLabel.textContent.includes('NEXT')) {
      nextLabel.remove();
    }
    
    // Add SAVED label
    const numberLabel = element.querySelector('.bg-dark-800\\/80');
    if (numberLabel && !element.querySelector('.saved-label')) {
      const savedLabel = document.createElement('div');
      savedLabel.className = 'saved-label absolute top-1 left-7 px-1.5 py-0.5 bg-primary/90 rounded text-[9px] text-white font-medium';
      savedLabel.textContent = 'SAVED';
      numberLabel.parentElement.insertBefore(savedLabel, numberLabel.nextSibling);
    }
  }
  
  // Update preview
  const preview = document.getElementById('thumbnailPreview');
  preview.innerHTML = `<img src="${url}" class="w-full h-full object-cover">`;
  preview.classList.add('border-primary');
  preview.classList.remove('border-gray-600');
  
  // Set hidden input for path
  document.getElementById('selectedThumbnailPath').value = path;
}

// Upload thumbnail to user's gallery (supports folder)
async function uploadThumbnailToGallery(file) {
  try {
    const formData = new FormData();
    formData.append('thumbnail', file);
    
    // Add current folder if set
    if (currentThumbnailFolder) {
      formData.append('folder', currentThumbnailFolder);
    }
    
    const response = await fetch('/api/thumbnails', {
      method: 'POST',
      headers: {
        'X-CSRF-Token': getCsrfToken()
      },
      body: formData
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('Thumbnail uploaded to gallery');
      // Refresh gallery and folders
      fetchThumbnails(currentThumbnailFolder);
      fetchThumbnailFolders();
      // Auto-select the newly uploaded thumbnail
      if (data.thumbnail) {
        document.getElementById('selectedThumbnailPath').value = data.thumbnail.path;
        document.getElementById('thumbnailPreview').innerHTML = 
          `<img src="${data.thumbnail.url}" class="w-full h-full object-cover">`;
      }
      return true;
    } else {
      showToast(data.error || 'Failed to upload thumbnail', 'error');
      return false;
    }
  } catch (error) {
    console.error('Error uploading thumbnail:', error);
    showToast('Failed to upload thumbnail', 'error');
    return false;
  }
}

// Upload multiple thumbnails to user's gallery (supports folder)
async function uploadMultipleThumbnailsToGallery(files) {
  if (!files || files.length === 0) return false;
  
  try {
    const formData = new FormData();
    
    // Validate and add files
    const validFiles = [];
    for (const file of files) {
      // Validate file type
      if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
        showToast(`${file.name}: Only JPG and PNG files are allowed`, 'error');
        continue;
      }
      
      // Validate file size (2MB)
      if (file.size > 2 * 1024 * 1024) {
        showToast(`${file.name}: File size must be less than 2MB`, 'error');
        continue;
      }
      
      validFiles.push(file);
    }
    
    if (validFiles.length === 0) {
      return false;
    }
    
    // Add all valid files to formData
    for (const file of validFiles) {
      formData.append('thumbnail', file);
    }
    
    // Add current folder if set
    if (currentThumbnailFolder) {
      formData.append('folder', currentThumbnailFolder);
    }
    
    // Show uploading toast
    showToast(`Uploading ${validFiles.length} thumbnail(s)...`, 'info');
    
    const response = await fetch('/api/thumbnails', {
      method: 'POST',
      headers: {
        'X-CSRF-Token': getCsrfToken()
      },
      body: formData
    });
    
    const data = await response.json();
    
    if (data.success) {
      let message = `${data.uploadedCount} thumbnail(s) uploaded`;
      if (data.skippedCount > 0) {
        message += ` (${data.skippedCount} skipped - max 20 limit)`;
      }
      showToast(message);
      
      // Refresh gallery and folders
      fetchThumbnails(currentThumbnailFolder);
      fetchThumbnailFolders();
      
      // Auto-select the first uploaded thumbnail
      if (data.thumbnail) {
        document.getElementById('selectedThumbnailPath').value = data.thumbnail.path;
        document.getElementById('thumbnailPreview').innerHTML = 
          `<img src="${data.thumbnail.url}" class="w-full h-full object-cover">`;
      }
      return true;
    } else {
      showToast(data.error || 'Failed to upload thumbnails', 'error');
      return false;
    }
  } catch (error) {
    console.error('Error uploading thumbnails:', error);
    showToast('Failed to upload thumbnails', 'error');
    return false;
  }
}

// Delete thumbnail from user's gallery (supports folder)
async function deleteThumbnail(filename, folder = '') {
  if (!confirm('Are you sure you want to delete this thumbnail?')) {
    return;
  }
  
  try {
    let url = `/api/thumbnails/${encodeURIComponent(filename)}`;
    if (folder) {
      url += `?folder=${encodeURIComponent(folder)}`;
    }
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('Thumbnail deleted');
      // Clear selection if deleted thumbnail was selected
      const selectedPath = document.getElementById('selectedThumbnailPath').value;
      if (selectedPath && selectedPath.includes(filename)) {
        document.getElementById('selectedThumbnailPath').value = '';
        document.getElementById('thumbnailPreview').innerHTML = '<i class="ti ti-photo text-gray-500 text-2xl"></i>';
      }
      // Refresh gallery and folders
      fetchThumbnails(currentThumbnailFolder);
      fetchThumbnailFolders();
    } else {
      showToast(data.error || 'Failed to delete thumbnail', 'error');
    }
  } catch (error) {
    console.error('Error deleting thumbnail:', error);
    showToast('Failed to delete thumbnail', 'error');
  }
}

// Preview and upload thumbnail to gallery (supports multiple files)
function previewAndUploadThumbnail(input) {
  if (input.files && input.files.length > 0) {
    // Multiple files selected
    if (input.files.length > 1) {
      uploadMultipleThumbnailsToGallery(Array.from(input.files));
    } else {
      // Single file - use original logic for backward compatibility
      const file = input.files[0];
      
      // Validate file type
      if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
        showToast('Only JPG and PNG files are allowed', 'error');
        input.value = '';
        return;
      }
      
      // Validate file size (2MB)
      if (file.size > 2 * 1024 * 1024) {
        showToast('File size must be less than 2MB', 'error');
        input.value = '';
        return;
      }
      
      // Upload to gallery
      uploadThumbnailToGallery(file);
    }
    
    // Clear input for next upload
    input.value = '';
  }
}

// Tags state
let currentTags = [];

// Fetch channel defaults for auto-fill
async function fetchChannelDefaults(accountId = null) {
  const tagsLoading = document.getElementById('tagsLoading');
  const titleLoading = document.getElementById('titleLoading');
  const descriptionLoading = document.getElementById('descriptionLoading');
  
  // Show loading indicators
  if (tagsLoading) tagsLoading.classList.remove('hidden');
  if (titleLoading) titleLoading.classList.remove('hidden');
  if (descriptionLoading) descriptionLoading.classList.remove('hidden');
  
  try {
    let url = '/api/youtube/channel-defaults';
    if (accountId) {
      url += `?accountId=${accountId}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    
    if (data.success && data.defaults) {
      populateFormWithDefaults(data.defaults);
    }
  } catch (error) {
    console.error('Error fetching channel defaults:', error);
    showToast('Could not load YouTube defaults', 'info');
    // Hide auto-fill indicators on failure
    hideAutoFillIndicators();
  } finally {
    // Hide loading indicators
    if (tagsLoading) tagsLoading.classList.add('hidden');
    if (titleLoading) titleLoading.classList.add('hidden');
    if (descriptionLoading) descriptionLoading.classList.add('hidden');
  }
}

// Hide all auto-fill indicators
function hideAutoFillIndicators() {
  const indicators = ['titleAutoFillIndicator', 'descriptionAutoFillIndicator', 'tagsAutoFillIndicator'];
  indicators.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
}

// Populate form with defaults from YouTube
function populateFormWithDefaults(defaults) {
  // Populate title if available
  const titleInput = document.getElementById('broadcastTitle');
  if (defaults.title && titleInput && !titleInput.value) {
    titleInput.value = defaults.title;
    const indicator = document.getElementById('titleAutoFillIndicator');
    if (indicator) indicator.classList.remove('hidden');
  }
  
  // Populate description if available
  const descInput = document.getElementById('broadcastDescription');
  if (defaults.description && descInput && !descInput.value) {
    descInput.value = defaults.description;
    const indicator = document.getElementById('descriptionAutoFillIndicator');
    if (indicator) indicator.classList.remove('hidden');
  }
  
  // Populate tags
  if (defaults.tags && defaults.tags.length > 0) {
    currentTags = [...defaults.tags];
    renderTags();
    const indicator = document.getElementById('tagsAutoFillIndicator');
    if (indicator) indicator.classList.remove('hidden');
  }
  
  // Note: Category field has been removed from UI
  // Default category (Gaming - 20) is used internally by backend
  
  // Note: Monetization, Ad Frequency, and Altered Content settings 
  // are not supported by YouTube API and must be set in YouTube Studio
}

// Toggle tags visibility
function toggleTagsVisibility() {
  const preview = document.getElementById('tagsPreview');
  const expanded = document.getElementById('tagsExpandedContainer');
  const toggleText = document.getElementById('toggleTagsText');
  const toggleIcon = document.getElementById('toggleTagsIcon');
  
  if (expanded.classList.contains('hidden')) {
    expanded.classList.remove('hidden');
    preview.classList.add('hidden');
    toggleText.textContent = 'Hide';
    toggleIcon.classList.add('rotate-180');
  } else {
    expanded.classList.add('hidden');
    preview.classList.remove('hidden');
    toggleText.textContent = 'Show';
    toggleIcon.classList.remove('rotate-180');
  }
}

// Update tags preview text
function updateTagsPreview() {
  const previewText = document.getElementById('tagsPreviewText');
  const tagsCount = document.getElementById('tagsCount');
  
  if (previewText) {
    if (currentTags.length === 0) {
      previewText.textContent = 'No tags added';
      previewText.className = 'text-gray-500';
    } else {
      previewText.textContent = currentTags.join(', ');
      previewText.className = 'text-gray-300';
    }
  }
  
  if (tagsCount) {
    tagsCount.textContent = `(${currentTags.length})`;
  }
}

// Render tags as chips
function renderTags() {
  const container = document.getElementById('tagsContainer');
  const input = document.getElementById('tagInput');
  const hiddenInput = document.getElementById('tagsHidden');
  
  if (!container || !input) return;
  
  // Remove existing tag chips
  container.querySelectorAll('.tag-chip').forEach(chip => chip.remove());
  
  // Add tag chips before the input
  currentTags.forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs';
    chip.innerHTML = `
      ${escapeHtml(tag)}
      <button type="button" class="hover:text-red-300" onclick="removeTag('${escapeJsString(tag)}')">
        <i class="ti ti-x text-[10px]"></i>
      </button>
    `;
    container.insertBefore(chip, input);
  });
  
  // Update hidden input with tags as JSON
  if (hiddenInput) {
    hiddenInput.value = JSON.stringify(currentTags);
  }
  
  // Update preview
  updateTagsPreview();
}

// Add a new tag
function addTag(tag) {
  const trimmedTag = tag.trim();
  if (!trimmedTag) return;
  
  // Check if tag already exists
  if (currentTags.includes(trimmedTag)) {
    showToast('Tag already exists', 'error');
    return;
  }
  
  // Check total characters limit (500)
  const totalChars = currentTags.join(',').length + trimmedTag.length + (currentTags.length > 0 ? 1 : 0);
  if (totalChars > 500) {
    showToast('Tags exceed 500 character limit', 'error');
    return;
  }
  
  currentTags.push(trimmedTag);
  renderTags();
}

// Remove a tag
function removeTag(tag) {
  currentTags = currentTags.filter(t => t !== tag);
  renderTags();
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Escape string for use in JavaScript string literals (single quotes)
function escapeJsString(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

// Initialize tag input handler
function initTagInput() {
  const tagInput = document.getElementById('tagInput');
  if (!tagInput) return;
  
  tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(tagInput.value);
      tagInput.value = '';
    }
  });
  
  // Also add on blur
  tagInput.addEventListener('blur', () => {
    if (tagInput.value.trim()) {
      addTag(tagInput.value);
      tagInput.value = '';
    }
  });
}

// Create Broadcast Modal
function openCreateBroadcastModal() {
  document.getElementById('createBroadcastModal').classList.remove('hidden');
  
  // Set minimum datetime to 10 minutes from now
  const minDate = new Date(Date.now() + 11 * 60 * 1000);
  const minDateStr = minDate.toISOString().slice(0, 16);
  document.getElementById('scheduledStartTime').min = minDateStr;
  
  // Reset tags
  currentTags = [];
  renderTags();
  
  // Initialize tag input
  initTagInput();
  
  // Get selected account ID
  const accountSelect = document.getElementById('accountSelect');
  const accountId = accountSelect ? accountSelect.value : null;
  
  // Reset thumbnail folder to root
  currentThumbnailFolder = null;
  const folderInput = document.getElementById('currentThumbnailFolder');
  if (folderInput) folderInput.value = '';
  const indicator = document.getElementById('currentFolderIndicator');
  if (indicator) indicator.classList.add('hidden');
  
  // Fetch streams, thumbnails, folders, and channel defaults for selected account
  fetchStreams(accountId);
  fetchThumbnailFolders();
  fetchThumbnails(null);
  fetchChannelDefaults(accountId);
}

function closeCreateBroadcastModal() {
  document.getElementById('createBroadcastModal').classList.add('hidden');
  document.getElementById('createBroadcastForm').reset();
  document.getElementById('thumbnailPreview').innerHTML = '<i class="ti ti-photo text-gray-500 text-2xl"></i>';
  document.getElementById('selectedThumbnailPath').value = '';
  
  // Reset thumbnail folder
  currentThumbnailFolder = null;
  const folderInput = document.getElementById('currentThumbnailFolder');
  if (folderInput) folderInput.value = '';
  
  // Reset selected thumbnail index
  window.createSelectedThumbnailIndex = 0;
  window.createSelectedThumbnailPath = null;
  
  // Reset pinned thumbnail
  const pinnedInput = document.getElementById('pinnedThumbnail');
  if (pinnedInput) pinnedInput.value = '';
  const pinnedIndicator = document.getElementById('pinnedThumbnailIndicator');
  if (pinnedIndicator) pinnedIndicator.classList.add('hidden');
  
  // Reset stream key folder mapping
  const mappingInput = document.getElementById('streamKeyFolderMapping');
  if (mappingInput) mappingInput.value = '';
  
  // Reset thumbnail mode to sequential
  const sequentialRadio = document.querySelector('input[name="thumbnailMode"][value="sequential"]');
  if (sequentialRadio) sequentialRadio.checked = true;
  
  // Clear thumbnail selection
  document.querySelectorAll('.thumbnail-item').forEach(item => {
    item.classList.remove('border-primary', 'border-red-500', 'border-green-500', 'ring-2', 'ring-primary/50', 'ring-green-500/50');
    item.classList.add('border-transparent');
  });
  
  // Reset tags
  currentTags = [];
  renderTags();
  
  // Hide all auto-fill indicators
  hideAutoFillIndicators();
}


// Create Broadcast Form Handler
const createBroadcastForm = document.getElementById('createBroadcastForm');
if (createBroadcastForm) {
  createBroadcastForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const createBtn = document.getElementById('createBroadcastBtn');
    const originalText = createBtn.innerHTML;
    createBtn.innerHTML = '<i class="ti ti-loader animate-spin"></i> Creating...';
    createBtn.disabled = true;
    
    try {
      const formData = new FormData();
      
      // Add account ID
      const accountSelect = document.getElementById('accountSelect');
      if (accountSelect && accountSelect.value) {
        formData.append('accountId', accountSelect.value);
      }
      
      formData.append('title', document.getElementById('broadcastTitle').value);
      formData.append('description', document.getElementById('broadcastDescription').value);
      formData.append('scheduledStartTime', document.getElementById('scheduledStartTime').value);
      formData.append('privacyStatus', document.getElementById('privacyStatus').value);
      
      // Add stream key if selected
      const streamId = document.getElementById('streamKeySelect').value;
      if (streamId) {
        formData.append('streamId', streamId);
      }
      
      // Add tags
      if (currentTags.length > 0) {
        formData.append('tags', JSON.stringify(currentTags));
      }
      
      // Add category ID (default: 22 - People & Blogs)
      const categoryId = document.getElementById('categoryId').value;
      formData.append('categoryId', categoryId || '22');
      
      // Add Additional Settings
      // Auto-start and auto-stop are always true (hidden inputs)
      const enableAutoStart = document.getElementById('enableAutoStart').value === 'true';
      const enableAutoStop = document.getElementById('enableAutoStop').value === 'true';
      // Unlist replay is optional (checkbox)
      const unlistReplayOnEnd = document.getElementById('unlistReplayOnEnd').checked;
      
      formData.append('enableAutoStart', enableAutoStart);
      formData.append('enableAutoStop', enableAutoStop);
      formData.append('unlistReplayOnEnd', unlistReplayOnEnd);
      
      // Add thumbnail from gallery selection - ONLY if pinned mode
      const thumbnailMode = document.querySelector('input[name="thumbnailMode"]:checked')?.value || 'sequential';
      const thumbnailPath = document.getElementById('selectedThumbnailPath').value;
      const pinnedThumbnail = document.getElementById('pinnedThumbnail')?.value;
      
      // Only send thumbnailPath if:
      // 1. Mode is pinned AND pinnedThumbnail is set, OR
      // 2. User explicitly selected a thumbnail AND mode is pinned
      if (thumbnailMode === 'pinned' && pinnedThumbnail) {
        formData.append('thumbnailPath', pinnedThumbnail);
        console.log('[CreateBroadcast] Using pinned thumbnail:', pinnedThumbnail);
      }
      // For sequential mode, don't send thumbnailPath - let backend handle sequential selection
      
      // Add selected thumbnail index
      const thumbnailIndex = window.createSelectedThumbnailIndex || 0;
      formData.append('thumbnailIndex', thumbnailIndex);
      
      // Add current thumbnail folder for sequential selection
      // Always send thumbnailFolder - empty string for root, folder name for specific folder
      // This ensures the folder selection is saved and can be restored when editing
      formData.append('thumbnailFolder', currentThumbnailFolder || '');
      
      // Add pinned thumbnail if set (for backward compatibility)
      if (pinnedThumbnail) {
        formData.append('pinnedThumbnail', pinnedThumbnail);
      }
      
      // Add stream key folder mapping if set
      const streamKeyFolderMapping = document.getElementById('streamKeyFolderMapping')?.value;
      if (streamKeyFolderMapping) {
        formData.append('streamKeyFolderMapping', streamKeyFolderMapping);
      }
      
      const response = await fetch('/api/youtube/broadcasts', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': getCsrfToken()
        },
        body: formData
      });
      
      const data = await response.json();
      
      if (data.success) {
        // NOTE: Thumbnail index is already incremented by backend in sequential mode
        // No need to increment here to avoid double increment
        console.log('[CreateBroadcast] Broadcast created successfully, thumbnail index handled by backend');
        
        showToast('Broadcast created successfully!');
        closeCreateBroadcastModal();
        setTimeout(() => window.location.reload(), 1000);
      } else {
        showToast(data.error || 'Failed to create broadcast', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showToast('An error occurred', 'error');
    } finally {
      createBtn.innerHTML = originalText;
      createBtn.disabled = false;
    }
  });
}

// Delete Broadcast
async function deleteBroadcast(broadcastId, title, accountId = null) {
  if (!confirm(`Are you sure you want to delete "${title}"?`)) {
    return;
  }
  
  try {
    let url = `/api/youtube/broadcasts/${broadcastId}`;
    if (accountId) {
      url += `?accountId=${accountId}`;
    }
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('Broadcast deleted');
      setTimeout(() => window.location.reload(), 1000);
    } else {
      showToast(data.error || 'Failed to delete broadcast', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('An error occurred', 'error');
  }
}

// Edit Broadcast
async function editBroadcast(broadcastId, accountId) {
  try {
    // Fetch broadcast details
    const response = await fetch(`/api/youtube/broadcasts?accountId=${accountId}`, {
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    
    if (data.success && data.broadcasts) {
      const broadcast = data.broadcasts.find(b => b.id === broadcastId);
      if (broadcast) {
        // Add accountId to broadcast object for the modal
        broadcast.accountId = accountId;
        openEditBroadcastModal(broadcast);
      } else {
        showToast('Broadcast not found', 'error');
      }
    } else {
      showToast(data.error || 'Failed to load broadcast', 'error');
    }
  } catch (error) {
    console.error('Error fetching broadcast:', error);
    showToast('Failed to load broadcast', 'error');
  }
}

// Open Edit Broadcast Modal
async function openEditBroadcastModal(broadcast) {
  document.getElementById('editBroadcastId').value = broadcast.id;
  document.getElementById('editAccountId').value = broadcast.accountId;
  document.getElementById('editBroadcastTitle').value = broadcast.title || '';
  document.getElementById('editBroadcastDescription').value = broadcast.description || '';
  document.getElementById('editPrivacyStatus').value = broadcast.privacyStatus || 'unlisted';
  
  // Store stream key ID for thumbnail rotation
  window.editBroadcastStreamId = broadcast.streamId || null;
  console.log('[openEditBroadcastModal] Stream ID:', window.editBroadcastStreamId);
  
  // Format datetime for input
  if (broadcast.scheduledStartTime) {
    const date = new Date(broadcast.scheduledStartTime);
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    document.getElementById('editScheduledStartTime').value = localDate.toISOString().slice(0, 16);
  }
  
  // Reset thumbnail mode to sequential
  const sequentialRadio = document.querySelector('input[name="editThumbnailMode"][value="sequential"]');
  if (sequentialRadio) sequentialRadio.checked = true;
  
  // Reset pinned thumbnail
  const pinnedInput = document.getElementById('editPinnedThumbnail');
  if (pinnedInput) pinnedInput.value = '';
  
  const pinnedIndicator = document.getElementById('editPinnedThumbnailIndicator');
  if (pinnedIndicator) pinnedIndicator.classList.add('hidden');
  
  // Reset stream key folder mapping
  const mappingInput = document.getElementById('editStreamKeyFolderMapping');
  if (mappingInput) mappingInput.value = '';
  
  // Set thumbnail preview if broadcast has thumbnail
  const preview = document.getElementById('editThumbnailPreview');
  if (preview) {
    const indicator = document.getElementById('editPinnedThumbnailIndicator');
    if (broadcast.thumbnailUrl) {
      preview.innerHTML = `<img src="${broadcast.thumbnailUrl}" class="w-full h-full object-cover">`;
    } else {
      preview.innerHTML = '<i class="ti ti-photo text-gray-500 text-2xl"></i>';
    }
    if (indicator) {
      indicator.classList.add('hidden');
      preview.appendChild(indicator);
    }
  }
  
  // Clear any previously selected thumbnail file
  window.editThumbnailFile = null;
  window.editThumbnailFromHistory = false;
  
  // Load thumbnail folders first and get first folder as default
  const firstFolder = await loadEditThumbnailFolders();
  
  // Get thumbnail folder from broadcast settings (not from template - user should choose)
  const broadcastId = broadcast.id;
  const accountId = broadcast.accountId;
  let boundFolder = null;
  
  // Get folder from broadcast settings only
  if (broadcastId) {
    const settings = await getBroadcastSettingsFromServer(broadcastId, accountId);
    if (settings && settings.thumbnailFolder !== null && settings.thumbnailFolder !== undefined) {
      boundFolder = settings.thumbnailFolder;
      console.log(`[openEditBroadcastModal] Using folder from broadcast settings: "${boundFolder || '(root)'}"`);
    }
  }
  
  // If no folder from broadcast settings, use first available folder as default
  if (boundFolder === null && firstFolder) {
    boundFolder = firstFolder;
    console.log(`[openEditBroadcastModal] Using first available folder: "${boundFolder}"`);
  }
  
  // Set the folder dropdown and load thumbnails
  const folderSelect = document.getElementById('editThumbnailFolderSelect');
  if (folderSelect && boundFolder !== null) {
    folderSelect.value = boundFolder;
  }
  
  // Load thumbnails from selected folder
  loadEditThumbnailFolder(boundFolder);
  
  document.getElementById('editBroadcastModal').classList.remove('hidden');
}

function closeEditBroadcastModal() {
  document.getElementById('editBroadcastModal').classList.add('hidden');
  document.getElementById('editBroadcastForm').reset();
}

// Edit Broadcast Form Handler - includes thumbnail upload and category
const editBroadcastForm = document.getElementById('editBroadcastForm');
if (editBroadcastForm) {
  editBroadcastForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const updateBtn = document.getElementById('updateBroadcastBtn');
    const originalText = updateBtn.innerHTML;
    updateBtn.innerHTML = '<i class="ti ti-loader animate-spin"></i> Updating...';
    updateBtn.disabled = true;
    
    try {
      const broadcastId = document.getElementById('editBroadcastId').value;
      const accountId = document.getElementById('editAccountId').value;
      
      console.log('[EditBroadcast-Original] Starting update for broadcast:', broadcastId, 'account:', accountId);
      
      // Upload thumbnail first if selected
      if (window.editThumbnailFile) {
        console.log('[EditBroadcast-Original] Uploading thumbnail:', window.editThumbnailFile.name);
        const thumbnailSuccess = await uploadEditThumbnail(broadcastId, accountId);
        if (!thumbnailSuccess) {
          showToast('Thumbnail upload failed', 'error');
        } else {
          showToast('Thumbnail uploaded!', 'success');
        }
      }
      
      // Get category value
      const categorySelect = document.getElementById('editCategoryId');
      const categoryId = categorySelect ? categorySelect.value : '22';
      
      console.log('[EditBroadcast-Original] Category:', categoryId);
      
      // Get thumbnail folder - prefer currentEditThumbnailFolder, fallback to dropdown value
      const folderSelect = document.getElementById('editThumbnailFolderSelect');
      let thumbnailFolderValue = currentEditThumbnailFolder;
      if (thumbnailFolderValue === null && folderSelect) {
        thumbnailFolderValue = folderSelect.value;
      }
      
      console.log('[EditBroadcast-Original] Thumbnail folder:', thumbnailFolderValue === '' ? '(root)' : thumbnailFolderValue);
      
      // Get selected thumbnail index and path
      const thumbnailIndex = window.editSelectedThumbnailIndex || 0;
      const thumbnailPath = window.editSelectedThumbnailPath || null;
      
      // Get stream ID for thumbnail rotation
      const streamId = window.editBroadcastStreamId || null;
      
      console.log('[EditBroadcast-Original] Thumbnail index:', thumbnailIndex, 'path:', thumbnailPath, 'streamId:', streamId);
      
      const updateData = {
        title: document.getElementById('editBroadcastTitle').value,
        description: document.getElementById('editBroadcastDescription').value,
        scheduledStartTime: document.getElementById('editScheduledStartTime').value,
        privacyStatus: document.getElementById('editPrivacyStatus').value,
        categoryId: categoryId,
        // Include thumbnail folder so it's saved when editing
        thumbnailFolder: thumbnailFolderValue !== null ? thumbnailFolderValue : '',
        // Include thumbnail index and path for consistency
        thumbnailIndex: thumbnailIndex,
        thumbnailPath: thumbnailPath,
        // Include stream ID for thumbnail rotation tracking
        streamId: streamId
      };
      
      console.log('[EditBroadcast-Original] Update data:', JSON.stringify(updateData));
      
      let url = `/api/youtube/broadcasts/${broadcastId}`;
      if (accountId) {
        url += `?accountId=${accountId}`;
      }
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrfToken()
        },
        body: JSON.stringify(updateData)
      });
      
      const data = await response.json();
      console.log('[EditBroadcast-Original] Response:', data);
      
      if (data.success) {
        showToast('Broadcast updated successfully!');
        closeEditBroadcastModal();
        setTimeout(() => window.location.reload(), 1500);
      } else {
        showToast(data.error || 'Failed to update broadcast', 'error');
      }
    } catch (error) {
      console.error('[EditBroadcast-Original] Error:', error);
      showToast('An error occurred: ' + error.message, 'error');
    } finally {
      updateBtn.innerHTML = originalText;
      updateBtn.disabled = false;
      window.editThumbnailFile = null;
    }
  });
}

// Reuse Broadcast - opens create modal with pre-filled data and handles thumbnail rotation
async function reuseBroadcast(broadcastId, accountId) {
  // Open create modal
  openCreateBroadcastModal();
  
  // Fetch broadcast details and pre-fill
  try {
    const response = await fetch(`/api/youtube/broadcasts?accountId=${accountId}`, {
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    
    if (data.success && data.broadcasts) {
      const broadcast = data.broadcasts.find(b => b.id === broadcastId);
      if (broadcast) {
        // Pre-fill form with broadcast data
        document.getElementById('broadcastTitle').value = broadcast.title || '';
        document.getElementById('broadcastDescription').value = broadcast.description || '';
        document.getElementById('privacyStatus').value = broadcast.privacyStatus || 'unlisted';
        
        // Select the account
        const accountSelect = document.getElementById('accountSelect');
        if (accountSelect) {
          accountSelect.value = accountId;
          // Trigger account change to load stream keys
          onAccountChange(accountId);
        }
        
        // Clear scheduled time - user must set new time
        document.getElementById('scheduledStartTime').value = '';
        
        // Handle stream key and thumbnail rotation
        if (broadcast.streamId) {
          console.log('[reuseBroadcast] Stream ID found:', broadcast.streamId);
          
          // Wait for stream keys to load, then select the stream key
          setTimeout(async () => {
            const streamKeySelect = document.getElementById('streamKeySelect');
            if (streamKeySelect) {
              streamKeySelect.value = broadcast.streamId;
              
              // Trigger stream key change to load thumbnail folder and index
              await onStreamKeyChange(broadcast.streamId);
              
              console.log('[reuseBroadcast] Stream key selected, thumbnail rotation will be handled automatically');
            }
          }, 1000); // Wait for stream keys to load
        }
        
        // Set thumbnail mode to rotation (sequential)
        const rotationRadio = document.querySelector('input[name="thumbnailMode"][value="sequential"]');
        if (rotationRadio) {
          rotationRadio.checked = true;
          updateThumbnailMode('sequential');
        }
        
        showToast('Broadcast settings copied. Thumbnail will rotate automatically.', 'info');
      }
    }
  } catch (error) {
    console.error('Error fetching broadcast for reuse:', error);
  }
}

// Copy Stream Key
function copyStreamKey(streamKey) {
  if (!streamKey) {
    showToast('No stream key available', 'error');
    return;
  }
  
  navigator.clipboard.writeText(streamKey).then(() => {
    showToast('Stream key copied to clipboard');
  }).catch(() => {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = streamKey;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('Stream key copied to clipboard');
  });
}

// Change Thumbnail Modal
function changeThumbnail(broadcastId) {
  document.getElementById('changeThumbnailBroadcastId').value = broadcastId;
  document.getElementById('changeThumbnailModal').classList.remove('hidden');
}

function closeChangeThumbnailModal() {
  document.getElementById('changeThumbnailModal').classList.add('hidden');
  document.getElementById('changeThumbnailForm').reset();
  document.getElementById('newThumbnailPreview').innerHTML = '<i class="ti ti-photo text-gray-500 text-3xl"></i>';
}

// Preview new thumbnail
function previewNewThumbnail(input) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    
    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      showToast('Only JPG and PNG files are allowed', 'error');
      input.value = '';
      return;
    }
    
    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      showToast('File size must be less than 2MB', 'error');
      input.value = '';
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('newThumbnailPreview').innerHTML = 
        `<img src="${e.target.result}" class="w-full h-full object-cover">`;
    };
    reader.readAsDataURL(file);
  }
}

// Change Thumbnail Form Handler
const changeThumbnailForm = document.getElementById('changeThumbnailForm');
if (changeThumbnailForm) {
  changeThumbnailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const uploadBtn = document.getElementById('uploadThumbnailBtn');
    const originalText = uploadBtn.innerHTML;
    uploadBtn.innerHTML = '<i class="ti ti-loader animate-spin"></i> Uploading...';
    uploadBtn.disabled = true;
    
    try {
      const broadcastId = document.getElementById('changeThumbnailBroadcastId').value;
      const formData = new FormData();
      formData.append('thumbnail', document.getElementById('newThumbnailFile').files[0]);
      
      const response = await fetch(`/api/youtube/broadcasts/${broadcastId}/thumbnail`, {
        method: 'POST',
        headers: {
          'X-CSRF-Token': getCsrfToken()
        },
        body: formData
      });
      
      const data = await response.json();
      
      if (data.success) {
        showToast('Thumbnail updated successfully!');
        closeChangeThumbnailModal();
        setTimeout(() => window.location.reload(), 1000);
      } else {
        showToast(data.error || 'Failed to update thumbnail', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showToast('An error occurred', 'error');
    } finally {
      uploadBtn.innerHTML = originalText;
      uploadBtn.disabled = false;
    }
  });
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  });
});

// Close modals on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    });
  }
});

// ==========================================
// Template Management Functions
// ==========================================

// Template Library Modal
function openTemplateLibraryModal() {
  document.getElementById('templateLibraryModal').classList.remove('hidden');
  loadTemplates();
}

function closeTemplateLibraryModal() {
  document.getElementById('templateLibraryModal').classList.add('hidden');
}

// Load templates from API
async function loadTemplates() {
  const loading = document.getElementById('templateListLoading');
  const empty = document.getElementById('templateListEmpty');
  const content = document.getElementById('templateListContent');
  
  loading.classList.remove('hidden');
  empty.classList.add('hidden');
  content.classList.add('hidden');
  
  try {
    const response = await fetch('/api/youtube/templates', {
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    
    if (data.success && data.templates && data.templates.length > 0) {
      renderTemplateList(data.templates);
      content.classList.remove('hidden');
    } else {
      empty.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Error loading templates:', error);
    showToast('Failed to load templates', 'error');
    empty.classList.remove('hidden');
  } finally {
    loading.classList.add('hidden');
  }
}

// Render template list
function renderTemplateList(templates) {
  const content = document.getElementById('templateListContent');
  content.innerHTML = '';
  
  templates.forEach((template, index) => {
    const isMulti = template.isMultiBroadcast && template.broadcasts && template.broadcasts.length > 1;
    const broadcastCount = isMulti ? template.broadcasts.length : 1;
    const hasRecurring = template.recurring_enabled;
    const hasThumbnailFolder = template.thumbnail_folder !== null && template.thumbnail_folder !== undefined;
    const hasPinnedThumbnail = template.pinned_thumbnail !== null && template.pinned_thumbnail !== undefined && template.pinned_thumbnail !== '';
    const accountInvalid = template.account_valid === false;
    
    // Build recurring info HTML for desktop
    let recurringHtmlDesktop = '';
    if (hasRecurring) {
      const patternText = formatRecurringPattern(template.recurring_pattern, template.recurring_days, template.recurring_time);
      const nextRunText = formatNextRun(template.next_run_at);
      recurringHtmlDesktop = `
        <div class="flex items-center gap-2 mt-2 text-xs">
          <span class="px-2 py-0.5 bg-green-500/20 text-green-400 rounded flex items-center gap-1">
            <i class="ti ti-repeat"></i>
            ${escapeHtml(patternText)}
          </span>
          <span class="text-gray-500">Next: ${escapeHtml(nextRunText)}</span>
        </div>
      `;
    }
    
    // Thumbnail folder badge - show mode info (only for pinned)
    let thumbnailBadge = '';
    if (hasPinnedThumbnail) {
      thumbnailBadge = `<span class="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-xs rounded flex items-center gap-0.5" title="Pinned thumbnail"><i class="ti ti-pin-filled text-[10px]"></i> Pin</span>`;
    }
    
    // Channel display with warning if account is invalid
    const channelDisplay = accountInvalid 
      ? `<span class="text-xs text-orange-400 flex items-center gap-1" title="YouTube account disconnected. Select a new account when re-creating.">
          <i class="ti ti-alert-triangle"></i>
          ${escapeHtml(template.channel_name || 'Unknown Channel')}
        </span>`
      : `<span class="text-xs text-red-400 flex items-center gap-1">
          <i class="ti ti-brand-youtube"></i>
          ${escapeHtml(template.channel_name || 'Unknown Channel')}
        </span>`;
    
    const div = document.createElement('div');
    div.className = 'template-list-item';
    div.innerHTML = `
      <!-- Desktop Layout -->
      <div class="hidden md:flex items-start justify-between gap-4 bg-dark-700 rounded-lg p-4 ${accountInvalid ? 'border border-orange-500/30' : ''}">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h4 class="font-medium text-white truncate">${escapeHtml(template.name)}</h4>
            ${isMulti ? `<span class="px-1.5 py-0.5 bg-primary/20 text-primary text-xs rounded">${broadcastCount} broadcasts</span>` : ''}
            ${hasRecurring ? `<span class="recurring-badge px-1.5 py-0.5 bg-green-500/20 text-green-400 text-xs rounded flex items-center gap-0.5"><i class="ti ti-repeat text-[10px]"></i> Auto</span>` : ''}
            ${thumbnailBadge}
          </div>
          <p class="text-sm text-gray-400 truncate">${escapeHtml(template.title)}</p>
          <div class="flex items-center gap-2 mt-1">
            ${channelDisplay}
            <span class="text-xs text-gray-500">
              ${new Date(template.created_at).toLocaleDateString()}
            </span>
          </div>
          ${recurringHtmlDesktop}
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          ${hasRecurring ? `
          <button onclick="runTemplateNow('${template.id}', '${escapeJsString(template.name)}')"
            class="px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg transition-colors text-sm flex items-center gap-1" title="Run Schedule Now">
            <i class="ti ti-player-play"></i>
            <span>Run</span>
          </button>
          ` : ''}
          <button onclick="recreateFromTemplate('${template.id}')"
            class="px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg transition-colors text-sm flex items-center gap-1" title="Re-create Broadcasts">
            <i class="ti ti-refresh"></i>
            <span>Re-create</span>
          </button>
          <button onclick="editTemplate('${template.id}')"
            class="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors text-sm flex items-center gap-1" title="Edit">
            <i class="ti ti-edit"></i>
          </button>
          <button onclick="deleteTemplate('${template.id}', '${escapeJsString(template.name)}')"
            class="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors text-sm flex items-center gap-1" title="Delete">
            <i class="ti ti-trash"></i>
          </button>
        </div>
      </div>
      
      <!-- Mobile Layout - Simple List -->
      <div class="md:hidden flex items-center gap-2 px-3 py-2.5 bg-dark-700/50 hover:bg-dark-700 rounded-lg transition-colors ${accountInvalid ? 'border border-orange-500/30' : ''}">
        <span class="text-primary font-semibold text-xs w-5 flex-shrink-0">${index + 1}</span>
        <div class="flex-1 min-w-0">
          <p class="text-sm text-white truncate">${escapeHtml(template.name)}</p>
          <p class="text-[10px] text-gray-500 truncate">${escapeHtml(template.title)}</p>
        </div>
        ${accountInvalid ? `<span class="px-1 py-0.5 bg-orange-500/20 text-orange-400 text-[10px] rounded flex-shrink-0" title="Account disconnected"><i class="ti ti-alert-triangle text-[8px]"></i></span>` : ''}
        ${hasRecurring ? `<span class="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded flex-shrink-0"><i class="ti ti-repeat text-[8px]"></i></span>` : ''}
        ${isMulti ? `<span class="px-1.5 py-0.5 bg-primary/20 text-primary text-[10px] rounded flex-shrink-0">${broadcastCount}</span>` : ''}
        <div class="flex items-center gap-0.5 flex-shrink-0">
          <button onclick="recreateFromTemplate('${template.id}')"
            class="w-8 h-8 flex items-center justify-center text-green-400 hover:bg-green-500/20 rounded transition-colors" title="Re-create">
            <i class="ti ti-refresh text-sm"></i>
          </button>
          <button onclick="editTemplate('${template.id}')"
            class="w-8 h-8 flex items-center justify-center text-blue-400 hover:bg-blue-500/20 rounded transition-colors" title="Edit">
            <i class="ti ti-edit text-sm"></i>
          </button>
          <button onclick="deleteTemplate('${template.id}', '${escapeJsString(template.name)}')"
            class="w-8 h-8 flex items-center justify-center text-red-400 hover:bg-red-500/20 rounded transition-colors" title="Delete">
            <i class="ti ti-trash text-sm"></i>
          </button>
        </div>
      </div>
    `;
    content.appendChild(div);
  });
}

// Create Template Modal
function openCreateTemplateModal() {
  closeTemplateLibraryModal();
  document.getElementById('createTemplateModal').classList.remove('hidden');
  
  // Load stream keys for the selected account
  const accountId = document.getElementById('templateAccountSelect').value;
  if (accountId) {
    fetchTemplateStreamKeys(accountId);
  }
  
  // Load thumbnail folders for template modal
  loadTemplateThumbnailFolders();
  
  // Load title folders for template modal
  loadTemplateTitleFolders();
}

// Load thumbnail folders for template modal
async function loadTemplateThumbnailFolders(selectedFolder = null) {
  const select = document.getElementById('templateThumbnailFolder');
  if (!select) return;
  
  try {
    const response = await fetch('/api/thumbnail-folders', {
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    
    // Clear and rebuild options
    select.innerHTML = '<option value="">-- Pilih Folder Thumbnail --</option>';
    
    // Add root folder option
    const rootOption = document.createElement('option');
    rootOption.value = '__ROOT__';
    rootOption.textContent = '📁 Root (Folder Utama)';
    select.appendChild(rootOption);
    
    if (data.success && data.folders && data.folders.length > 0) {
      data.folders.forEach(folder => {
        const option = document.createElement('option');
        option.value = folder.name;
        option.textContent = `📂 ${folder.name} (${folder.count || 0} thumbnails)`;
        select.appendChild(option);
      });
    }
    
    // Pre-select folder if provided
    if (selectedFolder !== null) {
      if (selectedFolder === '' || selectedFolder === '__ROOT__') {
        select.value = '__ROOT__';
      } else {
        select.value = selectedFolder;
      }
      // Show preview
      onTemplateThumbnailFolderChange(select.value);
    }
    
    console.log('[loadTemplateThumbnailFolders] Loaded', data.folders?.length || 0, 'folders, selected:', selectedFolder);
  } catch (error) {
    console.error('Error loading thumbnail folders:', error);
    select.innerHTML = '<option value="">Error loading folders</option>';
  }
}

// Load title folders for template modal
async function loadTemplateTitleFolders(selectedFolderId = null) {
  const select = document.getElementById('templateTitleFolder');
  if (!select) return;
  
  try {
    const response = await fetch('/api/title-folders', {
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    
    // Clear and rebuild options
    select.innerHTML = '<option value="">-- Semua Judul (Tanpa Filter Folder) --</option>';
    
    if (data.success && data.folders && data.folders.length > 0) {
      data.folders.forEach(folder => {
        const option = document.createElement('option');
        option.value = folder.id;
        option.textContent = `📂 ${folder.name} (${folder.title_count || 0} judul)`;
        select.appendChild(option);
      });
    }
    
    // Pre-select folder if provided
    if (selectedFolderId) {
      select.value = selectedFolderId;
    }
    
    console.log('[loadTemplateTitleFolders] Loaded', data.folders?.length || 0, 'folders, selected:', selectedFolderId);
  } catch (error) {
    console.error('Error loading title folders:', error);
    select.innerHTML = '<option value="">Error loading folders</option>';
  }
}

// Handle thumbnail folder change in template modal
async function onTemplateThumbnailFolderChange(folderValue) {
  const previewContainer = document.getElementById('templateThumbnailFolderPreview');
  const imagesContainer = document.getElementById('templateThumbnailFolderImages');
  
  if (!previewContainer || !imagesContainer) return;
  
  if (!folderValue) {
    previewContainer.classList.add('hidden');
    return;
  }
  
  // Convert __ROOT__ to empty string for API
  const folder = folderValue === '__ROOT__' ? '' : folderValue;
  
  try {
    let url = '/api/thumbnails';
    if (folder) {
      url += `?folder=${encodeURIComponent(folder)}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    
    if (data.success && data.thumbnails && data.thumbnails.length > 0) {
      previewContainer.classList.remove('hidden');
      imagesContainer.innerHTML = data.thumbnails.slice(0, 5).map((thumb, i) => `
        <div class="w-12 h-8 flex-shrink-0 rounded overflow-hidden border border-gray-600 relative">
          <img src="${thumb.url}" class="w-full h-full object-cover" alt="Thumb ${i + 1}">
          <span class="absolute bottom-0 right-0 bg-black/70 text-[8px] text-white px-0.5">${i + 1}</span>
        </div>
      `).join('') + (data.thumbnails.length > 5 ? `<span class="text-xs text-gray-500 self-center">+${data.thumbnails.length - 5} more</span>` : '');
    } else {
      previewContainer.classList.remove('hidden');
      imagesContainer.innerHTML = '<span class="text-xs text-yellow-400">⚠️ Folder kosong - tidak ada thumbnail</span>';
    }
  } catch (error) {
    console.error('Error loading folder preview:', error);
    previewContainer.classList.add('hidden');
  }
}

// Fetch stream keys for template modal
async function fetchTemplateStreamKeys(accountId) {
  const select = document.getElementById('templateStreamKeySelect');
  const loading = document.getElementById('templateStreamKeyLoading');
  
  if (!select) return;
  
  if (loading) loading.classList.remove('hidden');
  
  try {
    const response = await fetch(`/api/youtube/streams?accountId=${accountId}`, {
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    
    // Clear existing options except first
    select.innerHTML = '<option value="">-- Select Stream Key (Optional) --</option>';
    
    if (data.success && data.streams && data.streams.length > 0) {
      data.streams.forEach(stream => {
        const option = document.createElement('option');
        option.value = stream.id;
        option.textContent = `${stream.title} (${stream.resolution} @ ${stream.frameRate})`;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error fetching stream keys:', error);
  } finally {
    if (loading) loading.classList.add('hidden');
  }
}

// Handle account change in template modal
function onTemplateAccountChange(accountId) {
  if (accountId) {
    fetchTemplateStreamKeys(accountId);
  }
}

function closeCreateTemplateModal() {
  document.getElementById('createTemplateModal').classList.add('hidden');
  document.getElementById('createTemplateForm').reset();
  // Reset recurring fields
  resetRecurringFields();
  // Reset edit mode
  delete document.getElementById('createTemplateForm').dataset.editId;
  document.getElementById('createTemplateBtn').innerHTML = '<i class="ti ti-template"></i><span>Create Template</span>';
  document.querySelector('#createTemplateModal h3').textContent = 'Create New Template';
}

// Create Template Form Handler
const createTemplateForm = document.getElementById('createTemplateForm');
if (createTemplateForm) {
  createTemplateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Validate recurring config
    if (!validateRecurringConfig()) {
      return;
    }
    
    // Validate thumbnail folder is selected
    const thumbnailFolderSelect = document.getElementById('templateThumbnailFolder');
    const thumbnailFolderValue = thumbnailFolderSelect ? thumbnailFolderSelect.value : null;
    
    if (!thumbnailFolderValue) {
      showToast('Pilih folder thumbnail terlebih dahulu!', 'error');
      if (thumbnailFolderSelect) thumbnailFolderSelect.focus();
      return;
    }
    
    const createBtn = document.getElementById('createTemplateBtn');
    const originalText = createBtn.innerHTML;
    createBtn.innerHTML = '<i class="ti ti-loader animate-spin"></i> Creating...';
    createBtn.disabled = true;
    
    try {
      // Get recurring data
      const recurringData = getRecurringDataFromForm();
      
      // Convert __ROOT__ to empty string for backend
      // Empty string means root folder (thumbnails without subfolder)
      const thumbnailFolder = thumbnailFolderValue === '__ROOT__' ? '' : thumbnailFolderValue;
      
      // Get title folder ID
      const titleFolderSelect = document.getElementById('templateTitleFolder');
      const titleFolderId = titleFolderSelect ? (titleFolderSelect.value || null) : null;
      
      const templateData = {
        name: document.getElementById('templateName').value,
        accountId: document.getElementById('templateAccountSelect').value,
        title: document.getElementById('templateTitle').value,
        description: document.getElementById('templateDescription').value,
        privacyStatus: document.getElementById('templatePrivacyStatus').value,
        categoryId: document.getElementById('templateCategoryId').value || '22',
        streamId: document.getElementById('templateStreamKeySelect').value || null,
        // IMPORTANT: Use the selected folder from the dropdown, NOT currentThumbnailFolder
        thumbnailFolder: thumbnailFolder,
        // Title folder for rotation
        titleFolderId: titleFolderId,
        // Include recurring data
        recurringEnabled: recurringData.recurring_enabled,
        recurringPattern: recurringData.recurring_pattern,
        recurringTime: recurringData.recurring_time,
        recurringDays: recurringData.recurring_days
      };
      
      console.log('[createTemplate] Sending template data:', templateData);
      console.log('[createTemplate] thumbnailFolder value:', thumbnailFolder, '(from select:', thumbnailFolderValue, ')');
      console.log('[createTemplate] titleFolderId value:', titleFolderId);
      
      // Check if editing
      const editId = createTemplateForm.dataset.editId;
      const url = editId ? `/api/youtube/templates/${editId}` : '/api/youtube/templates';
      const method = editId ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrfToken()
        },
        body: JSON.stringify(templateData)
      });
      
      const data = await response.json();
      
      console.log('[createTemplate] Response:', data);
      
      if (data.success) {
        showToast(editId ? 'Template updated successfully!' : 'Template created successfully!');
        closeCreateTemplateModal();
        openTemplateLibraryModal();
      } else {
        showToast(data.error || 'Failed to create template', 'error');
      }
    } catch (error) {
      console.error('[createTemplate] Error:', error);
      showToast('An error occurred', 'error');
    } finally {
      createBtn.innerHTML = originalText;
      createBtn.disabled = false;
    }
  });
}

// Save as Template Modal
function openSaveAsTemplateModal(broadcastId, accountId, title, privacyStatus) {
  document.getElementById('saveTemplateBroadcastId').value = broadcastId;
  document.getElementById('saveTemplateAccountId').value = accountId;
  document.getElementById('previewTitle').textContent = title || '-';
  document.getElementById('previewPrivacy').textContent = privacyStatus || '-';
  document.getElementById('saveAsTemplateModal').classList.remove('hidden');
}

function closeSaveAsTemplateModal() {
  document.getElementById('saveAsTemplateModal').classList.add('hidden');
  document.getElementById('saveAsTemplateForm').reset();
}

// Save as Template Form Handler
const saveAsTemplateForm = document.getElementById('saveAsTemplateForm');
if (saveAsTemplateForm) {
  saveAsTemplateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const saveBtn = document.getElementById('saveTemplateBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="ti ti-loader animate-spin"></i> Saving...';
    saveBtn.disabled = true;
    
    try {
      const broadcastId = document.getElementById('saveTemplateBroadcastId').value;
      const accountId = document.getElementById('saveTemplateAccountId').value;
      const name = document.getElementById('saveTemplateName').value;
      
      console.log('[saveAsTemplate] Fetching broadcast details for:', broadcastId);
      
      // Fetch broadcast details first
      const broadcastResponse = await fetch(`/api/youtube/broadcasts?accountId=${accountId}`, {
        headers: {
          'X-CSRF-Token': getCsrfToken()
        }
      });
      
      const broadcastData = await broadcastResponse.json();
      
      if (!broadcastData.success) {
        throw new Error('Failed to fetch broadcast details');
      }
      
      console.log('[saveAsTemplate] All broadcasts:', broadcastData.broadcasts.map(b => ({ id: b.id, title: b.title, streamId: b.streamId, streamKey: b.streamKey })));
      
      const broadcast = broadcastData.broadcasts.find(b => b.id === broadcastId);
      if (!broadcast) {
        throw new Error('Broadcast not found');
      }
      
      console.log('[saveAsTemplate] Found broadcast:', { 
        id: broadcast.id, 
        title: broadcast.title, 
        streamId: broadcast.streamId, 
        streamKey: broadcast.streamKey,
        thumbnailPath: broadcast.thumbnailPath
      });
      
      // Create template from broadcast - include ALL data for reuse
      const templateData = {
        name: name,
        accountId: accountId,
        title: broadcast.title,
        description: broadcast.description || '',
        privacyStatus: broadcast.privacyStatus || 'unlisted',
        tags: broadcast.tags || null,
        categoryId: broadcast.categoryId || '22',
        thumbnailPath: broadcast.thumbnailPath || null,
        thumbnailFolder: currentThumbnailFolder || null,  // Save current thumbnail folder selection
        streamId: broadcast.streamId || null  // Save stream ID for reuse
      };
      
      console.log('[saveAsTemplate] Sending templateData:', {
        ...templateData,
        privacyStatus: templateData.privacyStatus,
        thumbnailFolder: templateData.thumbnailFolder
      });
      
      const response = await fetch('/api/youtube/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrfToken()
        },
        body: JSON.stringify(templateData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('[saveAsTemplate] Template saved successfully with stream_id:', data.template?.stream_id, 'thumbnail_folder:', data.template?.thumbnail_folder);
        showToast('Template saved successfully!');
        closeSaveAsTemplateModal();
      } else {
        showToast(data.error || 'Failed to save template', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showToast(error.message || 'An error occurred', 'error');
    } finally {
      saveBtn.innerHTML = originalText;
      saveBtn.disabled = false;
    }
  });
}

// Delete Template
async function deleteTemplate(templateId, templateName) {
  if (!confirm(`Are you sure you want to delete template "${templateName}"?`)) {
    return;
  }
  
  try {
    const response = await fetch(`/api/youtube/templates/${templateId}`, {
      method: 'DELETE',
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('Template deleted');
      loadTemplates();
    } else {
      showToast(data.error || 'Failed to delete template', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('An error occurred', 'error');
  }
}

// Edit Template - Opens simplified modal for recurring schedule only
async function editTemplate(templateId) {
  try {
    const response = await fetch(`/api/youtube/templates/${templateId}`, {
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    
    if (data.success && data.template) {
      closeTemplateLibraryModal();
      openEditTemplateModal(data.template);
    } else {
      showToast(data.error || 'Failed to load template', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('An error occurred', 'error');
  }
}

// Open Edit Template Modal (Recurring Schedule Only)
function openEditTemplateModal(template) {
  document.getElementById('editTemplateId').value = template.id;
  document.getElementById('editTemplateName').textContent = template.name;
  
  // Store template data for later use
  window.currentEditTemplate = template;
  
  // Load title folders and pre-select current folder
  loadEditTemplateTitleFolders(template.title_folder_id || null);
  
  // Set recurring enabled
  const recurringEnabled = document.getElementById('editRecurringEnabled');
  recurringEnabled.checked = template.recurring_enabled || false;
  
  // Show/hide recurring fields
  const container = document.getElementById('editRecurringFieldsContainer');
  if (template.recurring_enabled) {
    container.classList.remove('hidden');
  } else {
    container.classList.add('hidden');
  }
  
  // Reset pattern radios first
  document.querySelectorAll('input[name="editRecurringPattern"]').forEach(radio => radio.checked = false);
  
  // Set pattern (default to 'daily' if not set but recurring is enabled)
  const pattern = template.recurring_pattern || 'daily';
  const patternRadio = document.querySelector(`input[name="editRecurringPattern"][value="${pattern}"]`);
  if (patternRadio) patternRadio.checked = true;
  
  // Set time (reset if not set)
  document.getElementById('editRecurringTime').value = template.recurring_time || '';
  
  // Reset and set days
  document.querySelectorAll('input[name="editRecurringDays"]').forEach(cb => cb.checked = false);
  if (template.recurring_days && Array.isArray(template.recurring_days)) {
    template.recurring_days.forEach(day => {
      const checkbox = document.querySelector(`input[name="editRecurringDays"][value="${day.toLowerCase()}"]`);
      if (checkbox) checkbox.checked = true;
    });
  }
  
  // Show/hide days container based on pattern
  const daysContainer = document.getElementById('editRecurringDaysContainer');
  if (pattern === 'weekly') {
    daysContainer.classList.remove('hidden');
  } else {
    daysContainer.classList.add('hidden');
  }
  
  // Hide error message
  document.getElementById('editRecurringDaysError').classList.add('hidden');
  
  document.getElementById('editTemplateModal').classList.remove('hidden');
}

function closeEditTemplateModal() {
  document.getElementById('editTemplateModal').classList.add('hidden');
  document.getElementById('editTemplateForm').reset();
  // Clear stored template data
  window.currentEditTemplate = null;
}

// Load title folders for edit template modal
async function loadEditTemplateTitleFolders(selectedFolderId = null) {
  const select = document.getElementById('editTemplateTitleFolder');
  if (!select) return;
  
  try {
    const response = await fetch('/api/title-folders', {
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    
    // Clear and rebuild options
    select.innerHTML = '<option value="">-- Semua Judul (Tanpa Filter Folder) --</option>';
    
    if (data.success && data.folders && data.folders.length > 0) {
      data.folders.forEach(folder => {
        const option = document.createElement('option');
        option.value = folder.id;
        option.textContent = `📂 ${folder.name} (${folder.title_count || 0} judul)`;
        select.appendChild(option);
      });
    }
    
    // Pre-select folder if provided
    if (selectedFolderId) {
      select.value = selectedFolderId;
    }
    
    console.log('[loadEditTemplateTitleFolders] Loaded folders, selected:', selectedFolderId);
  } catch (error) {
    console.error('Error loading title folders:', error);
    select.innerHTML = '<option value="">Error loading folders</option>';
  }
}

// Load thumbnail folders for edit template modal
async function loadEditTemplateThumbnailFolders(selectedFolder = null) {
  const select = document.getElementById('editTemplateThumbnailFolder');
  if (!select) return;
  
  try {
    const response = await fetch('/api/thumbnail-folders', {
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    
    // Clear and rebuild options
    select.innerHTML = '<option value="">-- Tidak ada folder (NULL) --</option>';
    
    // Add root folder option
    const rootOption = document.createElement('option');
    rootOption.value = '__ROOT__';
    rootOption.textContent = '📁 Root (Folder Utama)';
    select.appendChild(rootOption);
    
    if (data.success && data.folders && data.folders.length > 0) {
      data.folders.forEach(folder => {
        const option = document.createElement('option');
        option.value = folder.name;
        option.textContent = `📂 ${folder.name} (${folder.count || 0} thumbnails)`;
        select.appendChild(option);
      });
    }
    
    // Pre-select folder if provided
    if (selectedFolder !== null && selectedFolder !== undefined) {
      if (selectedFolder === '') {
        select.value = '__ROOT__';
      } else {
        select.value = selectedFolder;
      }
      // Show preview
      onEditTemplateThumbnailFolderChange(select.value);
    }
    
    console.log('[loadEditTemplateThumbnailFolders] Loaded folders, selected:', selectedFolder);
  } catch (error) {
    console.error('Error loading thumbnail folders:', error);
    select.innerHTML = '<option value="">Error loading folders</option>';
  }
}

// Handle thumbnail folder change in edit template modal
async function onEditTemplateThumbnailFolderChange(folderValue) {
  const previewContainer = document.getElementById('editTemplateThumbnailFolderPreview');
  const imagesContainer = document.getElementById('editTemplateThumbnailFolderImages');
  
  if (!previewContainer || !imagesContainer) return;
  
  if (!folderValue) {
    previewContainer.classList.add('hidden');
    return;
  }
  
  // Convert __ROOT__ to empty string for API
  const folder = folderValue === '__ROOT__' ? '' : folderValue;
  
  try {
    let url = '/api/thumbnails';
    if (folder) {
      url += `?folder=${encodeURIComponent(folder)}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    
    if (data.success && data.thumbnails && data.thumbnails.length > 0) {
      previewContainer.classList.remove('hidden');
      imagesContainer.innerHTML = data.thumbnails.slice(0, 5).map((thumb, i) => `
        <div class="w-12 h-8 flex-shrink-0 rounded overflow-hidden border border-gray-600 relative">
          <img src="${thumb.url}" class="w-full h-full object-cover" alt="Thumb ${i + 1}">
          <span class="absolute bottom-0 right-0 bg-black/70 text-[8px] text-white px-0.5">${i + 1}</span>
        </div>
      `).join('') + (data.thumbnails.length > 5 ? `<span class="text-xs text-gray-500 self-center">+${data.thumbnails.length - 5} more</span>` : '');
    } else {
      previewContainer.classList.remove('hidden');
      imagesContainer.innerHTML = '<span class="text-xs text-yellow-400">⚠️ Folder kosong - tidak ada thumbnail</span>';
    }
  } catch (error) {
    console.error('Error loading folder preview:', error);
    previewContainer.classList.add('hidden');
  }
}

// Toggle recurring fields in edit modal
function toggleEditRecurringFields() {
  const enabled = document.getElementById('editRecurringEnabled').checked;
  const container = document.getElementById('editRecurringFieldsContainer');
  
  if (enabled) {
    container.classList.remove('hidden');
  } else {
    container.classList.add('hidden');
  }
}

// Toggle days selection in edit modal
function toggleEditDaysSelection() {
  const pattern = document.querySelector('input[name="editRecurringPattern"]:checked')?.value;
  const daysContainer = document.getElementById('editRecurringDaysContainer');
  
  if (pattern === 'weekly') {
    daysContainer.classList.remove('hidden');
  } else {
    daysContainer.classList.add('hidden');
  }
}

// Edit Template Form Handler
const editTemplateForm = document.getElementById('editTemplateForm');
if (editTemplateForm) {
  editTemplateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const updateBtn = document.getElementById('updateTemplateBtn');
    const originalText = updateBtn.innerHTML;
    updateBtn.innerHTML = '<i class="ti ti-loader animate-spin"></i> Saving...';
    updateBtn.disabled = true;
    
    try {
      const templateId = document.getElementById('editTemplateId').value;
      const recurringEnabled = document.getElementById('editRecurringEnabled').checked;
      
      const updateData = {
        recurringEnabled: recurringEnabled
      };
      
      // Get title folder ID
      const titleFolderSelect = document.getElementById('editTemplateTitleFolder');
      const titleFolderId = titleFolderSelect ? (titleFolderSelect.value || null) : null;
      updateData.titleFolderId = titleFolderId;
      
      console.log('[editTemplate] Updating template with titleFolderId:', titleFolderId);
      
      if (recurringEnabled) {
        const pattern = document.querySelector('input[name="editRecurringPattern"]:checked')?.value;
        const time = document.getElementById('editRecurringTime').value;
        
        if (!pattern) {
          showToast('Please select a pattern', 'error');
          return;
        }
        if (!time) {
          showToast('Please set a time', 'error');
          return;
        }
        
        updateData.recurringPattern = pattern;
        updateData.recurringTime = time;
        
        if (pattern === 'weekly') {
          const days = Array.from(document.querySelectorAll('input[name="editRecurringDays"]:checked'))
            .map(cb => cb.value);
          
          if (days.length === 0) {
            document.getElementById('editRecurringDaysError').classList.remove('hidden');
            showToast('Please select at least one day', 'error');
            return;
          }
          
          updateData.recurringDays = days;
        } else {
          // For daily pattern, explicitly clear recurring_days
          updateData.recurringDays = null;
        }
      } else {
        // When disabling recurring, clear all recurring fields
        updateData.recurringPattern = null;
        updateData.recurringTime = null;
        updateData.recurringDays = null;
      }
      
      // Use main template update endpoint to save both thumbnailFolder and recurring config
      const response = await fetch(`/api/youtube/templates/${templateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrfToken()
        },
        body: JSON.stringify(updateData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        showToast('Template updated successfully!');
        closeEditTemplateModal();
        // Refresh template library if open
        loadTemplates();
      } else {
        showToast(data.error || 'Failed to update template', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showToast('An error occurred', 'error');
    } finally {
      updateBtn.innerHTML = originalText;
      updateBtn.disabled = false;
    }
  });
}

// Create Broadcast from Template
async function createFromTemplate(templateId) {
  try {
    const response = await fetch(`/api/youtube/templates/${templateId}`, {
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    
    if (data.success && data.template) {
      closeTemplateLibraryModal();
      openCreateBroadcastModal();
      
      // Pre-fill form with template data
      const template = data.template;
      document.getElementById('accountSelect').value = template.account_id;
      document.getElementById('broadcastTitle').value = template.title;
      document.getElementById('broadcastDescription').value = template.description || '';
      document.getElementById('privacyStatus').value = template.privacy_status || 'unlisted';
      // Note: Category field removed from UI
      
      // Set tags if available
      if (template.tags && Array.isArray(template.tags)) {
        currentTags = [...template.tags];
        renderTags();
      }
      
      showToast('Template loaded. Please set schedule time.', 'info');
    } else {
      showToast(data.error || 'Failed to load template', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('An error occurred', 'error');
  }
}

// Add Save as Template button to broadcast actions
function addSaveAsTemplateButton(broadcastId, accountId, title, privacyStatus) {
  openSaveAsTemplateModal(broadcastId, accountId, title, privacyStatus);
}

// ==========================================
// Multi-Select Broadcast Functions
// ==========================================

// Get selected broadcasts
function getSelectedBroadcasts() {
  const checkboxes = document.querySelectorAll('.broadcast-checkbox:checked');
  const broadcasts = [];
  const seenIds = new Set();
  
  checkboxes.forEach(cb => {
    try {
      const data = JSON.parse(cb.dataset.broadcast);
      // Avoid duplicates (desktop + mobile checkboxes)
      if (!seenIds.has(data.id)) {
        seenIds.add(data.id);
        broadcasts.push(data);
      }
    } catch (e) {
      console.error('Error parsing broadcast data:', e);
    }
  });
  return broadcasts;
}

// Sync checkboxes between desktop and mobile views
function syncCheckboxes(checkbox) {
  const broadcastId = checkbox.dataset.broadcastId;
  if (!broadcastId) return;
  
  // Find all checkboxes with the same broadcast ID and sync their state
  const allCheckboxes = document.querySelectorAll(`.broadcast-checkbox[data-broadcast-id="${broadcastId}"]`);
  allCheckboxes.forEach(cb => {
    if (cb !== checkbox) {
      cb.checked = checkbox.checked;
    }
  });
}

// Update selection count display
function updateSelectionCount() {
  const selected = getSelectedBroadcasts();
  const countEl = document.getElementById('selectedCount');
  const actionsEl = document.getElementById('selectionActions');
  
  if (countEl) {
    countEl.textContent = `${selected.length} selected`;
  }
  
  if (actionsEl) {
    if (selected.length > 0) {
      actionsEl.classList.remove('hidden');
      actionsEl.classList.add('flex');
    } else {
      actionsEl.classList.add('hidden');
      actionsEl.classList.remove('flex');
    }
  }
  
  // Update select all checkbox state
  const selectAllCheckbox = document.getElementById('selectAllBroadcasts');
  const allCheckboxes = document.querySelectorAll('.broadcast-checkbox');
  if (selectAllCheckbox && allCheckboxes.length > 0) {
    selectAllCheckbox.checked = selected.length === allCheckboxes.length;
    selectAllCheckbox.indeterminate = selected.length > 0 && selected.length < allCheckboxes.length;
  }
}

// Toggle select all broadcasts
function toggleSelectAll(checkbox) {
  const allCheckboxes = document.querySelectorAll('.broadcast-checkbox');
  allCheckboxes.forEach(cb => {
    cb.checked = checkbox.checked;
  });
  updateSelectionCount();
}

// Clear all selections
function clearSelection() {
  const allCheckboxes = document.querySelectorAll('.broadcast-checkbox');
  allCheckboxes.forEach(cb => {
    cb.checked = false;
  });
  const selectAllCheckbox = document.getElementById('selectAllBroadcasts');
  if (selectAllCheckbox) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
  }
  updateSelectionCount();
}

// Save selected broadcasts as template
function saveSelectedAsTemplate() {
  const selected = getSelectedBroadcasts();
  
  if (selected.length === 0) {
    showToast('Please select at least one broadcast', 'error');
    return;
  }
  
  // Open multi-save template modal
  openMultiSaveTemplateModal(selected);
}

// Delete selected broadcasts
async function deleteSelectedBroadcasts() {
  const selected = getSelectedBroadcasts();
  
  if (selected.length === 0) {
    showToast('Please select at least one broadcast', 'error');
    return;
  }
  
  if (!confirm(`Are you sure you want to delete ${selected.length} broadcast(s)?`)) {
    return;
  }
  
  let successCount = 0;
  let failCount = 0;
  
  for (const broadcast of selected) {
    try {
      let url = `/api/youtube/broadcasts/${broadcast.id}`;
      if (broadcast.accountId) {
        url += `?accountId=${broadcast.accountId}`;
      }
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': getCsrfToken()
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (error) {
      console.error('Error deleting broadcast:', error);
      failCount++;
    }
  }
  
  if (failCount === 0) {
    showToast(`Successfully deleted ${successCount} broadcast(s)`);
  } else {
    showToast(`Deleted ${successCount}/${selected.length}. ${failCount} failed.`, 'error');
  }
  
  setTimeout(() => window.location.reload(), 1000);
}

// Multi-Save Template Modal
async function openMultiSaveTemplateModal(broadcasts) {
  // Store broadcasts data
  window.selectedBroadcastsForTemplate = broadcasts;
  
  // Collect folder for each broadcast
  const broadcastFolders = {};
  const streamKeyFolderMapping = {};
  const broadcastsWithoutFolder = [];
  
  console.log('[openMultiSaveTemplateModal] Processing', broadcasts.length, 'broadcasts');
  console.log('[openMultiSaveTemplateModal] Current UI folder:', currentThumbnailFolder);
  console.log('[openMultiSaveTemplateModal] Broadcasts data:', broadcasts.map(b => ({
    id: b.id,
    title: b.title,
    streamId: b.streamId,
    streamKey: b.streamKey
  })));
  
  for (const b of broadcasts) {
    console.log(`\n[openMultiSaveTemplateModal] === Checking broadcast: ${b.title} ===`);
    console.log(`[openMultiSaveTemplateModal] Broadcast ID: ${b.id}, Stream ID: ${b.streamId}`);
    
    // Try to get folder from broadcast settings first
    const settings = await getBroadcastSettingsFromServer(b.id, b.accountId);
    console.log(`[openMultiSaveTemplateModal] Broadcast settings:`, settings);
    
    if (settings && settings.thumbnailFolder !== null && settings.thumbnailFolder !== undefined) {
      broadcastFolders[b.id] = settings.thumbnailFolder;
      if (b.streamId) {
        streamKeyFolderMapping[b.streamId] = settings.thumbnailFolder;
      }
      console.log(`[openMultiSaveTemplateModal] ✓ Got folder from settings: "${settings.thumbnailFolder || 'root'}"`);
    } else {
      // Fallback 1: try stream key folder mapping from database
      let foundFolder = false;
      if (b.streamId) {
        console.log(`[openMultiSaveTemplateModal] Trying stream key mapping for: ${b.streamId}`);
        const folder = await getStreamKeyFolderMappingFromServer(b.streamId);
        console.log(`[openMultiSaveTemplateModal] Stream key mapping result:`, folder);
        
        if (folder !== null && folder !== undefined) {
          broadcastFolders[b.id] = folder;
          streamKeyFolderMapping[b.streamId] = folder;
          foundFolder = true;
          console.log(`[openMultiSaveTemplateModal] ✓ Got folder from stream key mapping: "${folder || 'root'}"`);
        }
      }
      
      // Fallback 2: use current UI folder selection
      if (!foundFolder && currentThumbnailFolder !== null) {
        broadcastFolders[b.id] = currentThumbnailFolder;
        if (b.streamId) {
          streamKeyFolderMapping[b.streamId] = currentThumbnailFolder;
        }
        console.log(`[openMultiSaveTemplateModal] ✓ Using current UI folder: "${currentThumbnailFolder || 'root'}"`);
      } else if (!foundFolder) {
        broadcastsWithoutFolder.push(b.title);
        console.log(`[openMultiSaveTemplateModal] ✗ No folder found for this broadcast`);
      }
    }
  }
  
  // Store mapping for form submission
  window.multiTemplateBroadcastFolders = broadcastFolders;
  window.multiTemplateStreamKeyFolderMapping = streamKeyFolderMapping;
  
  console.log('\n[openMultiSaveTemplateModal] === FINAL RESULTS ===');
  console.log('[openMultiSaveTemplateModal] Broadcast folders:', broadcastFolders);
  console.log('[openMultiSaveTemplateModal] Stream key folder mapping:', streamKeyFolderMapping);
  
  // Update preview - show broadcasts with their folders
  const previewEl = document.getElementById('multiTemplatePreview');
  if (previewEl) {
    let html = broadcasts.map((b, i) => {
      const folder = broadcastFolders[b.id];
      const hasFolder = folder !== null && folder !== undefined;
      const folderDisplay = hasFolder ? (folder === '' ? '📁 Root' : `📂 ${folder}`) : '⚠️ Belum diset';
      const folderClass = hasFolder ? 'text-green-400' : 'text-yellow-400';
      
      return `
        <div class="flex items-center gap-2 text-xs py-1 border-b border-gray-600/50 last:border-0">
          <span class="text-gray-500 w-4">${i + 1}.</span>
          <span class="text-white truncate flex-1">${escapeHtml(b.title)}</span>
          <span class="${folderClass} text-[10px] flex-shrink-0">${folderDisplay}</span>
        </div>
      `;
    }).join('');
    
    previewEl.innerHTML = html;
  }
  
  // Show warning if some broadcasts don't have folder
  const warningEl = document.getElementById('multiTemplateFolderWarning');
  const warningTextEl = document.getElementById('multiTemplateFolderWarningText');
  if (broadcastsWithoutFolder.length > 0 && warningEl && warningTextEl) {
    warningTextEl.textContent = `${broadcastsWithoutFolder.length} broadcast belum punya folder. Folder akan diset ke NULL.`;
    warningEl.classList.remove('hidden');
  } else if (warningEl) {
    warningEl.classList.add('hidden');
  }
  
  document.getElementById('multiSaveTemplateModal').classList.remove('hidden');
}

function closeMultiSaveTemplateModal() {
  document.getElementById('multiSaveTemplateModal').classList.add('hidden');
  document.getElementById('multiSaveTemplateForm').reset();
  window.selectedBroadcastsForTemplate = null;
  window.multiTemplateBroadcastFolders = null;
  window.multiTemplateStreamKeyFolderMapping = null;
  // Hide warning
  const warningEl = document.getElementById('multiTemplateFolderWarning');
  if (warningEl) warningEl.classList.add('hidden');
}

// Multi-Save Template Form Handler
const multiSaveTemplateForm = document.getElementById('multiSaveTemplateForm');
if (multiSaveTemplateForm) {
  multiSaveTemplateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const saveBtn = document.getElementById('multiSaveTemplateBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="ti ti-loader animate-spin"></i> Saving...';
    saveBtn.disabled = true;
    
    try {
      const broadcasts = window.selectedBroadcastsForTemplate;
      const templateName = document.getElementById('multiTemplateName').value;
      const broadcastFolders = window.multiTemplateBroadcastFolders || {};
      const streamKeyFolderMapping = window.multiTemplateStreamKeyFolderMapping || {};
      
      if (!broadcasts || broadcasts.length === 0) {
        throw new Error('No broadcasts selected');
      }
      
      // Determine default folder (use first broadcast's folder or null)
      let defaultFolder = null;
      if (broadcasts[0] && broadcastFolders[broadcasts[0].id] !== undefined) {
        defaultFolder = broadcastFolders[broadcasts[0].id];
      }
      
      console.log('[multiSaveTemplate] Broadcast folders:', broadcastFolders);
      console.log('[multiSaveTemplate] Stream key folder mapping:', streamKeyFolderMapping);
      console.log('[multiSaveTemplate] Default folder:', defaultFolder);
      
      // Create template with all broadcast data
      const templateData = {
        name: templateName,
        accountId: broadcasts[0].accountId,
        thumbnailFolder: defaultFolder,
        streamKeyFolderMapping: Object.keys(streamKeyFolderMapping).length > 0 ? streamKeyFolderMapping : null,
        broadcasts: broadcasts.map(b => ({
          title: b.title,
          description: b.description || '',
          privacyStatus: b.privacyStatus || 'unlisted',
          streamId: b.streamId || null,
          streamKey: b.streamKey || '',
          categoryId: b.categoryId || '22',
          tags: b.tags || [],
          thumbnailPath: b.thumbnailPath || null,
          pinnedThumbnail: b.pinnedThumbnail || null,
          // Use folder from broadcast settings
          thumbnailFolder: broadcastFolders[b.id] !== undefined ? broadcastFolders[b.id] : defaultFolder
        }))
      };
      
      console.log('[multiSaveTemplate] Saving template:', {
        name: templateData.name,
        broadcastCount: templateData.broadcasts.length,
        broadcasts: templateData.broadcasts.map(b => ({ title: b.title, thumbnailFolder: b.thumbnailFolder }))
      });
      
      const response = await fetch('/api/youtube/templates/multi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrfToken()
        },
        body: JSON.stringify(templateData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        showToast(`Template "${templateName}" saved with ${broadcasts.length} broadcast(s)!`);
        closeMultiSaveTemplateModal();
        clearSelection();
      } else {
        showToast(data.error || 'Failed to save template', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showToast(error.message || 'An error occurred', 'error');
    } finally {
      saveBtn.innerHTML = originalText;
      saveBtn.disabled = false;
    }
  });
}

// Re-create broadcasts from template
async function recreateFromTemplate(templateId) {
  try {
    const response = await fetch(`/api/youtube/templates/${templateId}`, {
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    
    if (data.success && data.template) {
      closeTemplateLibraryModal();
      
      // Check if template has multiple broadcasts
      if (data.template.broadcasts && data.template.broadcasts.length > 0) {
        openRecreateFromTemplateModal(data.template);
      } else {
        // Single broadcast template - use existing flow
        createFromTemplate(templateId);
      }
    } else {
      showToast(data.error || 'Failed to load template', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('An error occurred', 'error');
  }
}

// Open Re-create from Template Modal
function openRecreateFromTemplateModal(template) {
  window.currentRecreateTemplate = template;
  
  document.getElementById('recreateTemplateName').textContent = template.name;
  
  // Check if account is invalid and show account selector
  const accountSelectorContainer = document.getElementById('recreateAccountSelector');
  if (accountSelectorContainer) {
    if (template.account_valid === false && template.available_accounts && template.available_accounts.length > 0) {
      // Show account selector with warning
      accountSelectorContainer.innerHTML = `
        <div class="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 mb-4">
          <div class="flex items-start gap-2">
            <i class="ti ti-alert-triangle text-orange-400 mt-0.5"></i>
            <div class="flex-1">
              <p class="text-sm text-orange-400 font-medium">YouTube account disconnected</p>
              <p class="text-xs text-gray-400 mt-1">The original account for this template is no longer connected. Please select a new account:</p>
            </div>
          </div>
          <select id="recreateAccountSelect" class="w-full mt-3 px-3 py-2 bg-dark-600 border border-gray-600 rounded-lg focus:border-primary focus:outline-none text-sm">
            ${template.available_accounts.map(acc => 
              `<option value="${acc.id}" ${acc.isPrimary ? 'selected' : ''}>${escapeHtml(acc.channelName || 'YouTube Channel')}${acc.isPrimary ? ' (Primary)' : ''}</option>`
            ).join('')}
          </select>
        </div>
      `;
      accountSelectorContainer.classList.remove('hidden');
    } else if (template.account_valid === false) {
      // No accounts available
      accountSelectorContainer.innerHTML = `
        <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
          <div class="flex items-start gap-2">
            <i class="ti ti-alert-circle text-red-400 mt-0.5"></i>
            <div class="flex-1">
              <p class="text-sm text-red-400 font-medium">No YouTube account connected</p>
              <p class="text-xs text-gray-400 mt-1">Please connect a YouTube account first before re-creating broadcasts.</p>
            </div>
          </div>
        </div>
      `;
      accountSelectorContainer.classList.remove('hidden');
      // Disable the create button
      const createBtn = document.getElementById('recreateBtn');
      if (createBtn) {
        createBtn.disabled = true;
        createBtn.classList.add('opacity-50', 'cursor-not-allowed');
      }
    } else {
      // Account is valid, hide selector
      accountSelectorContainer.innerHTML = '';
      accountSelectorContainer.classList.add('hidden');
      // Enable the create button
      const createBtn = document.getElementById('recreateBtn');
      if (createBtn) {
        createBtn.disabled = false;
        createBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    }
  }
  
  // Render broadcast list with schedule inputs
  const listEl = document.getElementById('recreateBroadcastList');
  const broadcasts = template.broadcasts || [template];
  const mapping = template.stream_key_folder_mapping || {};
  
  listEl.innerHTML = broadcasts.map((b, i) => {
    const minDate = new Date(Date.now() + 11 * 60 * 1000);
    const minDateStr = minDate.toISOString().slice(0, 16);
    
    // Determine folder for this broadcast
    const streamId = b.streamId || template.stream_id;
    let folder = null;
    if (streamId && mapping[streamId] !== undefined) {
      folder = mapping[streamId];
    } else if (b.thumbnailFolder !== null && b.thumbnailFolder !== undefined) {
      folder = b.thumbnailFolder;
    } else if (template.thumbnail_folder !== null && template.thumbnail_folder !== undefined) {
      folder = template.thumbnail_folder;
    }
    
    const folderDisplay = folder !== null ? (folder === '' ? '📁 Root' : `📂 ${folder}`) : '⚠️ No folder';
    const folderClass = folder !== null ? 'text-green-400' : 'text-yellow-400';
    
    return `
      <div class="bg-dark-700 rounded-lg p-3 space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-medium text-sm text-white">${i + 1}. ${escapeHtml(b.title)}</span>
          <span class="text-xs ${folderClass}">${folderDisplay}</span>
        </div>
        ${b.streamKey ? `<div class="text-xs text-gray-400 font-mono truncate">Key: ${escapeHtml(b.streamKey)}</div>` : ''}
        <div>
          <label class="text-xs text-gray-400 block mb-1">Schedule Time</label>
          <input type="datetime-local" name="recreateSchedule[]" required min="${minDateStr}"
            class="w-full px-3 py-2 bg-dark-600 border border-gray-600 rounded-lg focus:border-primary focus:outline-none text-sm [color-scheme:dark]">
        </div>
      </div>
    `;
  }).join('');
  
  document.getElementById('recreateFromTemplateModal').classList.remove('hidden');
  
  // Load title rotation settings and check if enabled
  loadRecreateTitleRotationPreview();
}

function closeRecreateFromTemplateModal() {
  document.getElementById('recreateFromTemplateModal').classList.add('hidden');
  window.currentRecreateTemplate = null;
  window.recreateUseTitleRotation = false;
  
  // Reset title rotation checkbox
  const checkbox = document.getElementById('recreateUseTitleRotation');
  if (checkbox) checkbox.checked = false;
  
  const preview = document.getElementById('recreateTitleRotationPreview');
  if (preview) preview.classList.add('hidden');
}

/**
 * Toggle title rotation for recreate
 */
async function toggleRecreateTitleRotation(enabled) {
  window.recreateUseTitleRotation = enabled;
  
  const preview = document.getElementById('recreateTitleRotationPreview');
  if (enabled) {
    if (preview) preview.classList.remove('hidden');
    await loadRecreateTitleRotationPreview();
    
    // Update broadcast list to show rotated titles
    updateRecreateBroadcastTitles();
  } else {
    if (preview) preview.classList.add('hidden');
    
    // Reset to original titles
    resetRecreateBroadcastTitles();
  }
}

/**
 * Load title rotation preview for recreate modal
 */
async function loadRecreateTitleRotationPreview() {
  try {
    // Get title rotation settings
    const settingsResponse = await fetch('/api/title-rotation/settings', {
      headers: { 'X-CSRF-Token': getCsrfToken() }
    });
    const settings = await settingsResponse.json();
    
    // Store settings for later use
    window.recreateTitleRotationSettings = settings;
    
    if (settings.success && settings.enabled) {
      // Auto-enable checkbox if user has title rotation enabled
      const checkbox = document.getElementById('recreateUseTitleRotation');
      if (checkbox && !checkbox.checked) {
        checkbox.checked = true;
        window.recreateUseTitleRotation = true;
        const preview = document.getElementById('recreateTitleRotationPreview');
        if (preview) preview.classList.remove('hidden');
      }
    }
    
    // Use currentIndex from settings (this is the user-selected start position)
    const currentIndex = settings.currentIndex || 0;
    
    // Get next title starting from currentIndex
    let url = `/api/title-rotation/next?currentIndex=${currentIndex}`;
    if (settings.folderId) {
      url += `&folderId=${encodeURIComponent(settings.folderId)}`;
    }
    
    const response = await fetch(url, {
      headers: { 'X-CSRF-Token': getCsrfToken() }
    });
    const data = await response.json();
    
    const titleEl = document.getElementById('recreateNextTitle');
    if (data.success && data.title) {
      if (titleEl) {
        titleEl.textContent = data.title.title;
        titleEl.title = data.title.title;
      }
      // Get all titles for all broadcasts starting from currentIndex
      window.recreateNextTitles = await getNextTitlesForRecreate(currentIndex, settings.folderId);
    } else {
      if (titleEl) titleEl.textContent = 'Tidak ada judul';
      window.recreateNextTitles = [];
    }
  } catch (error) {
    console.error('Error loading title rotation preview:', error);
  }
}

/**
 * Get next titles for all broadcasts in recreate
 */
async function getNextTitlesForRecreate(startIndex, folderId) {
  const template = window.currentRecreateTemplate;
  if (!template) return [];
  
  const broadcasts = template.broadcasts || [template];
  const titles = [];
  let currentIndex = startIndex;
  
  for (let i = 0; i < broadcasts.length; i++) {
    try {
      let url = `/api/title-rotation/next?currentIndex=${currentIndex}`;
      if (folderId) {
        url += `&folderId=${encodeURIComponent(folderId)}`;
      }
      
      const response = await fetch(url, {
        headers: { 'X-CSRF-Token': getCsrfToken() }
      });
      const data = await response.json();
      
      if (data.success && data.title) {
        titles.push({
          id: data.title.id,
          title: data.title.title,
          currentIndex: currentIndex,
          nextIndex: data.nextIndex  // Store nextIndex for updating rotation after use
        });
        currentIndex = data.nextIndex;  // Move to next index for next broadcast
      } else {
        titles.push(null);
      }
    } catch (error) {
      titles.push(null);
    }
  }
  
  // Store the final nextIndex for updating after all broadcasts are created
  window.recreateFinalNextIndex = currentIndex;
  
  return titles;
}

/**
 * Update broadcast list with rotated titles
 */
function updateRecreateBroadcastTitles() {
  const template = window.currentRecreateTemplate;
  if (!template || !window.recreateNextTitles) return;
  
  const broadcasts = template.broadcasts || [template];
  const listEl = document.getElementById('recreateBroadcastList');
  if (!listEl) return;
  
  const items = listEl.querySelectorAll('.bg-dark-700');
  items.forEach((item, i) => {
    const titleSpan = item.querySelector('.font-medium');
    if (titleSpan && window.recreateNextTitles[i]) {
      const originalTitle = broadcasts[i].title;
      const rotatedTitle = window.recreateNextTitles[i].title;
      titleSpan.innerHTML = `${i + 1}. <span class="text-primary">${escapeHtml(rotatedTitle)}</span> <span class="text-xs text-gray-500">(was: ${escapeHtml(originalTitle)})</span>`;
    }
  });
}

/**
 * Reset broadcast list to original titles
 */
function resetRecreateBroadcastTitles() {
  const template = window.currentRecreateTemplate;
  if (!template) return;
  
  const broadcasts = template.broadcasts || [template];
  const listEl = document.getElementById('recreateBroadcastList');
  if (!listEl) return;
  
  const items = listEl.querySelectorAll('.bg-dark-700');
  items.forEach((item, i) => {
    const titleSpan = item.querySelector('.font-medium');
    if (titleSpan) {
      titleSpan.textContent = `${i + 1}. ${broadcasts[i].title}`;
    }
  });
}

// Re-create Form Handler
const recreateFromTemplateForm = document.getElementById('recreateFromTemplateForm');
if (recreateFromTemplateForm) {
  recreateFromTemplateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const createBtn = document.getElementById('recreateBtn');
    const originalText = createBtn.innerHTML;
    createBtn.innerHTML = '<i class="ti ti-loader animate-spin"></i> Creating...';
    createBtn.disabled = true;
    
    try {
      const template = window.currentRecreateTemplate;
      const scheduleInputs = document.querySelectorAll('input[name="recreateSchedule[]"]');
      const schedules = Array.from(scheduleInputs).map(input => input.value).filter(v => v);
      
      const broadcasts = template.broadcasts || [template];
      const useTitleRotation = window.recreateUseTitleRotation && window.recreateNextTitles && window.recreateNextTitles.length > 0;
      
      console.log('[recreate] Template stream_key_folder_mapping:', template.stream_key_folder_mapping);
      console.log('[recreate] Broadcasts:', broadcasts.map(b => ({ title: b.title, streamId: b.streamId, thumbnailFolder: b.thumbnailFolder })));
      console.log('[recreate] Use title rotation:', useTitleRotation);
      
      if (schedules.length !== broadcasts.length) {
        showToast('Please set schedule time for all broadcasts', 'error');
        return;
      }
      
      // Get account ID - use selected account if original is invalid
      let accountId = template.account_id;
      const accountSelect = document.getElementById('recreateAccountSelect');
      if (accountSelect && template.account_valid === false) {
        accountId = parseInt(accountSelect.value);
        console.log('[recreate] Using new account ID:', accountId, '(original was invalid)');
      }
      
      // Create broadcasts one by one
      const results = { total: broadcasts.length, success: 0, failed: 0, errors: [] };
      const usedTitleIds = []; // Track used title IDs for incrementing use count
      
      for (let i = 0; i < broadcasts.length; i++) {
        const broadcast = broadcasts[i];
        const schedule = schedules[i];
        
        // Determine title - use rotated title if enabled
        let finalTitle = broadcast.title;
        if (useTitleRotation && window.recreateNextTitles[i]) {
          finalTitle = window.recreateNextTitles[i].title;
          usedTitleIds.push(window.recreateNextTitles[i].id);
          console.log(`[recreate] Broadcast ${i + 1} using rotated title: "${finalTitle}"`);
        }
        
        try {
          const formData = new FormData();
          formData.append('accountId', accountId);
          formData.append('title', finalTitle);
          formData.append('description', broadcast.description || '');
          formData.append('scheduledStartTime', schedule);
          formData.append('privacyStatus', broadcast.privacyStatus || 'unlisted');
          // Note: Category field removed, backend uses default value
          
          // IMPORTANT: Always enable auto-start when re-creating from template
          // This ensures YouTube broadcast starts automatically when stream begins
          formData.append('enableAutoStart', 'true');
          formData.append('enableAutoStop', 'true');
          formData.append('unlistReplayOnEnd', 'true');
          
          if (broadcast.tags && broadcast.tags.length > 0) {
            formData.append('tags', JSON.stringify(broadcast.tags));
          }
          
          // Use streamId to reuse the same stream key (only if account is still valid)
          // If account changed, don't use old streamId as it belongs to different account
          const streamId = broadcast.streamId || template.stream_id;
          if (template.account_valid !== false) {
            if (broadcast.streamId) {
              formData.append('streamId', broadcast.streamId);
              console.log('[recreate] Using streamId:', broadcast.streamId);
            } else if (template.stream_id) {
              // Fallback to template's stream_id for single broadcast templates
              formData.append('streamId', template.stream_id);
              console.log('[recreate] Using template stream_id:', template.stream_id);
            }
          } else {
            console.log('[recreate] Skipping streamId - account changed, will create new stream key');
          }
          
          // Determine thumbnail folder - priority:
          // 1. Stream key folder mapping (binding stream key to folder)
          // 2. Broadcast-specific thumbnailFolder
          // 3. Template thumbnail_folder
          // 4. Default to root folder ('') for rotation
          let thumbnailFolder = '';  // Default to root folder for rotation
          
          // First check stream_key_folder_mapping for this stream key
          if (streamId && template.stream_key_folder_mapping && template.stream_key_folder_mapping[streamId] !== undefined) {
            thumbnailFolder = template.stream_key_folder_mapping[streamId];
            console.log('[recreate] Using stream key folder mapping:', streamId, '->', thumbnailFolder || 'root');
          } else if (broadcast.thumbnailFolder !== null && broadcast.thumbnailFolder !== undefined) {
            thumbnailFolder = broadcast.thumbnailFolder;
            console.log('[recreate] Using broadcast thumbnail folder:', thumbnailFolder || 'root');
          } else if (template.thumbnail_folder !== null && template.thumbnail_folder !== undefined) {
            thumbnailFolder = template.thumbnail_folder;
            console.log('[recreate] Using template thumbnail folder:', thumbnailFolder || 'root');
          } else {
            console.log('[recreate] Using default root folder for thumbnail rotation');
          }
          
          // Always send thumbnailFolder for rotation (empty string = root folder)
          formData.append('thumbnailFolder', thumbnailFolder);
          
          // Send streamId - backend will get thumbnail index from database
          // No need to fetch index here, backend handles it
          
          const response = await fetch('/api/youtube/broadcasts', {
            method: 'POST',
            headers: {
              'X-CSRF-Token': getCsrfToken()
            },
            body: formData
          });
          
          const data = await response.json();
          
          if (data.success) {
            results.success++;
          } else {
            results.failed++;
            results.errors.push({ title: finalTitle, error: data.error });
          }
        } catch (err) {
          results.failed++;
          results.errors.push({ title: finalTitle, error: err.message });
        }
      }
      
      // If title rotation was used and broadcasts were created successfully, update use counts and rotation index
      if (useTitleRotation && results.success > 0 && usedTitleIds.length > 0) {
        try {
          // Increment use count for each used title
          for (const titleId of usedTitleIds) {
            await fetch(`/api/title-suggestions/${titleId}/use`, {
              method: 'POST',
              headers: { 'X-CSRF-Token': getCsrfToken() }
            });
          }
          
          // Update rotation index to the next position after all used titles
          // Use the final nextIndex that was calculated when getting titles
          const newRotationIndex = window.recreateFinalNextIndex || 0;
          
          await fetch('/api/title-rotation/update-index', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': getCsrfToken()
            },
            body: JSON.stringify({ newIndex: newRotationIndex })
          });
          
          console.log('[recreate] Updated title rotation index to:', newRotationIndex);
        } catch (err) {
          console.error('[recreate] Failed to update title rotation:', err);
        }
      }
      
      // If account was changed and broadcasts were created successfully, update template
      if (template.account_valid === false && results.success > 0 && accountId !== template.account_id) {
        try {
          await fetch(`/api/youtube/templates/${template.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': getCsrfToken()
            },
            body: JSON.stringify({ accountId: accountId })
          });
          console.log('[recreate] Updated template with new account ID:', accountId);
        } catch (err) {
          console.error('[recreate] Failed to update template account:', err);
        }
      }
      
      closeRecreateFromTemplateModal();
      
      // Show results
      if (results.failed === 0) {
        showToast(`Successfully created ${results.success} broadcast(s)!`);
        setTimeout(() => window.location.reload(), 1000);
      } else {
        showToast(`Created ${results.success}/${results.total} broadcasts. ${results.failed} failed.`, 'error');
        console.error('Failed broadcasts:', results.errors);
        setTimeout(() => window.location.reload(), 2000);
      }
      
    } catch (error) {
      console.error('Error:', error);
      showToast('An error occurred', 'error');
    } finally {
      createBtn.innerHTML = originalText;
      createBtn.disabled = false;
    }
  });
}

// ============================================
// RECURRING SCHEDULE MANAGEMENT
// ============================================

// Toggle recurring fields visibility
function toggleRecurringFields() {
  const enabled = document.getElementById('templateRecurringEnabled').checked;
  const container = document.getElementById('recurringFieldsContainer');
  
  if (enabled) {
    container.classList.remove('hidden');
    // Set default pattern to daily if none selected
    const dailyRadio = document.querySelector('input[name="recurringPattern"][value="daily"]');
    if (dailyRadio && !document.querySelector('input[name="recurringPattern"]:checked')) {
      dailyRadio.checked = true;
    }
  } else {
    container.classList.add('hidden');
  }
}

// Toggle days selection visibility based on pattern
function toggleDaysSelection() {
  const pattern = document.querySelector('input[name="recurringPattern"]:checked')?.value;
  const daysContainer = document.getElementById('recurringDaysContainer');
  
  if (pattern === 'weekly') {
    daysContainer.classList.remove('hidden');
  } else {
    daysContainer.classList.add('hidden');
    // Clear days selection when switching to daily
    document.querySelectorAll('input[name="recurringDays"]').forEach(cb => cb.checked = false);
  }
}

// Get recurring data from form
function getRecurringDataFromForm() {
  const enabled = document.getElementById('templateRecurringEnabled').checked;
  
  if (!enabled) {
    return {
      recurring_enabled: false,
      recurring_pattern: null,
      recurring_time: null,
      recurring_days: null
    };
  }
  
  const pattern = document.querySelector('input[name="recurringPattern"]:checked')?.value;
  const time = document.getElementById('templateRecurringTime').value;
  const days = pattern === 'weekly' 
    ? Array.from(document.querySelectorAll('input[name="recurringDays"]:checked')).map(cb => cb.value)
    : null;
  
  return {
    recurring_enabled: true,
    recurring_pattern: pattern,
    recurring_time: time,
    recurring_days: days
  };
}

// Validate recurring configuration
function validateRecurringConfig() {
  const enabled = document.getElementById('templateRecurringEnabled').checked;
  
  if (!enabled) return true;
  
  const pattern = document.querySelector('input[name="recurringPattern"]:checked')?.value;
  const time = document.getElementById('templateRecurringTime').value;
  
  if (!pattern) {
    showToast('Please select a recurring pattern', 'error');
    return false;
  }
  
  if (!time) {
    showToast('Please set a recurring time', 'error');
    return false;
  }
  
  if (pattern === 'weekly') {
    const days = document.querySelectorAll('input[name="recurringDays"]:checked');
    if (days.length === 0) {
      document.getElementById('recurringDaysError').classList.remove('hidden');
      showToast('Please select at least one day for weekly schedule', 'error');
      return false;
    }
    document.getElementById('recurringDaysError').classList.add('hidden');
  }
  
  return true;
}

// Populate recurring fields in form (for editing)
function populateRecurringFields(template) {
  const enabledCheckbox = document.getElementById('templateRecurringEnabled');
  
  if (template.recurring_enabled) {
    enabledCheckbox.checked = true;
    toggleRecurringFields();
    
    // Set pattern
    const patternRadio = document.querySelector(`input[name="recurringPattern"][value="${template.recurring_pattern}"]`);
    if (patternRadio) {
      patternRadio.checked = true;
      toggleDaysSelection();
    }
    
    // Set time
    if (template.recurring_time) {
      document.getElementById('templateRecurringTime').value = template.recurring_time;
    }
    
    // Set days for weekly
    if (template.recurring_pattern === 'weekly' && template.recurring_days) {
      const days = Array.isArray(template.recurring_days) ? template.recurring_days : [];
      days.forEach(day => {
        const checkbox = document.querySelector(`input[name="recurringDays"][value="${day}"]`);
        if (checkbox) checkbox.checked = true;
      });
    }
  } else {
    enabledCheckbox.checked = false;
    toggleRecurringFields();
  }
}

// Reset recurring fields
function resetRecurringFields() {
  document.getElementById('templateRecurringEnabled').checked = false;
  document.getElementById('recurringFieldsContainer').classList.add('hidden');
  document.getElementById('recurringDaysContainer').classList.add('hidden');
  document.getElementById('templateRecurringTime').value = '';
  document.querySelectorAll('input[name="recurringPattern"]').forEach(r => r.checked = false);
  document.querySelectorAll('input[name="recurringDays"]').forEach(cb => cb.checked = false);
  document.getElementById('recurringDaysError').classList.add('hidden');
}

// Run template schedule now (manual trigger)
async function runTemplateNow(templateId, templateName) {
  if (!confirm(`Run schedule for "${templateName}" now?\n\nThis will create broadcast(s) immediately.`)) {
    return;
  }
  
  try {
    showToast('Running schedule...', 'info');
    
    const response = await fetch(`/api/youtube/templates/${templateId}/run-now`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('Broadcast(s) created successfully!');
      setTimeout(() => window.location.reload(), 1500);
    } else {
      showToast(data.error || 'Failed to run schedule', 'error');
    }
  } catch (error) {
    console.error('Error running template:', error);
    showToast('Failed to run schedule: ' + error.message, 'error');
  }
}

// Toggle recurring for a template (quick toggle from list)
async function toggleTemplateRecurring(templateId, currentEnabled) {
  try {
    const response = await fetch(`/api/youtube/templates/${templateId}/recurring/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken()
      },
      body: JSON.stringify({ enabled: !currentEnabled })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast(data.recurring_enabled ? 'Recurring enabled' : 'Recurring disabled');
      loadTemplates(); // Refresh list
    } else {
      showToast(data.error || 'Failed to toggle recurring', 'error');
    }
  } catch (error) {
    console.error('Error toggling recurring:', error);
    showToast('Failed to toggle recurring', 'error');
  }
}

// Format next run time for display
function formatNextRun(nextRunAt) {
  if (!nextRunAt) return 'Not scheduled';
  
  const date = new Date(nextRunAt);
  const now = new Date();
  const diffMs = date - now;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMs < 0) return 'Overdue';
  if (diffHours < 24) {
    return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (diffDays === 1) {
    return `Tomorrow at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + 
         ` at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

// Format recurring pattern for display
function formatRecurringPattern(pattern, days, time) {
  if (pattern === 'daily') {
    return `Daily at ${time}`;
  }
  if (pattern === 'weekly' && days && days.length > 0) {
    const dayNames = {
      monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
      friday: 'Fri', saturday: 'Sat', sunday: 'Sun'
    };
    const dayList = days.map(d => dayNames[d] || d).join(', ');
    return `Weekly (${dayList}) at ${time}`;
  }
  return 'Unknown pattern';
}

// ============================================
// Template Export/Import Functions
// ============================================

// Store parsed import data
let importBackupData = null;

/**
 * Export templates to JSON file
 */
async function exportTemplates() {
  try {
    showToast('Exporting templates...', 'info');
    
    // Trigger download via API
    const response = await fetch('/api/youtube/templates/export', {
      method: 'GET',
      credentials: 'same-origin'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Export failed');
    }
    
    // Get filename from Content-Disposition header or generate one
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'templates-backup.json';
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+)"/);
      if (match) filename = match[1];
    }
    
    // Create blob and download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    showToast('Templates exported successfully', 'success');
  } catch (error) {
    console.error('Error exporting templates:', error);
    showToast(error.message || 'Failed to export templates', 'error');
  }
}

/**
 * Open import template modal
 */
function openImportTemplateModal() {
  // Reset state
  importBackupData = null;
  document.getElementById('importTemplateFile').value = '';
  document.getElementById('importFileName').classList.add('hidden');
  document.getElementById('importPreview').classList.add('hidden');
  document.getElementById('importError').classList.add('hidden');
  document.getElementById('importOptions').classList.add('hidden');
  document.getElementById('confirmImportBtn').disabled = true;
  document.getElementById('skipDuplicates').checked = true;
  
  document.getElementById('importTemplateModal').classList.remove('hidden');
}

/**
 * Close import template modal
 */
function closeImportTemplateModal() {
  document.getElementById('importTemplateModal').classList.add('hidden');
  importBackupData = null;
}

/**
 * Preview import file and validate
 */
function previewImportFile(input) {
  const file = input.files[0];
  if (!file) return;
  
  // Show filename
  document.getElementById('importFileName').textContent = file.name;
  document.getElementById('importFileName').classList.remove('hidden');
  
  // Hide previous states
  document.getElementById('importPreview').classList.add('hidden');
  document.getElementById('importError').classList.add('hidden');
  document.getElementById('importOptions').classList.add('hidden');
  document.getElementById('confirmImportBtn').disabled = true;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      
      // Validate format
      if (!data.metadata || !Array.isArray(data.templates)) {
        showImportError('Invalid backup format: missing metadata or templates array');
        return;
      }
      
      // Store data for import
      importBackupData = data;
      
      // Show preview
      document.getElementById('importTemplateCount').textContent = data.templates.length;
      document.getElementById('importExportDate').textContent = data.metadata.exportDate 
        ? new Date(data.metadata.exportDate).toLocaleString() 
        : 'Unknown';
      
      document.getElementById('importPreview').classList.remove('hidden');
      document.getElementById('importOptions').classList.remove('hidden');
      document.getElementById('confirmImportBtn').disabled = false;
      
    } catch (parseError) {
      showImportError('Invalid JSON file: ' + parseError.message);
    }
  };
  
  reader.onerror = function() {
    showImportError('Failed to read file');
  };
  
  reader.readAsText(file);
}

/**
 * Show import error message
 */
function showImportError(message) {
  document.getElementById('importErrorMessage').textContent = message;
  document.getElementById('importError').classList.remove('hidden');
  document.getElementById('confirmImportBtn').disabled = true;
  importBackupData = null;
}

/**
 * Confirm and execute import
 */
async function confirmImportTemplates() {
  if (!importBackupData) {
    showToast('No valid file selected', 'error');
    return;
  }
  
  const confirmBtn = document.getElementById('confirmImportBtn');
  const originalText = confirmBtn.innerHTML;
  
  try {
    // Show loading state
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="ti ti-loader animate-spin"></i> Importing...';
    
    const skipDuplicates = document.getElementById('skipDuplicates').checked;
    
    // Create form data
    const formData = new FormData();
    const blob = new Blob([JSON.stringify(importBackupData)], { type: 'application/json' });
    formData.append('file', blob, 'import.json');
    formData.append('skipDuplicates', skipDuplicates);
    
    const response = await fetch('/api/youtube/templates/import', {
      method: 'POST',
      credentials: 'same-origin',
      body: formData
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Import failed');
    }
    
    // Close import modal
    closeImportTemplateModal();
    
    // Show results
    showImportResults(result.results);
    
    // Refresh template list
    loadTemplates();
    
  } catch (error) {
    console.error('Error importing templates:', error);
    showToast(error.message || 'Failed to import templates', 'error');
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = originalText;
  }
}

/**
 * Show import results modal
 */
function showImportResults(results) {
  document.getElementById('importedCount').textContent = results.imported || 0;
  document.getElementById('skippedCount').textContent = results.skipped || 0;
  
  const errorsList = document.getElementById('importErrorsList');
  const errorsContent = document.getElementById('importErrorsContent');
  
  if (results.errors && results.errors.length > 0) {
    errorsContent.innerHTML = results.errors.map(err => 
      `<p class="text-yellow-400">${escapeHtml(err)}</p>`
    ).join('');
    errorsList.classList.remove('hidden');
  } else {
    errorsList.classList.add('hidden');
  }
  
  document.getElementById('importResultModal').classList.remove('hidden');
  
  // Show toast based on results
  if (results.imported > 0) {
    showToast(`Successfully imported ${results.imported} template(s)`, 'success');
  } else if (results.skipped > 0) {
    showToast('No templates imported (all skipped)', 'warning');
  }
}

/**
 * Close import result modal
 */
function closeImportResultModal() {
  document.getElementById('importResultModal').classList.add('hidden');
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// Thumbnail Upload for Edit Broadcast
// ============================================

// Global variable to store selected thumbnail file for edit modal
// This MUST be declared at global scope so it persists across function calls
window.editThumbnailFile = null;

/**
 * Preview thumbnail before upload in edit modal
 * Called when user selects a file via the file input
 */
function previewEditThumbnail(input) {
  console.log('[previewEditThumbnail] Called, input:', input);
  console.log('[previewEditThumbnail] Files:', input.files);
  
  const file = input.files[0];
  if (!file) {
    console.log('[previewEditThumbnail] No file selected');
    return;
  }
  
  console.log('[previewEditThumbnail] File selected:', file.name, file.type, file.size);
  
  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  if (!allowedTypes.includes(file.type)) {
    showToast('Only JPG and PNG files are allowed', 'error');
    input.value = '';
    return;
  }
  
  // Validate file size (max 2MB)
  if (file.size > 2 * 1024 * 1024) {
    showToast('File too large. Maximum size is 2MB', 'error');
    input.value = '';
    return;
  }
  
  // Store file in global variable
  window.editThumbnailFile = file;
  console.log('[previewEditThumbnail] File stored in window.editThumbnailFile:', window.editThumbnailFile.name);
  
  // Show preview
  const reader = new FileReader();
  reader.onload = function(e) {
    const preview = document.getElementById('editThumbnailPreview');
    if (preview) {
      preview.innerHTML = `<img src="${e.target.result}" class="w-full h-full object-cover">`;
      console.log('[previewEditThumbnail] Preview updated');
    }
  };
  reader.readAsDataURL(file);
  
  showToast('Thumbnail selected. Click "Update Broadcast" to save.', 'info');
}

/**
 * Upload thumbnail for broadcast to YouTube AND save to local gallery
 * @param {string} broadcastId - The broadcast/video ID
 * @param {string} accountId - The YouTube account ID
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
async function uploadEditThumbnail(broadcastId, accountId) {
  console.log('[uploadEditThumbnail] Called with broadcastId:', broadcastId, 'accountId:', accountId);
  console.log('[uploadEditThumbnail] window.editThumbnailFile:', window.editThumbnailFile);
  
  if (!window.editThumbnailFile) {
    console.log('[uploadEditThumbnail] No file to upload, returning true');
    return true; // No file to upload
  }
  
  try {
    console.log('[uploadEditThumbnail] Creating FormData...');
    const formData = new FormData();
    formData.append('thumbnail', window.editThumbnailFile);
    formData.append('accountId', accountId);
    
    console.log('[uploadEditThumbnail] Sending request to /api/youtube/broadcasts/' + broadcastId + '/thumbnail');
    
    const response = await fetch(`/api/youtube/broadcasts/${broadcastId}/thumbnail`, {
      method: 'POST',
      headers: {
        'X-CSRF-Token': getCsrfToken()
      },
      body: formData
    });
    
    console.log('[uploadEditThumbnail] Response status:', response.status);
    
    const data = await response.json();
    console.log('[uploadEditThumbnail] Response data:', data);
    
    if (!data.success) {
      console.error('[uploadEditThumbnail] Upload failed:', data.error);
      return false;
    }
    
    // Save to local gallery for history (only if not already from history)
    if (!window.editThumbnailFromHistory) {
      console.log('[uploadEditThumbnail] Saving to local gallery...');
      await saveToThumbnailHistory(window.editThumbnailFile);
    } else {
      console.log('[uploadEditThumbnail] Thumbnail from history, skipping gallery save');
    }
    
    console.log('[uploadEditThumbnail] Upload successful!');
    return true;
  } catch (error) {
    console.error('[uploadEditThumbnail] Error:', error);
    return false;
  }
}

/**
 * Save thumbnail to local gallery for history
 */
async function saveToThumbnailHistory(file) {
  try {
    const formData = new FormData();
    formData.append('thumbnail', file);
    
    const response = await fetch('/api/thumbnails', {
      method: 'POST',
      headers: {
        'X-CSRF-Token': getCsrfToken()
      },
      body: formData
    });
    
    const data = await response.json();
    if (data.success) {
      console.log('[saveToThumbnailHistory] Saved to gallery');
      // Refresh history
      loadEditThumbnailHistory();
    }
  } catch (error) {
    console.error('[saveToThumbnailHistory] Error:', error);
  }
}

// Current edit thumbnail folder state
let currentEditThumbnailFolder = null;

/**
 * Load thumbnail folders for edit modal dropdown
 * Returns the first folder name if available
 */
async function loadEditThumbnailFolders() {
  const select = document.getElementById('editThumbnailFolderSelect');
  if (!select) return null;
  
  try {
    const response = await fetch('/api/thumbnail-folders', {
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    
    // Clear dropdown - NO ROOT option
    select.innerHTML = '';
    
    if (data.success && data.folders && data.folders.length > 0) {
      // Add all folders
      data.folders.forEach(folder => {
        const option = document.createElement('option');
        option.value = folder.name;
        option.textContent = folder.name;
        select.appendChild(option);
      });
      
      // Return first folder name as default
      return data.folders[0].name;
    }
    
    return null;
  } catch (error) {
    console.error('[loadEditThumbnailFolders] Error:', error);
    return null;
  }
}

/**
 * Load thumbnails for edit modal from selected folder
 */
async function loadEditThumbnailFolder(folderName = null) {
  // Use the exact value passed - don't convert empty string to null
  // Empty string means root folder, null means no folder selected
  currentEditThumbnailFolder = folderName !== null && folderName !== undefined ? folderName : null;
  
  console.log('[loadEditThumbnailFolder] Setting currentEditThumbnailFolder to:', currentEditThumbnailFolder === '' ? '(root)' : currentEditThumbnailFolder);
  
  // Auto-bind folder to stream key (automatic binding)
  autoBindEditFolderToStreamKey(folderName);
  
  const gallery = document.getElementById('editThumbnailGallery');
  const loading = document.getElementById('editThumbnailGalleryLoading');
  const empty = document.getElementById('editThumbnailGalleryEmpty');
  const countEl = document.getElementById('editThumbnailCount');
  
  if (!gallery) return;
  
  gallery.innerHTML = '';
  if (loading) loading.classList.remove('hidden');
  if (empty) empty.classList.add('hidden');
  
  // Get stream key thumbnail index for "NEXT" indicator
  // First try editStreamKeySelect, then fallback to window.editBroadcastStreamId
  const streamKeySelect = document.getElementById('editStreamKeySelect');
  let streamKeyId = streamKeySelect ? streamKeySelect.value : null;
  if (!streamKeyId && window.editBroadcastStreamId) {
    streamKeyId = window.editBroadcastStreamId;
    console.log('[loadEditThumbnailFolder] Using stream ID from broadcast:', streamKeyId);
  }
  
  // Get GLOBAL thumbnail index for this folder (shared across all stream keys)
  let nextThumbnailIndex = 0;
  const globalIndexData = await getGlobalThumbnailIndexFromServer(folderName);
  nextThumbnailIndex = globalIndexData.thumbnailIndex || 0;
  console.log('[loadEditThumbnailFolder] GLOBAL thumbnail index for folder "' + (folderName || 'root') + '":', nextThumbnailIndex);
  
  // If no global index found, try to get from broadcast settings
  // This handles cases where stream_key_folder_mapping doesn't exist yet
  if (nextThumbnailIndex === 0 && window.editSavedThumbnailIndex !== undefined && window.editSavedThumbnailIndex !== null) {
    // NEXT should be after SAVED, so add 1 to saved index
    nextThumbnailIndex = window.editSavedThumbnailIndex + 1;
    console.log('[loadEditThumbnailFolder] Using saved thumbnail index + 1:', nextThumbnailIndex);
  }
  
  try {
    let url = '/api/thumbnails';
    if (folderName) {
      url += `?folder=${encodeURIComponent(folderName)}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    
    // Update count
    if (countEl) {
      countEl.textContent = `(${data.count || 0})`;
    }
    
    if (data.success && data.thumbnails && data.thumbnails.length > 0) {
      const pinnedPath = document.getElementById('editPinnedThumbnail')?.value || '';
      const totalThumbnails = data.thumbnails.length;
      
      // Calculate actual next index (wrap around if needed)
      const actualNextIndex = nextThumbnailIndex % totalThumbnails;
      
      // Get saved thumbnail info
      const savedIndex = window.editSavedThumbnailIndex || 0;
      const savedPath = window.editSavedThumbnailPath || null;
      
      data.thumbnails.forEach((thumb, index) => {
        const isPinned = pinnedPath && thumb.path === pinnedPath;
        // Check if this is the saved thumbnail (by path or by index)
        const isSaved = (savedPath && thumb.path === savedPath) || (!savedPath && index === savedIndex);
        // Check if this is the NEXT thumbnail to be used
        const isNext = !isPinned && index === actualNextIndex;
        
        const div = document.createElement('div');
        div.className = `edit-thumbnail-item aspect-video bg-dark-700 rounded cursor-pointer overflow-hidden border-2 ${isPinned ? 'border-green-500 ring-2 ring-green-500/50' : (isSaved ? 'border-primary ring-2 ring-primary/50' : (isNext ? 'border-yellow-500 ring-2 ring-yellow-500/50' : 'border-transparent'))} hover:border-primary transition-colors relative group`;
        div.dataset.path = thumb.path;
        div.dataset.url = thumb.url;
        div.dataset.index = index;
        div.innerHTML = `
          <img src="${thumb.url}" class="w-full h-full object-cover" alt="Thumbnail">
          <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
          <div class="absolute top-0.5 left-0.5 w-4 h-4 bg-dark-800/80 rounded-full flex items-center justify-center text-[9px] text-gray-300 font-medium">${index + 1}</div>
          ${isPinned ? '<div class="absolute top-0.5 left-5 px-1 py-0.5 bg-green-500/90 rounded text-[8px] text-white font-medium flex items-center gap-0.5"><i class="ti ti-pin-filled text-[7px]"></i>PIN</div>' : ''}
          ${isSaved && !isPinned ? '<div class="absolute top-0.5 left-5 px-1 py-0.5 bg-primary/90 rounded text-[8px] text-white font-medium">SAVED</div>' : ''}
          ${isNext && !isSaved && !isPinned ? '<div class="absolute top-0.5 left-5 px-1 py-0.5 bg-yellow-500/90 rounded text-[8px] text-white font-medium">NEXT</div>' : ''}
          <button type="button" onclick="event.stopPropagation(); pinEditThumbnail('${escapeJsString(thumb.path)}')" 
            class="absolute top-0.5 right-5 w-4 h-4 ${isPinned ? 'bg-green-500' : 'bg-yellow-500/90 hover:bg-yellow-500'} rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
            title="${isPinned ? 'Thumbnail di-pin' : 'Pin thumbnail ini'}">
            <i class="ti ti-pin${isPinned ? '-filled' : ''} text-white text-[8px]"></i>
          </button>
          <button type="button" onclick="event.stopPropagation(); deleteEditThumbnail('${escapeJsString(thumb.filename)}', '${escapeJsString(thumb.folder || '')}')" 
            class="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500/90 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
            title="Delete thumbnail">
            <i class="ti ti-x text-white text-[8px]"></i>
          </button>
        `;
        div.onclick = () => selectEditThumbnailFromGallery(thumb.url, thumb.path, div);
        gallery.appendChild(div);
      });
      
      if (empty) empty.classList.add('hidden');
    } else {
      if (empty) empty.classList.remove('hidden');
    }
  } catch (error) {
    console.error('[loadEditThumbnailFolder] Error:', error);
    if (empty) empty.classList.remove('hidden');
  } finally {
    if (loading) loading.classList.add('hidden');
  }
}

/**
 * Load thumbnails for edit modal and auto-select saved thumbnail
 * @param {string} folderName - Folder name (null for root)
 * @param {number} savedIndex - Saved thumbnail index (0-based)
 * @param {string} savedPath - Saved thumbnail path
 */
async function loadEditThumbnailFolderWithSelection(folderName = null, savedIndex = 0, savedPath = null) {
  // Use the exact value passed - don't convert empty string to null
  currentEditThumbnailFolder = folderName !== null && folderName !== undefined ? folderName : null;
  
  console.log('[loadEditThumbnailFolderWithSelection] Loading folder:', currentEditThumbnailFolder === '' ? '(root)' : currentEditThumbnailFolder, 'savedIndex:', savedIndex, 'savedPath:', savedPath);
  
  // Auto-bind folder to stream key (automatic binding)
  autoBindEditFolderToStreamKey(folderName);
  
  const gallery = document.getElementById('editThumbnailGallery');
  const loading = document.getElementById('editThumbnailGalleryLoading');
  const empty = document.getElementById('editThumbnailGalleryEmpty');
  const countEl = document.getElementById('editThumbnailCount');
  
  if (!gallery) return;
  
  gallery.innerHTML = '';
  if (loading) loading.classList.remove('hidden');
  if (empty) empty.classList.add('hidden');
  
  // Get stream key thumbnail index for "NEXT" indicator
  // First try editStreamKeySelect, then fallback to window.editBroadcastStreamId
  const streamKeySelect = document.getElementById('editStreamKeySelect');
  let streamKeyId = streamKeySelect ? streamKeySelect.value : null;
  if (!streamKeyId && window.editBroadcastStreamId) {
    streamKeyId = window.editBroadcastStreamId;
    console.log('[loadEditThumbnailFolderWithSelection] Using stream ID from broadcast:', streamKeyId);
  }
  
  // Get GLOBAL thumbnail index for this folder (shared across all stream keys)
  let nextThumbnailIndex = 0;
  const globalIndexData = await getGlobalThumbnailIndexFromServer(folderName);
  nextThumbnailIndex = globalIndexData.thumbnailIndex || 0;
  console.log('[loadEditThumbnailFolderWithSelection] GLOBAL thumbnail index for folder "' + (folderName || 'root') + '":', nextThumbnailIndex);
  
  // If no global index found, NEXT should be after SAVED
  // savedIndex is the index of the currently saved thumbnail (0-based)
  if (nextThumbnailIndex === 0 && savedIndex > 0) {
    // NEXT should be after SAVED, so add 1 to saved index
    nextThumbnailIndex = savedIndex + 1;
    console.log('[loadEditThumbnailFolderWithSelection] Using saved index + 1 for NEXT:', nextThumbnailIndex);
  }
  
  try {
    let url = '/api/thumbnails';
    if (folderName) {
      url += `?folder=${encodeURIComponent(folderName)}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    
    // Update count
    if (countEl) {
      countEl.textContent = `(${data.count || 0})`;
    }
    
    if (data.success && data.thumbnails && data.thumbnails.length > 0) {
      const pinnedPath = document.getElementById('editPinnedThumbnail')?.value || '';
      const totalThumbnails = data.thumbnails.length;
      
      // Calculate actual next index (wrap around if needed)
      const actualNextIndex = nextThumbnailIndex % totalThumbnails;
      
      // Find the saved thumbnail - first try by path, then by index
      let selectedElement = null;
      let selectedThumb = null;
      
      data.thumbnails.forEach((thumb, index) => {
        const isPinned = pinnedPath && thumb.path === pinnedPath;
        // Check if this is the saved thumbnail (by path or by index)
        const isSaved = (savedPath && thumb.path === savedPath) || (!savedPath && index === savedIndex);
        // Check if this is the NEXT thumbnail to be used
        const isNext = !isPinned && index === actualNextIndex;
        
        const div = document.createElement('div');
        div.className = `edit-thumbnail-item aspect-video bg-dark-700 rounded cursor-pointer overflow-hidden border-2 ${isPinned ? 'border-green-500 ring-2 ring-green-500/50' : (isSaved ? 'border-primary ring-2 ring-primary/50' : (isNext ? 'border-yellow-500 ring-2 ring-yellow-500/50' : 'border-transparent'))} hover:border-primary transition-colors relative group`;
        div.dataset.path = thumb.path;
        div.dataset.url = thumb.url;
        div.dataset.index = index;
        div.innerHTML = `
          <img src="${thumb.url}" class="w-full h-full object-cover" alt="Thumbnail">
          <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
          <div class="absolute top-0.5 left-0.5 w-4 h-4 bg-dark-800/80 rounded-full flex items-center justify-center text-[9px] text-gray-300 font-medium">${index + 1}</div>
          ${isPinned ? '<div class="absolute top-0.5 left-5 px-1 py-0.5 bg-green-500/90 rounded text-[8px] text-white font-medium flex items-center gap-0.5"><i class="ti ti-pin-filled text-[7px]"></i>PIN</div>' : ''}
          ${isSaved && !isPinned ? '<div class="absolute top-0.5 left-5 px-1 py-0.5 bg-primary/90 rounded text-[8px] text-white font-medium">SAVED</div>' : ''}
          ${isNext && !isSaved && !isPinned ? '<div class="absolute top-0.5 left-5 px-1 py-0.5 bg-yellow-500/90 rounded text-[8px] text-white font-medium">NEXT</div>' : ''}
          <button type="button" onclick="event.stopPropagation(); pinEditThumbnail('${escapeJsString(thumb.path)}')" 
            class="absolute top-0.5 right-5 w-4 h-4 ${isPinned ? 'bg-green-500' : 'bg-yellow-500/90 hover:bg-yellow-500'} rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
            title="${isPinned ? 'Thumbnail di-pin' : 'Pin thumbnail ini'}">
            <i class="ti ti-pin${isPinned ? '-filled' : ''} text-white text-[8px]"></i>
          </button>
          <button type="button" onclick="event.stopPropagation(); deleteEditThumbnail('${escapeJsString(thumb.filename)}', '${escapeJsString(thumb.folder || '')}')" 
            class="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500/90 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
            title="Delete thumbnail">
            <i class="ti ti-x text-white text-[8px]"></i>
          </button>
        `;
        div.onclick = () => selectEditThumbnailFromGalleryWithIndex(thumb.url, thumb.path, div, index);
        gallery.appendChild(div);
        
        // Track the saved thumbnail element
        if (isSaved && !selectedElement) {
          selectedElement = div;
          selectedThumb = thumb;
        }
      });
      
      // Auto-select the saved thumbnail and update preview
      if (selectedElement && selectedThumb) {
        console.log('[loadEditThumbnailFolderWithSelection] Auto-selecting saved thumbnail:', selectedThumb.path, 'index:', savedIndex);
        
        // Update preview with saved thumbnail
        const preview = document.getElementById('editThumbnailPreview');
        if (preview) {
          preview.innerHTML = `<img src="${selectedThumb.url}" class="w-full h-full object-cover">`;
        }
        
        // Store the selected thumbnail index
        window.editSelectedThumbnailIndex = savedIndex;
        window.editSelectedThumbnailPath = selectedThumb.path;
        
        // Scroll to the selected thumbnail
        selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      
      if (empty) empty.classList.add('hidden');
    } else {
      if (empty) empty.classList.remove('hidden');
    }
  } catch (error) {
    console.error('[loadEditThumbnailFolderWithSelection] Error:', error);
    if (empty) empty.classList.remove('hidden');
  } finally {
    if (loading) loading.classList.add('hidden');
  }
}

/**
 * Select thumbnail from gallery in edit modal and track index
 */
function selectEditThumbnailFromGalleryWithIndex(url, path, element, index) {
  // Store the selected thumbnail index and path
  window.editSelectedThumbnailIndex = index;
  window.editSelectedThumbnailPath = path;
  
  console.log('[selectEditThumbnailFromGalleryWithIndex] Selected thumbnail index:', index, 'path:', path);
  
  // Call the original function
  selectEditThumbnailFromGallery(url, path, element);
}

/**
 * Auto-bind folder to stream key for edit modal when folder is selected
 */
function autoBindEditFolderToStreamKey(folderName) {
  const streamKeySelect = document.getElementById('editStreamKeySelect');
  const mappingInput = document.getElementById('editStreamKeyFolderMapping');
  
  if (!streamKeySelect || !mappingInput || !streamKeySelect.value) return;
  
  // Create or update mapping
  let mapping = {};
  try {
    mapping = JSON.parse(mappingInput.value || '{}');
  } catch (e) {
    mapping = {};
  }
  
  // Map current stream key to current folder (empty string for root)
  mapping[streamKeySelect.value] = folderName || '';
  mappingInput.value = JSON.stringify(mapping);
  
  // Save to server database for persistence across sessions
  saveStreamKeyFolderMappingToServer(streamKeySelect.value, folderName || '');
}

/**
 * Select thumbnail from gallery in edit modal
 */
function selectEditThumbnailFromGallery(url, path, element) {
  // Check if pinned mode is active
  const pinnedMode = document.querySelector('input[name="editThumbnailMode"][value="pinned"]');
  const isPinnedMode = pinnedMode && pinnedMode.checked;
  
  // Get the index from element dataset
  const index = element ? parseInt(element.dataset.index || '0') : 0;
  
  // Store the selected thumbnail index and path
  window.editSelectedThumbnailIndex = index;
  window.editSelectedThumbnailPath = path;
  
  console.log('[selectEditThumbnailFromGallery] Selected thumbnail index:', index, 'path:', path);
  
  // Update preview
  const preview = document.getElementById('editThumbnailPreview');
  if (preview) {
    const indicator = document.getElementById('editPinnedThumbnailIndicator');
    preview.innerHTML = `<img src="${url}" class="w-full h-full object-cover">`;
    // Re-add indicator if it exists
    if (indicator) {
      preview.appendChild(indicator);
    }
  }
  
  // Highlight selected
  document.querySelectorAll('.edit-thumbnail-item').forEach(item => {
    item.classList.remove('border-primary', 'border-green-500', 'ring-2', 'ring-primary/50');
    item.classList.add('border-transparent');
  });
  if (element) {
    element.classList.remove('border-transparent');
    if (isPinnedMode) {
      element.classList.add('border-green-500', 'ring-2', 'ring-green-500/50');
      // Pin the thumbnail
      pinEditThumbnail(path);
    } else {
      element.classList.add('border-primary', 'ring-2', 'ring-primary/50');
    }
  }
  
  // Load the image as file for upload
  fetch(url)
    .then(res => res.blob())
    .then(blob => {
      const file = new File([blob], 'thumbnail.jpg', { type: blob.type });
      window.editThumbnailFile = file;
      window.editThumbnailFromHistory = true; // Mark as from gallery, no need to save again
      showToast('Thumbnail dipilih', 'info');
    })
    .catch(err => {
      console.error('Error loading thumbnail:', err);
      showToast('Gagal memuat thumbnail', 'error');
    });
}

/**
 * Update edit thumbnail mode (sequential/pinned)
 */
function updateEditThumbnailMode(mode) {
  const pinnedInput = document.getElementById('editPinnedThumbnail');
  const indicator = document.getElementById('editPinnedThumbnailIndicator');
  
  if (mode === 'sequential') {
    // Clear pinned thumbnail when switching to sequential
    if (pinnedInput && pinnedInput.value) {
      pinnedInput.value = '';
    }
    if (indicator) {
      indicator.classList.add('hidden');
    }
    loadEditThumbnailFolder(currentEditThumbnailFolder);
  } else if (mode === 'pinned') {
    // Pinned mode - user will select a specific thumbnail
  }
}

/**
 * Handle edit stream key change - auto-select bound folder if exists
 */
async function onEditStreamKeyChange(streamKeyId) {
  const mappingInput = document.getElementById('editStreamKeyFolderMapping');
  const folderSelect = document.getElementById('editThumbnailFolderSelect');
  
  if (!folderSelect) return;
  
  // First check form mapping
  let boundFolder = undefined;
  if (mappingInput) {
    try {
      const mapping = JSON.parse(mappingInput.value || '{}');
      if (mapping[streamKeyId] !== undefined) {
        boundFolder = mapping[streamKeyId];
      }
    } catch (e) {
      // Ignore parse error
    }
  }
  
  // If not found in form, check server database
  if (boundFolder === undefined) {
    boundFolder = await getStreamKeyFolderMappingFromServer(streamKeyId);
  }
  
  // If found, auto-select the bound folder and reload thumbnails with NEXT indicator
  if (boundFolder !== undefined) {
    console.log(`[onEditStreamKeyChange] Stream key ${streamKeyId} bound to folder: ${boundFolder || 'root'}`);
    folderSelect.value = boundFolder;
    // Pass the exact value - empty string for root, folder name for folder
    // Use loadEditThumbnailFolderWithSelection to show NEXT indicator
    const savedIndex = window.editSavedThumbnailIndex || 0;
    const savedPath = window.editSavedThumbnailPath || null;
    await loadEditThumbnailFolderWithSelection(boundFolder, savedIndex, savedPath);
    showToast(`Folder "${boundFolder || 'Root'}" otomatis dipilih`);
  } else {
    // No bound folder, but still reload to update NEXT indicator for new stream key
    const savedIndex = window.editSavedThumbnailIndex || 0;
    const savedPath = window.editSavedThumbnailPath || null;
    await loadEditThumbnailFolderWithSelection(currentEditThumbnailFolder, savedIndex, savedPath);
  }
}

/**
 * Pin thumbnail in edit modal
 */
function pinEditThumbnail(path) {
  const pinnedInput = document.getElementById('editPinnedThumbnail');
  const indicator = document.getElementById('editPinnedThumbnailIndicator');
  const modeRadio = document.querySelector('input[name="editThumbnailMode"][value="pinned"]');
  
  if (pinnedInput) {
    pinnedInput.value = path;
  }
  
  if (indicator) {
    indicator.classList.remove('hidden');
  }
  
  if (modeRadio) {
    modeRadio.checked = true;
  }
  
  // Refresh gallery to show pinned state with proper styling
  loadEditThumbnailFolder(currentEditThumbnailFolder);
  
  showToast('Thumbnail di-pin');
}

/**
 * Unpin thumbnail in edit modal
 */
function unpinEditThumbnail() {
  const pinnedInput = document.getElementById('editPinnedThumbnail');
  const indicator = document.getElementById('editPinnedThumbnailIndicator');
  const modeRadio = document.querySelector('input[name="editThumbnailMode"][value="sequential"]');
  
  if (pinnedInput) {
    pinnedInput.value = '';
  }
  
  if (indicator) {
    indicator.classList.add('hidden');
  }
  
  if (modeRadio) {
    modeRadio.checked = true;
  }
  
  // Update gallery to remove pinned state
  document.querySelectorAll('.edit-thumbnail-item').forEach(item => {
    item.classList.remove('border-green-500');
  });
  
  loadEditThumbnailFolder(currentEditThumbnailFolder);
  
  showToast('Pin thumbnail dihapus');
}

/**
 * Delete thumbnail from edit modal gallery
 */
async function deleteEditThumbnail(filename, folder) {
  if (!confirm(`Delete thumbnail "${filename}"?`)) {
    return;
  }
  
  try {
    let url = `/api/thumbnails/${encodeURIComponent(filename)}`;
    if (folder) {
      url += `?folder=${encodeURIComponent(folder)}`;
    }
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('Thumbnail deleted');
      // Refresh gallery
      loadEditThumbnailFolder(currentEditThumbnailFolder);
    } else {
      showToast(data.error || 'Failed to delete thumbnail', 'error');
    }
  } catch (error) {
    console.error('[deleteEditThumbnail] Error:', error);
    showToast('Failed to delete thumbnail', 'error');
  }
}

/**
 * Load thumbnail history for edit modal (max 10) - DEPRECATED, kept for backward compatibility
 */
async function loadEditThumbnailHistory() {
  // Now redirects to folder-based loading
  await loadEditThumbnailFolders();
  await loadEditThumbnailFolder(null); // Load root folder
}

// ============================================
// Title Manager Functions
// ============================================

let titleSuggestions = [];
let titleFolders = [];
let titleManagerContext = 'edit'; // 'edit' or 'create'
let selectedTitleFolderId = null;
let selectedFolderColor = '#8B5CF6';
let titleAutoRotationEnabled = false;
let titleRotationFolderId = null;

/**
 * Open Title Manager Modal
 */
async function openTitleManagerModal(context = 'edit') {
  titleManagerContext = context;
  document.getElementById('titleManagerModal').classList.remove('hidden');
  
  // Load folders first, then rotation settings (which depends on folders)
  await loadTitleFolders();
  loadTitleSuggestions();
  loadTitleRotationSettings();
}

/**
 * Close Title Manager Modal
 */
function closeTitleManagerModal() {
  document.getElementById('titleManagerModal').classList.add('hidden');
}

// ============================================
// Title Auto Rotation Functions
// ============================================

/**
 * Load title rotation settings from server
 */
async function loadTitleRotationSettings() {
  try {
    const response = await fetch('/api/title-rotation/settings', {
      headers: { 'X-CSRF-Token': getCsrfToken() }
    });
    const data = await response.json();
    
    if (data.success) {
      titleAutoRotationEnabled = data.enabled || false;
      titleRotationFolderId = data.folderId || null;
      window.currentTitleRotationIndex = data.currentIndex || 0;
      
      // Update UI
      const toggle = document.getElementById('titleAutoRotationEnabled');
      if (toggle) toggle.checked = titleAutoRotationEnabled;
      
      const folderSection = document.getElementById('titleRotationFolderSection');
      const statusSection = document.getElementById('titleRotationStatus');
      
      if (titleAutoRotationEnabled) {
        if (folderSection) folderSection.classList.remove('hidden');
        if (statusSection) statusSection.classList.remove('hidden');
        
        // Populate folder dropdown
        populateTitleRotationFolderDropdown();
        
        // Load next title preview
        loadNextRotationTitle();
      } else {
        if (folderSection) folderSection.classList.add('hidden');
        if (statusSection) statusSection.classList.add('hidden');
      }
      
      // Re-render title list to show current rotation position
      if (titleSuggestions.length > 0) {
        renderTitleManagerList();
      }
    }
  } catch (error) {
    console.error('Error loading title rotation settings:', error);
  }
}

/**
 * Toggle title auto rotation
 */
async function toggleTitleAutoRotation(enabled) {
  titleAutoRotationEnabled = enabled;
  
  const folderSection = document.getElementById('titleRotationFolderSection');
  const statusSection = document.getElementById('titleRotationStatus');
  
  if (enabled) {
    if (folderSection) folderSection.classList.remove('hidden');
    if (statusSection) statusSection.classList.remove('hidden');
    populateTitleRotationFolderDropdown();
    loadNextRotationTitle();
    
    // Auto-expand title list when rotation is enabled
    if (!titleListVisible) {
      toggleTitleList();
    }
  } else {
    if (folderSection) folderSection.classList.add('hidden');
    if (statusSection) statusSection.classList.add('hidden');
  }
  
  // Re-render title list to show/hide rotation indicator
  if (titleSuggestions.length > 0) {
    renderTitleManagerList();
  }
  
  // Save to server
  try {
    await fetch('/api/title-rotation/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken()
      },
      body: JSON.stringify({
        enabled: enabled,
        folderId: titleRotationFolderId
      })
    });
    
    showToast(enabled ? 'Auto rotation diaktifkan' : 'Auto rotation dinonaktifkan');
  } catch (error) {
    console.error('Error saving title rotation settings:', error);
    showToast('Gagal menyimpan pengaturan', 'error');
  }
}

/**
 * Populate title rotation folder dropdown
 */
function populateTitleRotationFolderDropdown() {
  const select = document.getElementById('titleRotationFolderSelect');
  if (!select) return;
  
  // Clear dropdown
  select.innerHTML = '';
  
  // Add folders only
  titleFolders.forEach(folder => {
    const option = document.createElement('option');
    option.value = folder.id;
    option.textContent = `📂 ${folder.name} (${folder.title_count || 0} judul)`;
    if (folder.id === titleRotationFolderId) {
      option.selected = true;
    }
    select.appendChild(option);
  });
  
  // Auto-select first folder if none selected
  if (!titleRotationFolderId && titleFolders.length > 0) {
    titleRotationFolderId = titleFolders[0].id;
    selectedTitleFolderId = titleFolders[0].id;
    select.value = titleRotationFolderId;
    
    // Save the auto-selected folder to server
    saveTitleRotationSettings();
  }
}

/**
 * Save title rotation settings to server
 */
async function saveTitleRotationSettings() {
  try {
    await fetch('/api/title-rotation/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken()
      },
      body: JSON.stringify({
        enabled: titleAutoRotationEnabled,
        folderId: titleRotationFolderId
      })
    });
  } catch (error) {
    console.error('Error saving title rotation settings:', error);
  }
}

/**
 * Handle title rotation folder change
 */
async function onTitleRotationFolderChange(folderId) {
  titleRotationFolderId = folderId || null;
  
  // Also set selectedTitleFolderId so new titles go to this folder
  selectedTitleFolderId = folderId || null;
  
  // Update folder list UI to show selected folder
  renderTitleFolderList();
  
  // Reload titles for this folder
  loadTitleSuggestions();
  
  // Save to server
  await saveTitleRotationSettings();
  
  // Reload next title preview
  loadNextRotationTitle();
}

/**
 * Load next rotation title preview
 */
async function loadNextRotationTitle() {
  try {
    let url = '/api/title-rotation/next';
    if (titleRotationFolderId) {
      url += `?folderId=${encodeURIComponent(titleRotationFolderId)}`;
    }
    
    const response = await fetch(url, {
      headers: { 'X-CSRF-Token': getCsrfToken() }
    });
    const data = await response.json();
    
    const titleEl = document.getElementById('nextRotationTitle');
    const positionEl = document.getElementById('rotationPosition');
    
    if (data.success && data.title) {
      if (titleEl) {
        if (data.isPinned) {
          titleEl.innerHTML = `<span class="text-green-400">📌 ${escapeHtml(data.title.title)}</span>`;
          titleEl.title = `Pinned: ${data.title.title}`;
        } else {
          titleEl.textContent = data.title.title;
          titleEl.title = data.title.title; // Full title on hover
        }
      }
      if (positionEl) {
        if (data.isPinned) {
          positionEl.innerHTML = '<span class="text-green-400">Pinned</span>';
        } else {
          positionEl.textContent = `${data.currentPosition}/${data.totalCount}`;
        }
      }
    } else {
      if (titleEl) titleEl.textContent = 'Tidak ada judul';
      if (positionEl) positionEl.textContent = '0/0';
    }
  } catch (error) {
    console.error('Error loading next rotation title:', error);
  }
}

// ============================================
// Title Folder Functions
// ============================================

/**
 * Load title folders
 */
async function loadTitleFolders() {
  try {
    const response = await fetch('/api/title-folders', {
      headers: { 'X-CSRF-Token': getCsrfToken() }
    });
    const data = await response.json();
    if (data.success) {
      titleFolders = data.folders || [];
      renderTitleFolderList();
      
      // Also update rotation folder dropdown if visible
      if (titleAutoRotationEnabled) {
        populateTitleRotationFolderDropdown();
      }
    }
  } catch (error) {
    console.error('Error loading folders:', error);
  }
}

/**
 * Render folder list
 */
function renderTitleFolderList() {
  const container = document.getElementById('titleFolderList');
  
  const folderItems = titleFolders.map(f => `
    <div class="flex items-center justify-between py-1">
      <div class="flex items-center gap-2 flex-1 min-w-0 cursor-pointer ${selectedTitleFolderId === f.id ? 'text-primary' : 'text-gray-300'}" onclick="selectTitleFolder('${escapeJsString(f.id)}')">
        <span style="color: ${f.color}">📁</span>
        <span class="text-sm truncate">${escapeHtml(f.name)}</span>
        <span class="text-xs text-gray-500">${f.title_count || 0}</span>
      </div>
      <div class="flex items-center">
        <button type="button" onclick="event.stopPropagation();openEditFolderModal('${escapeJsString(f.id)}','${escapeJsString(f.name)}','${f.color}')"
          class="px-1.5 py-0.5 text-xs text-yellow-400 hover:bg-yellow-500/20 rounded">✎</button>
        <button type="button" onclick="event.stopPropagation();deleteTitleFolder('${escapeJsString(f.id)}')"
          class="px-1.5 py-0.5 text-xs text-red-400 hover:bg-red-500/20 rounded">✕</button>
      </div>
    </div>
  `).join('');
  
  container.innerHTML = folderItems;
}

/**
 * Select folder filter
 */
function selectTitleFolder(folderId) {
  selectedTitleFolderId = folderId;
  
  // Also sync with rotation folder if auto rotation is enabled
  if (titleAutoRotationEnabled) {
    titleRotationFolderId = folderId;
    const rotationSelect = document.getElementById('titleRotationFolderSelect');
    if (rotationSelect) {
      rotationSelect.value = folderId || '';
    }
    saveTitleRotationSettings();
    loadNextRotationTitle();
  }
  
  renderTitleFolderList();
  loadTitleSuggestions();
}

/**
 * Open create title folder modal
 */
function openCreateTitleFolderModal() {
  console.log('[TITLE FOLDER] openCreateTitleFolderModal called');
  
  const modal = document.getElementById('titleFolderModal');
  if (!modal) {
    console.error('[TITLE FOLDER] Modal titleFolderModal not found!');
    showToast('Error: Modal tidak ditemukan', 'error');
    return;
  }
  
  const titleEl = document.getElementById('folderModalTitle');
  const idEl = document.getElementById('editFolderId');
  const nameEl = document.getElementById('folderNameInput');
  
  if (!titleEl || !idEl || !nameEl) {
    console.error('[TITLE FOLDER] Missing elements:', { titleEl: !!titleEl, idEl: !!idEl, nameEl: !!nameEl });
    showToast('Error: Element tidak ditemukan', 'error');
    return;
  }
  
  titleEl.textContent = 'Buat Folder Baru';
  idEl.value = '';
  nameEl.value = '';
  selectFolderColor('#8B5CF6');
  
  // Show modal using classList (consistent with other modals)
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  
  // Focus input after a short delay
  setTimeout(() => {
    nameEl.focus();
  }, 100);
  
  console.log('[TITLE FOLDER] Modal opened successfully');
}

/**
 * Open edit folder modal
 */
function openEditFolderModal(id, name, color) {
  console.log('[TITLE FOLDER] openEditFolderModal called:', { id, name, color });
  
  const modal = document.getElementById('titleFolderModal');
  if (!modal) {
    console.error('[TITLE FOLDER] Modal titleFolderModal not found!');
    showToast('Error: Modal tidak ditemukan', 'error');
    return;
  }
  
  document.getElementById('folderModalTitle').textContent = 'Edit Folder';
  document.getElementById('editFolderId').value = id;
  document.getElementById('folderNameInput').value = name;
  selectFolderColor(color);
  
  // Show modal using classList (consistent with other modals)
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  
  // Focus input after a short delay
  setTimeout(() => {
    document.getElementById('folderNameInput').focus();
  }, 100);
}

/**
 * Close folder modal
 */
function closeFolderModal() {
  const modal = document.getElementById('titleFolderModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

/**
 * Select folder color
 */
function selectFolderColor(color) {
  selectedFolderColor = color;
  document.querySelectorAll('.folder-color-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.color === color);
    btn.classList.toggle('ring-2', btn.dataset.color === color);
    btn.classList.toggle('ring-white', btn.dataset.color === color);
  });
}

/**
 * Save folder (create or update)
 */
async function saveFolder() {
  console.log('[TITLE FOLDER] saveFolder called');
  
  const id = document.getElementById('editFolderId').value;
  const name = document.getElementById('folderNameInput').value.trim();
  const csrfToken = getCsrfToken();
  
  console.log('[TITLE FOLDER] Saving folder:', { id, name, color: selectedFolderColor });
  console.log('[TITLE FOLDER] CSRF Token:', csrfToken ? 'present (' + csrfToken.substring(0, 10) + '...)' : 'MISSING');
  
  if (!name) {
    showToast('Masukkan nama folder', 'error');
    return;
  }
  
  if (!csrfToken) {
    showToast('Session expired. Please refresh the page.', 'error');
    return;
  }
  
  try {
    const url = id ? `/api/title-folders/${id}` : '/api/title-folders';
    const method = id ? 'PUT' : 'POST';
    
    console.log('[TITLE FOLDER] Sending request to:', url, 'method:', method);
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      body: JSON.stringify({ name, color: selectedFolderColor })
    });
    
    console.log('[TITLE FOLDER] Response status:', response.status);
    
    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('[TITLE FOLDER] Non-JSON response:', contentType);
      const text = await response.text();
      console.error('[TITLE FOLDER] Response text:', text.substring(0, 200));
      showToast('Server error. Please refresh the page and try again.', 'error');
      return;
    }
    
    const data = await response.json();
    console.log('[TITLE FOLDER] Response:', data);
    
    if (data.success) {
      showToast(id ? 'Folder diupdate' : 'Folder dibuat');
      closeFolderModal();
      loadTitleFolders();
    } else {
      showToast(data.error || 'Gagal menyimpan folder', 'error');
    }
  } catch (error) {
    console.error('[TITLE FOLDER] Error saving folder:', error);
    showToast('Gagal menyimpan folder', 'error');
  }
}

/**
 * Delete title folder
 */
async function deleteTitleFolder(id) {
  if (!confirm('Hapus folder ini? Judul di dalamnya tidak akan dihapus.')) return;
  
  try {
    const response = await fetch(`/api/title-folders/${id}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': getCsrfToken() }
    });
    
    const data = await response.json();
    if (data.success) {
      showToast('Folder dihapus');
      if (selectedTitleFolderId === id) {
        selectedTitleFolderId = null;
      }
      loadTitleFolders();
      loadTitleSuggestions();
    } else {
      showToast(data.error || 'Gagal menghapus folder', 'error');
    }
  } catch (error) {
    console.error('Error deleting folder:', error);
    showToast('Gagal menghapus folder', 'error');
  }
}

/**
 * Move title to folder
 */
async function moveTitleToFolder(titleId, folderId) {
  try {
    const response = await fetch(`/api/title-suggestions/${titleId}/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken()
      },
      body: JSON.stringify({ folderId })
    });
    
    const data = await response.json();
    if (data.success) {
      showToast('Judul dipindahkan');
      loadTitleFolders();
      loadTitleSuggestions();
    } else {
      showToast(data.error || 'Gagal memindahkan judul', 'error');
    }
  } catch (error) {
    console.error('Error moving title:', error);
    showToast('Gagal memindahkan judul', 'error');
  }
}

/**
 * Load title suggestions from API
 */
async function loadTitleSuggestions() {
  const listEl = document.getElementById('titleManagerList');
  listEl.innerHTML = '<div class="text-center py-3 text-gray-500 text-sm"><i class="ti ti-loader animate-spin"></i></div>';
  
  try {
    let url = '/api/title-suggestions';
    if (selectedTitleFolderId) {
      url += `?folderId=${encodeURIComponent(selectedTitleFolderId)}`;
    }
    
    const response = await fetch(url, {
      headers: { 'X-CSRF-Token': getCsrfToken() }
    });
    
    const data = await response.json();
    
    if (data.success) {
      titleSuggestions = data.titles || [];
      document.getElementById('titleCount').textContent = `(${titleSuggestions.length})`;
      renderTitleManagerList();
    } else {
      listEl.innerHTML = '<div class="text-center py-3 text-red-400 text-sm">Gagal memuat</div>';
    }
  } catch (error) {
    console.error('Error loading titles:', error);
    listEl.innerHTML = '<div class="text-center py-3 text-red-400 text-sm">Gagal memuat</div>';
  }
}

let titleListVisible = true;

/**
 * Toggle title list visibility
 */
function toggleTitleList() {
  titleListVisible = !titleListVisible;
  const listEl = document.getElementById('titleManagerList');
  const icon = document.getElementById('titleToggleIcon');
  
  if (titleListVisible) {
    listEl.classList.remove('hidden');
    icon.textContent = '▼';
  } else {
    listEl.classList.add('hidden');
    icon.textContent = '▶';
  }
}

/**
 * Render title manager list
 */
function renderTitleManagerList() {
  const listEl = document.getElementById('titleManagerList');
  
  if (titleSuggestions.length === 0) {
    listEl.innerHTML = `<div class="text-center py-3 text-gray-500 text-sm">Belum ada judul</div>`;
    return;
  }
  
  // Get current rotation index to highlight (wrap around if needed)
  const currentRotationIndex = (window.currentTitleRotationIndex || 0) % titleSuggestions.length;
  
  listEl.innerHTML = titleSuggestions.map((title, index) => {
    const isPinned = title.is_pinned === 1;
    const folder = titleFolders.find(f => f.id === title.folder_id);
    const isCurrentRotation = titleAutoRotationEnabled && index === currentRotationIndex && !isPinned;
    const isNextIndicator = titleAutoRotationEnabled && isCurrentRotation;
    
    return `
    <div class="flex items-center gap-2 py-1.5 border-b border-gray-700/30 last:border-0 ${isCurrentRotation ? 'bg-primary/10 rounded px-1 -mx-1' : ''}">
      <button type="button" onclick="setTitleRotationStart(${index})" 
        class="text-xs ${isCurrentRotation ? 'text-primary font-bold' : (isPinned ? 'text-green-400' : 'text-gray-600')} w-5 text-center hover:text-primary cursor-pointer" 
        title="${titleAutoRotationEnabled ? 'Klik untuk set sebagai posisi awal rotasi' : 'Aktifkan Auto Rotation untuk mengatur posisi'}">
        ${isPinned ? '📌' : index + 1}
      </button>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1">
          <button type="button" onclick="selectTitle('${escapeJsString(title.id)}', '${escapeJsString(title.title)}')"
            class="text-left text-sm ${isCurrentRotation ? 'text-primary font-medium' : 'text-gray-200'} hover:text-primary truncate">
            ${escapeHtml(title.title)}
          </button>
          ${isNextIndicator ? '<span class="px-1.5 py-0.5 bg-primary/20 text-primary text-[9px] rounded font-medium flex-shrink-0">NEXT</span>' : ''}
        </div>
        ${folder ? `<span class="text-xs" style="color: ${folder.color}">${escapeHtml(folder.name)}</span>` : ''}
      </div>
      <span class="text-xs text-gray-600">${title.use_count || 0}x</span>
      <button type="button" onclick="showTitleMoveMenu(event, '${escapeJsString(title.id)}')" class="px-1.5 py-0.5 text-xs text-blue-400 hover:bg-blue-500/20 rounded" title="Pindah ke folder">📁</button>
      <button type="button" onclick="toggleTitlePin('${escapeJsString(title.id)}', ${isPinned ? 'false' : 'true'})" class="px-1.5 py-0.5 text-xs ${isPinned ? 'text-green-400' : 'text-gray-500'} hover:bg-green-500/20 rounded" title="${isPinned ? 'Lepas pin' : 'Pin judul ini'}">${isPinned ? '📌' : '📍'}</button>
      <button type="button" onclick="deleteTitleSuggestion('${escapeJsString(title.id)}')" class="px-1.5 py-0.5 text-xs text-red-400 hover:bg-red-500/20 rounded" title="Hapus">✕</button>
    </div>
  `;
  }).join('');
}

/**
 * Set title rotation start position
 */
async function setTitleRotationStart(index) {
  try {
    // Save the new rotation index
    await fetch('/api/title-rotation/update-index', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken()
      },
      body: JSON.stringify({ newIndex: index })
    });
    
    // Update local state
    window.currentTitleRotationIndex = index;
    
    // Re-render list to show new position
    renderTitleManagerList();
    
    // Update rotation preview
    loadNextRotationTitle();
    
    showToast(`Rotasi dimulai dari posisi ${index + 1}`);
  } catch (error) {
    console.error('Error setting rotation start:', error);
    showToast('Gagal mengatur posisi awal', 'error');
  }
}

/**
 * Reset title rotation to position 1
 */
async function resetTitleRotation() {
  await setTitleRotationStart(0);
}

/**
 * Show move menu at cursor position
 */
function showTitleMoveMenu(event, titleId) {
  event.stopPropagation();
  
  // Remove existing menu
  const existingMenu = document.getElementById('titleMoveDropdown');
  if (existingMenu) existingMenu.remove();
  
  const title = titleSuggestions.find(t => t.id === titleId);
  
  const menu = document.createElement('div');
  menu.id = 'titleMoveDropdown';
  menu.className = 'fixed bg-dark-700 border border-gray-600 rounded-lg shadow-xl z-[100] py-1 min-w-[120px]';
  menu.style.left = `${event.clientX}px`;
  menu.style.top = `${event.clientY}px`;
  
  let menuHtml = `
    <button onclick="moveTitleToFolder('${titleId}', null);closeTitleDropdown()" 
      class="w-full text-left px-3 py-1.5 text-xs hover:bg-dark-600 ${!title?.folder_id ? 'text-primary' : 'text-gray-300'}">
      <i class="ti ti-list mr-1"></i> Tanpa Folder
    </button>
  `;
  
  titleFolders.forEach(f => {
    menuHtml += `
      <button onclick="moveTitleToFolder('${titleId}', '${f.id}');closeTitleDropdown()" 
        class="w-full text-left px-3 py-1.5 text-xs hover:bg-dark-600 ${title?.folder_id === f.id ? 'text-primary' : 'text-gray-300'}">
        <i class="ti ti-folder mr-1" style="color: ${f.color}"></i> ${escapeHtml(f.name)}
      </button>
    `;
  });
  
  menu.innerHTML = menuHtml;
  document.body.appendChild(menu);
  
  // Close on click outside
  setTimeout(() => {
    document.addEventListener('click', closeTitleDropdown, { once: true });
  }, 10);
}

function closeTitleDropdown() {
  const menu = document.getElementById('titleMoveDropdown');
  if (menu) menu.remove();
}

/**
 * Add new title suggestion
 */
async function addNewTitle() {
  console.log('[ADD TITLE] addNewTitle called');
  
  const input = document.getElementById('newTitleInput');
  if (!input) {
    console.error('[ADD TITLE] Input element not found!');
    showToast('Error: Input tidak ditemukan', 'error');
    return;
  }
  
  const title = input.value.trim();
  const csrfToken = getCsrfToken();
  
  // Use selected folder from folder list, or rotation folder if auto rotation is enabled
  let targetFolderId = selectedTitleFolderId;
  if (!targetFolderId && titleAutoRotationEnabled && titleRotationFolderId) {
    targetFolderId = titleRotationFolderId;
  }
  
  console.log('[ADD TITLE] Title value:', title);
  console.log('[ADD TITLE] Selected folder ID:', selectedTitleFolderId);
  console.log('[ADD TITLE] Target folder ID:', targetFolderId);
  console.log('[ADD TITLE] CSRF Token:', csrfToken ? 'present (' + csrfToken.substring(0, 10) + '...)' : 'MISSING');
  
  if (!title) {
    showToast('Masukkan judul', 'error');
    return;
  }
  
  if (!csrfToken) {
    showToast('Session expired. Please refresh the page.', 'error');
    return;
  }
  
  try {
    console.log('[ADD TITLE] Sending request to /api/title-suggestions');
    const response = await fetch('/api/title-suggestions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      body: JSON.stringify({ 
        title,
        folderId: targetFolderId || null
      })
    });
    
    console.log('[ADD TITLE] Response status:', response.status);
    
    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('[ADD TITLE] Non-JSON response:', contentType);
      const text = await response.text();
      console.error('[ADD TITLE] Response text:', text.substring(0, 200));
      showToast('Server error. Please refresh the page and try again.', 'error');
      return;
    }
    
    const data = await response.json();
    console.log('[ADD TITLE] Response:', data);
    
    if (data.success) {
      input.value = '';
      showToast('Judul ditambahkan');
      loadTitleFolders();
      loadTitleSuggestions();
    } else {
      showToast(data.error || 'Gagal menambahkan judul', 'error');
    }
  } catch (error) {
    console.error('[ADD TITLE] Error adding title:', error);
    showToast('Gagal menambahkan judul', 'error');
  }
}

/**
 * Toggle pin status for a title
 */
async function toggleTitlePin(id, shouldPin) {
  try {
    const response = await fetch(`/api/title-suggestions/${id}/pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken()
      },
      body: JSON.stringify({ isPinned: shouldPin })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast(shouldPin ? 'Judul di-pin' : 'Pin dilepas');
      loadTitleSuggestions();
    } else {
      showToast(data.error || 'Gagal mengubah status pin', 'error');
    }
  } catch (error) {
    console.error('Error toggling pin:', error);
    showToast('Gagal mengubah status pin', 'error');
  }
}

/**
 * Select title from manager
 */
async function selectTitle(id, title) {
  // Set title in the appropriate input
  const inputId = titleManagerContext === 'edit' ? 'editBroadcastTitle' : 'broadcastTitle';
  const input = document.getElementById(inputId);
  if (input) {
    input.value = title;
  }
  
  // Increment use count
  try {
    await fetch(`/api/title-suggestions/${id}/use`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': getCsrfToken() }
    });
  } catch (error) {
    console.error('Error incrementing use count:', error);
  }
  
  // If auto rotation is enabled, move NEXT indicator to the next title
  if (titleAutoRotationEnabled) {
    // Find the index of the selected title
    const selectedIndex = titleSuggestions.findIndex(t => t.id === id);
    
    if (selectedIndex !== -1) {
      // Calculate next index (wrap around to 0 if at end)
      const nextIndex = (selectedIndex + 1) % titleSuggestions.length;
      
      // Update rotation index to next position
      try {
        await fetch('/api/title-rotation/update-index', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': getCsrfToken()
          },
          body: JSON.stringify({ newIndex: nextIndex })
        });
        
        // Update local state
        window.currentTitleRotationIndex = nextIndex;
        
        // Update rotation preview
        loadNextRotationTitle();
      } catch (error) {
        console.error('Error updating rotation index:', error);
      }
    }
  }
  
  closeTitleManagerModal();
  showToast('Judul dipilih');
}

/**
 * Delete title suggestion
 */
async function deleteTitleSuggestion(id) {
  if (!confirm('Hapus judul ini?')) return;
  
  try {
    const response = await fetch(`/api/title-suggestions/${id}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': getCsrfToken() }
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('Judul dihapus');
      loadTitleSuggestions();
    } else {
      showToast(data.error || 'Gagal menghapus judul', 'error');
    }
  } catch (error) {
    console.error('Error deleting title:', error);
    showToast('Gagal menghapus judul', 'error');
  }
}

/**
 * Search title suggestions (for autocomplete)
 */
let titleSearchTimeout = null;

async function searchTitleSuggestions(keyword, context = 'edit') {
  clearTimeout(titleSearchTimeout);
  
  const dropdownId = context === 'edit' ? 'editTitleSuggestions' : 'titleSuggestions';
  const dropdown = document.getElementById(dropdownId);
  
  if (!keyword || keyword.length < 2) {
    dropdown.classList.add('hidden');
    return;
  }
  
  titleSearchTimeout = setTimeout(async () => {
    try {
      const response = await fetch(`/api/title-suggestions/search?q=${encodeURIComponent(keyword)}`, {
        headers: { 'X-CSRF-Token': getCsrfToken() }
      });
      
      const data = await response.json();
      
      if (data.success && data.titles.length > 0) {
        dropdown.innerHTML = data.titles.map(t => `
          <button type="button" onclick="selectTitleFromDropdown('${escapeHtml(t.id)}', '${escapeHtml(t.title.replace(/'/g, "\\'"))}', '${context}')"
            class="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-600 transition-colors truncate">
            ${escapeHtml(t.title)}
          </button>
        `).join('');
        dropdown.classList.remove('hidden');
      } else {
        dropdown.classList.add('hidden');
      }
    } catch (error) {
      console.error('Error searching titles:', error);
    }
  }, 300);
}

/**
 * Show title suggestions dropdown
 */
function showTitleSuggestions(context = 'edit') {
  // Load popular titles when focusing
  loadPopularTitles(context);
}

/**
 * Load popular titles for dropdown
 */
async function loadPopularTitles(context = 'edit') {
  const dropdownId = context === 'edit' ? 'editTitleSuggestions' : 'titleSuggestions';
  const dropdown = document.getElementById(dropdownId);
  
  try {
    const response = await fetch('/api/title-suggestions/popular?limit=5', {
      headers: { 'X-CSRF-Token': getCsrfToken() }
    });
    
    const data = await response.json();
    
    if (data.success && data.titles.length > 0) {
      dropdown.innerHTML = `
        <div class="px-3 py-1 text-xs text-gray-500 border-b border-gray-600">Popular Titles</div>
        ${data.titles.map(t => `
          <button type="button" onclick="selectTitleFromDropdown('${escapeHtml(t.id)}', '${escapeHtml(t.title.replace(/'/g, "\\'"))}', '${context}')"
            class="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-600 transition-colors truncate">
            ${escapeHtml(t.title)}
          </button>
        `).join('')}
      `;
      dropdown.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Error loading popular titles:', error);
  }
}

/**
 * Toggle title dropdown
 */
function toggleTitleDropdown(context = 'edit') {
  const dropdownId = context === 'edit' ? 'editTitleSuggestions' : 'titleSuggestions';
  const dropdown = document.getElementById(dropdownId);
  
  if (dropdown.classList.contains('hidden')) {
    loadPopularTitles(context);
  } else {
    dropdown.classList.add('hidden');
  }
}

/**
 * Select title from dropdown
 */
async function selectTitleFromDropdown(id, title, context = 'edit') {
  const inputId = context === 'edit' ? 'editBroadcastTitle' : 'broadcastTitle';
  const dropdownId = context === 'edit' ? 'editTitleSuggestions' : 'titleSuggestions';
  
  document.getElementById(inputId).value = title;
  document.getElementById(dropdownId).classList.add('hidden');
  
  // Increment use count
  try {
    await fetch(`/api/title-suggestions/${id}/use`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': getCsrfToken() }
    });
  } catch (error) {
    console.error('Error incrementing use count:', error);
  }
  
  // If auto rotation is enabled, move NEXT indicator to the next title
  if (titleAutoRotationEnabled) {
    // Find the index of the selected title
    const selectedIndex = titleSuggestions.findIndex(t => t.id === id);
    
    if (selectedIndex !== -1) {
      // Calculate next index (wrap around to 0 if at end)
      const nextIndex = (selectedIndex + 1) % titleSuggestions.length;
      
      // Update rotation index to next position
      try {
        await fetch('/api/title-rotation/update-index', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': getCsrfToken()
          },
          body: JSON.stringify({ newIndex: nextIndex })
        });
        
        // Update local state
        window.currentTitleRotationIndex = nextIndex;
        
        // Update rotation preview
        loadNextRotationTitle();
      } catch (error) {
        console.error('Error updating rotation index:', error);
      }
    }
  }
}

// Hide title dropdown when clicking outside
document.addEventListener('click', function(e) {
  const editDropdown = document.getElementById('editTitleSuggestions');
  const createDropdown = document.getElementById('titleSuggestions');
  
  if (editDropdown && !e.target.closest('#editBroadcastTitle') && !e.target.closest('#editTitleSuggestions')) {
    editDropdown.classList.add('hidden');
  }
  if (createDropdown && !e.target.closest('#broadcastTitle') && !e.target.closest('#titleSuggestions')) {
    createDropdown.classList.add('hidden');
  }
});

// Update Edit Broadcast Form Handler to include thumbnail upload and category
const originalEditBroadcastForm = document.getElementById('editBroadcastForm');
if (originalEditBroadcastForm) {
  // Remove existing listeners by replacing with clone, then add new listener
  const newForm = originalEditBroadcastForm.cloneNode(true);
  originalEditBroadcastForm.parentNode.replaceChild(newForm, originalEditBroadcastForm);
  
  newForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const updateBtn = document.getElementById('updateBroadcastBtn');
    if (!updateBtn) return;
    
    const originalText = updateBtn.innerHTML;
    updateBtn.innerHTML = '<i class="ti ti-loader animate-spin"></i> Updating...';
    updateBtn.disabled = true;
    
    try {
      const broadcastId = document.getElementById('editBroadcastId').value;
      const accountId = document.getElementById('editAccountId').value;
      
      // Get thumbnail folder from dropdown
      const folderSelect = document.getElementById('editThumbnailFolderSelect');
      const thumbnailFolder = folderSelect ? folderSelect.value : null;
      
      console.log('[EditBroadcast] Starting update for broadcast:', broadcastId, 'account:', accountId);
      console.log('[EditBroadcast] Thumbnail folder:', thumbnailFolder);
      console.log('[EditBroadcast] Thumbnail file:', window.editThumbnailFile ? window.editThumbnailFile.name : 'none');
      
      // Upload thumbnail first if selected
      if (window.editThumbnailFile) {
        console.log('[EditBroadcast] Uploading thumbnail...');
        const thumbnailSuccess = await uploadEditThumbnail(broadcastId, accountId);
        if (!thumbnailSuccess) {
          showToast('Thumbnail upload failed', 'error');
        } else {
          showToast('Thumbnail uploaded successfully!', 'success');
        }
      } else {
        console.log('[EditBroadcast] No thumbnail to upload');
      }
      
      // Get category value
      const categorySelect = document.getElementById('editCategoryId');
      const categoryId = categorySelect ? categorySelect.value : '22';
      
      // Get stream key value - first try select, then fallback to stored broadcast stream ID
      const streamKeySelect = document.getElementById('editStreamKeySelect');
      let streamId = streamKeySelect ? streamKeySelect.value : null;
      if (!streamId && window.editBroadcastStreamId) {
        streamId = window.editBroadcastStreamId;
        console.log('[EditBroadcast] Using stream ID from broadcast:', streamId);
      }
      
      console.log('[EditBroadcast] Category:', categoryId);
      console.log('[EditBroadcast] Stream ID:', streamId);
      
      const updateData = {
        title: document.getElementById('editBroadcastTitle').value,
        description: document.getElementById('editBroadcastDescription').value,
        scheduledStartTime: document.getElementById('editScheduledStartTime').value,
        privacyStatus: document.getElementById('editPrivacyStatus').value,
        categoryId: categoryId,
        thumbnailFolder: thumbnailFolder  // Include thumbnail folder in update
      };
      
      console.log('[EditBroadcast] Update data:', updateData);
      
      let url = `/api/youtube/broadcasts/${broadcastId}`;
      if (accountId) {
        url += `?accountId=${accountId}`;
      }
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrfToken()
        },
        body: JSON.stringify(updateData)
      });
      
      const data = await response.json();
      console.log('[EditBroadcast] Response:', data);
      
      // Also save stream key folder mapping if stream key is selected
      if (streamId && thumbnailFolder !== null) {
        console.log('[EditBroadcast] Saving stream key folder mapping:', streamId, '->', thumbnailFolder);
        await saveStreamKeyFolderMappingToServer(streamId, thumbnailFolder || '');
      }
      
      if (data.success) {
        // NOTE: Don't increment thumbnail index on edit/reschedule
        // Thumbnail index should only increment when creating NEW broadcasts
        // The same broadcast keeps the same thumbnail
        console.log('[EditBroadcast] Broadcast updated successfully');
        
        showToast('Broadcast updated successfully!');
        closeEditBroadcastModal();
        setTimeout(() => window.location.reload(), 1500);
      } else {
        showToast(data.error || 'Failed to update broadcast', 'error');
      }
    } catch (error) {
      console.error('[EditBroadcast] Error:', error);
      showToast('An error occurred: ' + error.message, 'error');
    } finally {
      updateBtn.innerHTML = originalText;
      updateBtn.disabled = false;
      window.editThumbnailFile = null;
    }
  });
}

// Override closeEditBroadcastModal to reset thumbnail
const originalCloseEditBroadcastModal = window.closeEditBroadcastModal;
window.closeEditBroadcastModal = function() {
  document.getElementById('editBroadcastModal').classList.add('hidden');
  document.getElementById('editBroadcastForm').reset();
  
  // Reset thumbnail preview
  const preview = document.getElementById('editThumbnailPreview');
  if (preview) {
    preview.innerHTML = '<i class="ti ti-photo text-gray-500 text-2xl"></i>';
  }
  window.editThumbnailFile = null;
  
  // Reset selected thumbnail index and path
  window.editSelectedThumbnailIndex = 0;
  window.editSelectedThumbnailPath = null;
  window.editSavedThumbnailIndex = 0;
  window.editSavedThumbnailPath = null;
  
  // Reset stream ID from broadcast
  window.editBroadcastStreamId = null;
  
  // Reset file input
  const fileInput = document.getElementById('editThumbnailFile');
  if (fileInput) fileInput.value = '';
  
  // Reset category to default
  const categorySelect = document.getElementById('editCategoryId');
  if (categorySelect) categorySelect.value = '22';
  
  console.log('[closeEditBroadcastModal] Modal closed, thumbnail reset');
};

// Override openEditBroadcastModal to show existing thumbnail AND load correct folder
const originalOpenEditBroadcastModal = window.openEditBroadcastModal;
window.openEditBroadcastModal = async function(broadcast) {
  console.log('[openEditBroadcastModal] Opening modal for broadcast:', broadcast.id);
  
  document.getElementById('editBroadcastId').value = broadcast.id;
  document.getElementById('editAccountId').value = broadcast.accountId;
  document.getElementById('editBroadcastTitle').value = broadcast.title || '';
  document.getElementById('editBroadcastDescription').value = broadcast.description || '';
  document.getElementById('editPrivacyStatus').value = broadcast.privacyStatus || 'unlisted';
  
  // Store stream key ID for thumbnail rotation
  window.editBroadcastStreamId = broadcast.streamId || null;
  console.log('[openEditBroadcastModal] Stream ID:', window.editBroadcastStreamId);
  
  // Set category - preserve existing value
  const categorySelect = document.getElementById('editCategoryId');
  if (categorySelect) {
    categorySelect.value = broadcast.categoryId || '22';
    console.log('[openEditBroadcastModal] Category set to:', categorySelect.value);
  }
  
  // Format datetime for input
  if (broadcast.scheduledStartTime) {
    const date = new Date(broadcast.scheduledStartTime);
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    document.getElementById('editScheduledStartTime').value = localDate.toISOString().slice(0, 16);
  }
  
  // Show existing thumbnail if available
  const preview = document.getElementById('editThumbnailPreview');
  if (preview) {
    if (broadcast.thumbnailUrl) {
      preview.innerHTML = `<img src="${broadcast.thumbnailUrl}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<i class=\\'ti ti-photo text-gray-500 text-2xl\\'></i>'">`;
    } else {
      preview.innerHTML = '<i class="ti ti-photo text-gray-500 text-2xl"></i>';
    }
  }
  
  // Reset file input and thumbnail file variable
  window.editThumbnailFile = null;
  const fileInput = document.getElementById('editThumbnailFile');
  if (fileInput) fileInput.value = '';
  
  // Load thumbnail folders first
  await loadEditThumbnailFolders();
  
  // Get thumbnail folder and index from broadcast settings (saved when broadcast was created)
  const broadcastId = broadcast.id;
  let boundFolder = '';
  let savedThumbnailIndex = 0;
  let savedThumbnailPath = null;
  
  if (broadcastId) {
    const settings = await getBroadcastSettingsFromServer(broadcastId);
    // Check if settings exist and thumbnailFolder is explicitly set (including empty string for root)
    if (settings && (settings.thumbnailFolder !== null && settings.thumbnailFolder !== undefined)) {
      boundFolder = settings.thumbnailFolder;
      savedThumbnailIndex = settings.thumbnailIndex || 0;
      savedThumbnailPath = settings.thumbnailPath || null;
      console.log(`[openEditBroadcastModal] Broadcast ${broadcastId} has folder: "${boundFolder}" (${boundFolder === '' ? 'root' : 'folder'}), index: ${savedThumbnailIndex}, path: ${savedThumbnailPath}`);
    } else {
      console.log(`[openEditBroadcastModal] Broadcast ${broadcastId} has no saved folder settings, will use root`);
      boundFolder = '';
    }
  }
  
  // Store saved thumbnail info for use after gallery loads
  window.editSavedThumbnailIndex = savedThumbnailIndex;
  window.editSavedThumbnailPath = savedThumbnailPath;
  
  // Set the folder dropdown value
  const folderSelect = document.getElementById('editThumbnailFolderSelect');
  if (folderSelect) {
    folderSelect.value = boundFolder || ''; // '' for root, 'folderName' for folder
    console.log('[openEditBroadcastModal] Folder dropdown set to:', folderSelect.value || 'Root');
  }
  
  // Load thumbnails from the bound folder and auto-select saved thumbnail
  await loadEditThumbnailFolderWithSelection(boundFolder === '' ? null : boundFolder, savedThumbnailIndex, savedThumbnailPath);
  
  document.getElementById('editBroadcastModal').classList.remove('hidden');
  console.log('[openEditBroadcastModal] Modal opened with folder:', boundFolder || 'Root', 'thumbnail index:', savedThumbnailIndex);
};


/**
 * Save current title from input to Title Manager
 */
async function saveCurrentTitleToManager(context = 'edit') {
  const inputId = context === 'edit' ? 'editBroadcastTitle' : 'broadcastTitle';
  const input = document.getElementById(inputId);
  const title = input ? input.value.trim() : '';
  
  if (!title) {
    showToast('Please enter a title first', 'error');
    return;
  }
  
  try {
    const response = await fetch('/api/title-suggestions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken()
      },
      body: JSON.stringify({ title, category: 'general' })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('Title saved to manager');
    } else {
      showToast(data.error || 'Failed to save title', 'error');
    }
  } catch (error) {
    console.error('Error saving title:', error);
    showToast('Failed to save title', 'error');
  }
}
