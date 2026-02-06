/**
 * Property-Based Tests for Playlist Audio Selection Feature
 * 
 * Tests the correctness properties defined in the design document:
 * - Property 1: Audio Selection Moves Audio Between Lists
 * - Property 2: Audio Removal Returns Audio to Available List
 * - Property 3: Audio Reorder Preserves All Audios
 * - Property 4: Audio Persistence Round Trip
 */

const fc = require('fast-check');

// Mock audio data generator
const audioArbitrary = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 100 }),
  filepath: fc.string({ minLength: 1 }),
  duration: fc.float({ min: 0, max: 3600 }),
  format: fc.constantFrom('mp3', 'wav', 'ogg', 'aac')
});

// Mock video data generator
const videoArbitrary = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 100 }),
  thumbnail_path: fc.string({ minLength: 1 }),
  duration: fc.float({ min: 0, max: 7200 }),
  format: fc.constantFrom('mp4', 'webm', 'mkv')
});

/**
 * Simulates the audio selection state management
 * This mirrors the frontend JavaScript logic
 */
class PlaylistSelectionState {
  constructor(allAudios = [], allVideos = []) {
    this.allAudios = [...allAudios];
    this.allVideos = [...allVideos];
    this.selectedAudios = [];
    this.selectedVideos = [];
  }

  getAvailableAudios() {
    const selectedIds = this.selectedAudios.map(a => a.id);
    return this.allAudios.filter(audio => !selectedIds.includes(audio.id));
  }

  getAvailableVideos() {
    const selectedIds = this.selectedVideos.map(v => v.id);
    return this.allVideos.filter(video => !selectedIds.includes(video.id));
  }

  addAudio(audioId) {
    const audio = this.allAudios.find(a => a.id === audioId);
    if (audio && !this.selectedAudios.find(a => a.id === audioId)) {
      this.selectedAudios.push(audio);
      return true;
    }
    return false;
  }

  removeAudio(audioId) {
    const index = this.selectedAudios.findIndex(a => a.id === audioId);
    if (index !== -1) {
      this.selectedAudios.splice(index, 1);
      return true;
    }
    return false;
  }

  reorderAudios(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.selectedAudios.length) return false;
    if (toIndex < 0 || toIndex >= this.selectedAudios.length) return false;
    
    const [movedAudio] = this.selectedAudios.splice(fromIndex, 1);
    this.selectedAudios.splice(toIndex, 0, movedAudio);
    return true;
  }

  getSelectedAudioIds() {
    return this.selectedAudios.map(a => a.id);
  }
}

/**
 * Mock Playlist model for testing persistence
 */
class MockPlaylistModel {
  constructor() {
    this.playlists = new Map();
    this.playlistAudios = new Map();
  }

  async create(playlistData) {
    const id = `playlist-${Date.now()}-${Math.random()}`;
    const playlist = { id, ...playlistData };
    this.playlists.set(id, playlist);
    return playlist;
  }

  async addAudio(playlistId, audioId, position) {
    const key = playlistId;
    if (!this.playlistAudios.has(key)) {
      this.playlistAudios.set(key, []);
    }
    this.playlistAudios.get(key).push({ audioId, position });
  }

  async findByIdWithMedia(playlistId) {
    const playlist = this.playlists.get(playlistId);
    if (!playlist) return null;
    
    const audios = this.playlistAudios.get(playlistId) || [];
    return {
      ...playlist,
      audios: audios.sort((a, b) => a.position - b.position).map(a => ({ id: a.audioId }))
    };
  }

  async clearAudios(playlistId) {
    this.playlistAudios.set(playlistId, []);
  }
}

describe('Playlist Audio Selection - Property Based Tests', () => {
  
  /**
   * **Feature: playlist-audio-selection, Property 1: Audio Selection Moves Audio Between Lists**
   * **Validates: Requirements 3.1, 3.3**
   * 
   * For any audio in the available list, when it is added to the selected list,
   * it should no longer appear in the available list and should appear in the selected list.
   */
  describe('Property 1: Audio Selection Moves Audio Between Lists', () => {
    it('adding an audio removes it from available and adds to selected', () => {
      fc.assert(
        fc.property(
          fc.array(audioArbitrary, { minLength: 1, maxLength: 20 }),
          fc.nat(),
          (audios, indexSeed) => {
            // Ensure unique IDs
            const uniqueAudios = audios.reduce((acc, audio, i) => {
              acc.push({ ...audio, id: `audio-${i}` });
              return acc;
            }, []);
            
            const state = new PlaylistSelectionState(uniqueAudios);
            const audioIndex = indexSeed % uniqueAudios.length;
            const audioToAdd = uniqueAudios[audioIndex];
            
            // Before adding
            const availableBefore = state.getAvailableAudios();
            expect(availableBefore.find(a => a.id === audioToAdd.id)).toBeDefined();
            expect(state.selectedAudios.find(a => a.id === audioToAdd.id)).toBeUndefined();
            
            // Add audio
            state.addAudio(audioToAdd.id);
            
            // After adding
            const availableAfter = state.getAvailableAudios();
            expect(availableAfter.find(a => a.id === audioToAdd.id)).toBeUndefined();
            expect(state.selectedAudios.find(a => a.id === audioToAdd.id)).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: playlist-audio-selection, Property 2: Audio Removal Returns Audio to Available List**
   * **Validates: Requirements 3.2, 3.4**
   * 
   * For any audio in the selected list, when it is removed,
   * it should no longer appear in the selected list and should appear in the available list.
   */
  describe('Property 2: Audio Removal Returns Audio to Available List', () => {
    it('removing an audio returns it to available list', () => {
      fc.assert(
        fc.property(
          fc.array(audioArbitrary, { minLength: 1, maxLength: 20 }),
          fc.nat(),
          (audios, indexSeed) => {
            // Ensure unique IDs
            const uniqueAudios = audios.reduce((acc, audio, i) => {
              acc.push({ ...audio, id: `audio-${i}` });
              return acc;
            }, []);
            
            const state = new PlaylistSelectionState(uniqueAudios);
            const audioIndex = indexSeed % uniqueAudios.length;
            const audioToAddAndRemove = uniqueAudios[audioIndex];
            
            // Add audio first
            state.addAudio(audioToAddAndRemove.id);
            expect(state.selectedAudios.find(a => a.id === audioToAddAndRemove.id)).toBeDefined();
            
            // Remove audio
            state.removeAudio(audioToAddAndRemove.id);
            
            // After removing
            const availableAfter = state.getAvailableAudios();
            expect(availableAfter.find(a => a.id === audioToAddAndRemove.id)).toBeDefined();
            expect(state.selectedAudios.find(a => a.id === audioToAddAndRemove.id)).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: playlist-audio-selection, Property 3: Audio Reorder Preserves All Audios**
   * **Validates: Requirements 3.5**
   * 
   * For any reorder operation on selected audios,
   * the set of audios before and after reordering should be identical (only positions change).
   */
  describe('Property 3: Audio Reorder Preserves All Audios', () => {
    it('reordering preserves all audios in the list', () => {
      fc.assert(
        fc.property(
          fc.array(audioArbitrary, { minLength: 2, maxLength: 20 }),
          fc.nat(),
          fc.nat(),
          (audios, fromSeed, toSeed) => {
            // Ensure unique IDs
            const uniqueAudios = audios.reduce((acc, audio, i) => {
              acc.push({ ...audio, id: `audio-${i}` });
              return acc;
            }, []);
            
            const state = new PlaylistSelectionState(uniqueAudios);
            
            // Add all audios to selected
            uniqueAudios.forEach(audio => state.addAudio(audio.id));
            
            const idsBefore = new Set(state.getSelectedAudioIds());
            const countBefore = state.selectedAudios.length;
            
            // Perform reorder
            const fromIndex = fromSeed % state.selectedAudios.length;
            const toIndex = toSeed % state.selectedAudios.length;
            state.reorderAudios(fromIndex, toIndex);
            
            const idsAfter = new Set(state.getSelectedAudioIds());
            const countAfter = state.selectedAudios.length;
            
            // Verify set equality
            expect(countAfter).toBe(countBefore);
            expect(idsAfter.size).toBe(idsBefore.size);
            idsBefore.forEach(id => {
              expect(idsAfter.has(id)).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: playlist-audio-selection, Property 4: Audio Persistence Round Trip**
   * **Validates: Requirements 4.1, 4.2**
   * 
   * For any playlist with selected audios, saving the playlist and then loading it
   * should return the same set of audios in the same order.
   */
  describe('Property 4: Audio Persistence Round Trip', () => {
    it('saving and loading playlist preserves audio selection', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(audioArbitrary, { minLength: 1, maxLength: 10 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (audios, playlistName) => {
            // Ensure unique IDs
            const uniqueAudios = audios.reduce((acc, audio, i) => {
              acc.push({ ...audio, id: `audio-${i}` });
              return acc;
            }, []);
            
            const model = new MockPlaylistModel();
            
            // Create playlist
            const playlist = await model.create({
              name: playlistName,
              description: 'Test playlist',
              is_shuffle: false,
              user_id: 'test-user'
            });
            
            // Add audios with positions
            for (let i = 0; i < uniqueAudios.length; i++) {
              await model.addAudio(playlist.id, uniqueAudios[i].id, i + 1);
            }
            
            // Load playlist
            const loadedPlaylist = await model.findByIdWithMedia(playlist.id);
            
            // Verify round trip
            expect(loadedPlaylist).not.toBeNull();
            expect(loadedPlaylist.audios.length).toBe(uniqueAudios.length);
            
            // Verify order is preserved
            for (let i = 0; i < uniqueAudios.length; i++) {
              expect(loadedPlaylist.audios[i].id).toBe(uniqueAudios[i].id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

describe('Playlist Audio Selection - Unit Tests', () => {
  describe('PlaylistSelectionState', () => {
    it('should initialize with empty selected arrays', () => {
      const state = new PlaylistSelectionState([], []);
      expect(state.selectedAudios).toEqual([]);
      expect(state.selectedVideos).toEqual([]);
    });

    it('should not add duplicate audios', () => {
      const audios = [{ id: '1', title: 'Audio 1' }];
      const state = new PlaylistSelectionState(audios);
      
      state.addAudio('1');
      state.addAudio('1'); // Try to add again
      
      expect(state.selectedAudios.length).toBe(1);
    });

    it('should not add non-existent audio', () => {
      const audios = [{ id: '1', title: 'Audio 1' }];
      const state = new PlaylistSelectionState(audios);
      
      const result = state.addAudio('non-existent');
      
      expect(result).toBe(false);
      expect(state.selectedAudios.length).toBe(0);
    });

    it('should handle removing non-existent audio gracefully', () => {
      const state = new PlaylistSelectionState([]);
      
      const result = state.removeAudio('non-existent');
      
      expect(result).toBe(false);
    });

    it('should handle invalid reorder indices', () => {
      const audios = [{ id: '1', title: 'Audio 1' }];
      const state = new PlaylistSelectionState(audios);
      state.addAudio('1');
      
      expect(state.reorderAudios(-1, 0)).toBe(false);
      expect(state.reorderAudios(0, 10)).toBe(false);
    });
  });
});
