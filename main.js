// Global variables
let documentsDir;
let cacheDir;
let playlist = [];
let currentVideoIndex = -1;

// Initialize the application
function initApp() {
    logMessage('Application initializing...');
    
    // Initialize the filesystem
    initializeFilesystem();
    
    // Load sample videos for testing
    loadSamplePlaylist();
}

// Handle keydown events
function handleKeydown(event) {
    logMessage('[App] Keydown event: ' + event.keyCode);

    switch(event.keyCode) {
        case 10009:  // Return key on Tizen
            logMessage('[App] Return key pressed, exiting application');
            tizen.application.getCurrentApplication().exit();
            break;
        default:
            break;
    }
}

// Initialize the filesystem and create cache directory
function initializeFilesystem() {
    logMessage('Initializing filesystem...');
    
    tizen.filesystem.resolve(
        'documents',
        function(dirHandle) {
            documentsDir = dirHandle;
            logMessage('Documents directory resolved: ' + documentsDir.fullPath);
            
            // Create cache directory if it doesn't exist
            try {
                cacheDir = documentsDir.resolve('videoCache');
                logMessage('Cache directory already exists: ' + cacheDir.fullPath);
            } catch (e) {
                cacheDir = documentsDir.createDirectory('videoCache');
                logMessage('Cache directory created: ' + cacheDir.fullPath);
            }
            
            // After initialization, refresh cache status
            refreshCacheStatus();
        },
        function(error) {
            logError('Failed to resolve documents directory: ' + JSON.stringify(error));
        },
        'rw'
    );
}

// Load sample video playlist
function loadSamplePlaylist() {
    // Sample video URLs (for testing purposes)
    const sampleVideos = [
        {
            url: 'https://example.com/sample1.mp4',
            title: 'Sample Video 1'
        },
        {
            url: 'https://example.com/sample2.mp4',
            title: 'Sample Video 2'
        },
        {
            url: 'https://example.com/sample3.mp4',
            title: 'Sample Video 3'
        }
    ];
    
    // Add sample videos to playlist
    playlist = sampleVideos;
    updatePlaylistUI();
    logMessage('Sample playlist loaded with ' + playlist.length + ' videos');
}

// Add a video to the playlist
function addVideoToPlaylist() {
    const videoUrl = document.getElementById('videoUrl').value.trim();
    
    if (!videoUrl) {
        logError('Please enter a valid video URL');
        return;
    }
    
    // Extract title from URL (for simplicity, using the filename)
    const urlParts = videoUrl.split('/');
    const fileName = urlParts[urlParts.length - 1];
    const title = fileName.split('.')[0] || 'Untitled Video';
    
    // Add to playlist
    playlist.push({
        url: videoUrl,
        title: title,
        cached: false
    });
    
    // Update UI
    updatePlaylistUI();
    refreshCacheStatus();
    
    // Clear input field
    document.getElementById('videoUrl').value = '';
    
    logMessage('Added video to playlist: ' + title);
}

// Update the playlist UI with current playlist items
function updatePlaylistUI() {
    const playlistContainer = document.getElementById('playlistItems');
    playlistContainer.innerHTML = '';
    
    if (playlist.length === 0) {
        playlistContainer.innerHTML = '<div class="playlist-item">No videos in playlist</div>';
        return;
    }
    
    playlist.forEach((video, index) => {
        const itemClass = video.cached ? 'playlist-item cached' : 'playlist-item';
        const statusClass = video.cached ? 'status status-cached' : 'status status-not-cached';
        const statusText = video.cached ? 'CACHED' : 'NOT CACHED';
        
        const itemHTML = `
            <div class="${itemClass}">
                <div>
                    <strong>${video.title}</strong>
                    <div class="video-info">${video.url}</div>
                </div>
                <div class="controls">
                    <span class="${statusClass}">${statusText}</span>
                    ${video.cached ? 
                        `<button class="button secondary-button" onclick="playVideo(${index})">Play</button>` : 
                        `<button class="button primary-button" onclick="cacheVideo(${index})">Cache</button>`
                    }
                </div>
            </div>
        `;
        
        playlistContainer.innerHTML += itemHTML;
    });
}

// Refresh the cache status for all videos in the playlist
function refreshCacheStatus() {
    if (!cacheDir) {
        logError('Cache directory not initialized');
        return;
    }
    
    logMessage('Refreshing cache status...');
    
    cacheDir.listFiles(
        function(files) {
            logMessage('Found ' + files.length + ' files in cache');
            
            // Update cache status for each playlist item
            playlist.forEach((video, index) => {
                const urlParts = video.url.split('/');
                const fileName = urlParts[urlParts.length - 1];
                
                // Check if file exists in cache
                const cachedFile = files.find(file => file.name === fileName);
                playlist[index].cached = !!cachedFile;
            });
            
            // Update UI to reflect current cache status
            updatePlaylistUI();
            logMessage('Cache status updated');
        },
        function(error) {
            logError('Failed to list cache files: ' + JSON.stringify(error));
        }
    );
}

// Cache a video from the playlist
function cacheVideo(index) {
    if (!cacheDir) {
        logError('Cache directory not initialized');
        return;
    }
    
    const video = playlist[index];
    
    if (!video) {
        logError('Invalid video index');
        return;
    }
    
    logMessage('Starting to cache video: ' + video.title);
    
    // In a real implementation, you would use XMLHttpRequest or Fetch API to download the video
    // For this example, we'll simulate downloading by creating an empty file
    
    const urlParts = video.url.split('/');
    const fileName = urlParts[urlParts.length - 1];
    
    try {
        // Create a file in the cache directory
        const newFile = cacheDir.createFile(fileName);
        
        // In a real implementation, you would download the content and write it to the file
        // For simulation, we'll just write some placeholder text
        newFile.openStream(
            'w',
            function(fileStream) {
                fileStream.write('This is a cached video file placeholder for ' + video.url);
                fileStream.close();
                
                // Update cache status
                playlist[index].cached = true;
                updatePlaylistUI();
                
                logMessage('Successfully cached video: ' + video.title);
            },
            function(error) {
                logError('Failed to write to cache file: ' + JSON.stringify(error));
            }
        );
    } catch (error) {
        logError('Failed to create cache file: ' + JSON.stringify(error));
    }
}

// Play a video from the playlist
function playVideo(index) {
    const video = playlist[index];
    
    if (!video) {
        logError('Invalid video index');
        return;
    }
    
    currentVideoIndex = index;
    
    // Update the UI
    document.getElementById('currentVideoTitle').textContent = video.title;
    document.getElementById('videoContainer').style.display = 'block';
    
    const videoPlayer = document.getElementById('videoPlayer');
    
    if (video.cached) {
        // In a real implementation, you would set the source to the local file
        // For this example, we'll use the original URL
        logMessage('Playing cached video: ' + video.title);
        videoPlayer.src = video.url;
    } else {
        // Play from URL
        logMessage('Playing video from URL: ' + video.title);
        videoPlayer.src = video.url;
    }
    
    // Start playback
    videoPlayer.play().catch(error => {
        logError('Failed to play video: ' + error.message);
    });
}

// Clear the entire video cache
function clearCache() {
    if (!cacheDir) {
        logError('Cache directory not initialized');
        return;
    }
    
    logMessage('Clearing video cache...');
    
    cacheDir.listFiles(
        function(files) {
            if (files.length === 0) {
                logMessage('Cache is already empty');
                return;
            }
            
            let filesDeleted = 0;
            
            files.forEach(file => {
                cacheDir.deleteFile(
                    cacheDir.fullPath + '/' + file.name,
                    function() {
                        filesDeleted++;
                        logMessage('Deleted file: ' + file.name);
                        
                        if (filesDeleted === files.length) {
                            logMessage('All cache files deleted successfully');
                            
                            // Update cache status for all videos
                            playlist.forEach((video, index) => {
                                playlist[index].cached = false;
                            });
                            
                            updatePlaylistUI();
                        }
                    },
                    function(error) {
                        logError('Failed to delete file ' + file.name + ': ' + JSON.stringify(error));
                    }
                );
            });
        },
        function(error) {
            logError('Failed to list cache files: ' + JSON.stringify(error));
        }
    );
}

// Log messages to the console UI
function logMessage(message) {
    const consoleElement = document.getElementById('console');
    const timestamp = new Date().toLocaleTimeString();
    consoleElement.innerHTML += `<div>[${timestamp}] ${message}</div>`;
    
    // Auto-scroll to bottom
    consoleElement.scrollTop = consoleElement.scrollHeight;
    
    // Also log to browser console
    console.log('[App] ' + message);
}

// Log errors to the console UI with error styling
function logError(message) {
    const consoleElement = document.getElementById('console');
    const timestamp = new Date().toLocaleTimeString();
    consoleElement.innerHTML += `<div style="color: #dc3545;">[${timestamp}] ERROR: ${message}</div>`;
    
    // Auto-scroll to bottom
    consoleElement.scrollTop = consoleElement.scrollHeight;
    
    // Also log to browser console
    console.error('[App] ' + message);
}