let documentsDir;
let cacheDir;
let playlist = [];
let currentVideoIndex = -1;

function initApp() {
  logMessage("Application initializing...");

  initializeFilesystem();

  loadSamplePlaylist();
}

// Handle keydown events
function handleKeydown(event) {
  logMessage("[App] Keydown event: " + event.keyCode);

  switch (event.keyCode) {
    case 10009: // Return key on Tizen
      logMessage("[App] Return key pressed, exiting application");
      tizen.application.getCurrentApplication().exit();
      break;
    default:
      break;
  }
}

// Initialize the filesystem and create cache directory
function initializeFilesystem() {
  logMessage("Initializing filesystem...");

  tizen.filesystem.resolve(
    "videos",
    function (dirHandle) {
      documentsDir = dirHandle;
      logMessage("Documents directory resolved: " + documentsDir.fullPath);

      // Create cache directory if it doesn't exist
      try {
        cacheDir = documentsDir.resolve("videos");
        logMessage("Cache directory already exists: " + cacheDir.fullPath);
      } catch (e) {
        cacheDir = documentsDir.createDirectory("videos");
        logMessage("Cache directory created: " + cacheDir.fullPath);
      }

      // After initialization, refresh cache status
      refreshCacheStatus();
    },
    function (error) {
      logError(
        "Failed to resolve documents directory: " + JSON.stringify(error)
      );
    },
    "rw"
  );
}

// Load sample video playlist
function loadSamplePlaylist() {
  
  // Add sample videos to playlist
  playlist = sampleVideos;
  updatePlaylistUI();
  logMessage("Sample playlist loaded with " + playlist.length + " videos");
}

// Add a video to the playlist
function addVideoToPlaylist() {
  const videoUrl = document.getElementById("videoUrl").value.trim();

  if (!videoUrl) {
    logError("Please enter a valid video URL");
    return;
  }

  // Extract title from URL (for simplicity, using the filename)
  const urlParts = videoUrl.split("/");
  const fileName = urlParts[urlParts.length - 1];
  const title = fileName.split(".")[0] || "Untitled Video";

  // Add to playlist
  playlist.push({
    url: videoUrl,
    title: title,
    cached: false,
  });

  // Update UI
  updatePlaylistUI();
  refreshCacheStatus();

  // Clear input field
  document.getElementById("videoUrl").value = "";

  logMessage("Added video to playlist: " + title);
}

// Update the playlist UI with current playlist items
function updatePlaylistUI() {
  const playlistContainer = document.getElementById("playlistItems");
  playlistContainer.innerHTML = "";

  if (playlist.length === 0) {
    playlistContainer.innerHTML =
      '<div class="playlist-item">No videos in playlist</div>';
    return;
  }

  playlist.forEach((video, index) => {
    const itemClass = video.cached ? "playlist-item cached" : "playlist-item";
    const statusClass = video.cached
      ? "status status-cached"
      : "status status-not-cached";
    const statusText = video.cached ? "CACHED" : "NOT CACHED";

    const itemHTML = `
            <div class="${itemClass}">
                <div>
                    <strong>${video.title}</strong>
                    <div class="video-info">${video.url}</div>
                </div>
                <div class="controls">
                    <span class="${statusClass}">${statusText}</span>
                    ${
                      video.cached
                        ? `<button class="button secondary-button" onclick="playVideo(${index})">Play</button>`
                        : `<button class="button primary-button" onclick="cacheVideo(${index})">Cache</button>`
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
    logError("Cache directory not initialized");
    return;
  }

  logMessage("Refreshing cache status...");

  cacheDir.listFiles(
    function (files) {
      logMessage("Found " + files.length + " files in cache");

      // Update cache status for each playlist item
      playlist.forEach((video, index) => {
        const urlParts = video.url.split("/");
        const fileName = urlParts[urlParts.length - 1];

        // Check if file exists in cache
        const cachedFile = files.find((file) => file.name === fileName);
        playlist[index].cached = !!cachedFile;
      });

      // Update UI to reflect current cache status
      updatePlaylistUI();
      logMessage("Cache status updated");
    },
    function (error) {
      logError("Failed to list cache files: " + JSON.stringify(error));
    }
  );
}

// Cache a video from the playlist using Tizen Download API
function cacheVideo(index) {
  if (!cacheDir) {
    logError("Cache directory not initialized");
    return;
  }

  const video = playlist[index];

  if (!video) {
    logError("Invalid video index");
    return;
  }

  logMessage("Starting to cache video: " + video.title);

  // Extract filename from URL
  const urlParts = video.url.split("/");
  const fileName = urlParts[urlParts.length - 1];

  // Create a download request
  const downloadRequest = new tizen.DownloadRequest(
    video.url, // URL of the file to be downloaded
    cacheDir.fullPath
  );

  // Create a progress indicator in the console
  const progressId = "progress-" + Date.now();
  const consoleElement = document.getElementById("console");
  consoleElement.innerHTML += `<div id="${progressId}">[${new Date().toLocaleTimeString()}] Downloading ${
    video.title
  }: 0%</div>`;

  // Define the event handlers for different download process notifications
  const listener = {
    onprogress: function (id, receivedSize, totalSize) {
      const progress = totalSize
        ? Math.round((receivedSize / totalSize) * 100)
        : "unknown";
      const progressElement = document.getElementById(progressId);
      if (progressElement) {
        progressElement.innerHTML = `[${new Date().toLocaleTimeString()}] Downloading ${
          video.title
        }: ${progress}%`;
      }
      logMessage(
        "Received with id: " + id + ", " + receivedSize + "/" + totalSize
      );
    },
    onpaused: function (id) {
      logMessage("Paused with id: " + id);
    },
    oncanceled: function (id) {
      logMessage("Canceled with id: " + id);
    },
    oncompleted: function (id, fullPath) {
      logMessage("Completed with id: " + id + ", full path: " + fullPath);
      const file = { name: fileName, url: video.url, moveTo: function() {} }; // Mock file object for demonstration
      moveFileToCache("videoCache", file);
      const progressElement = document.getElementById(progressId);
      if (progressElement) {
        progressElement.innerHTML = `[${new Date().toLocaleTimeString()}] Successfully cached video: ${
          video.title
        }`;
      }
    },
    onfailed: function (id, error) {
      logError("Failed with id: " + id + ", error name: " + error.name);
      const progressElement = document.getElementById(progressId);
      if (progressElement) {
        progressElement.innerHTML = `[${new Date().toLocaleTimeString()}] ERROR: Failed to download ${
          video.title
        }: ${error.name}`;
      }
    },
  };

  // Start the download
  const downloadId = tizen.download.start(downloadRequest, listener);

  // Check the state of the download
  const state = tizen.download.getState(downloadId);
  logMessage("Download state: " + state);
}

// Move a downloaded file to a folder named with a caching ID
function moveFileToCache(cachingId, file) {
  if (!documentsDir) {
    logError("Documents directory not initialized");
    return null;
  }

  try {
    // Create caching directory if it doesn't exist
    let cachingDir;
    try {
      cachingDir = documentsDir.resolve(cachingId);
      logMessage("Caching directory already exists: " + cachingDir.fullPath);
    } catch (e) {
      cachingDir = documentsDir.createDirectory(cachingId);
      logMessage("Caching directory created: " + cachingDir.fullPath);
    }

    // Move the file to the caching directory
    const newFilePath = cachingDir.fullPath + "/" + file.name;
    file.moveTo(cachingDir.fullPath, file.name, true, function() {
      logMessage("File moved to: " + newFilePath);

      // Convert the file path to a URI
      const fileURI = getFileURI(newFilePath);
      logMessage("File URI: " + fileURI);

      // Update the playlist with the new URI
      const videoIndex = playlist.findIndex(v => v.url === file.url);
      if (videoIndex !== -1) {
        playlist[videoIndex].url = fileURI;
        playlist[videoIndex].cached = true;
        updatePlaylistUI();
      }
    }, function(error) {
      logError("Failed to move file to cache: " + JSON.stringify(error));
    });

    return newFilePath;
  } catch (error) {
    logError("Failed to move file to cache: " + JSON.stringify(error));
    return null;
  }
}

// Clear the cache by deleting the folder with the caching ID
function clearCacheById(cachingId) {
  if (!documentsDir) {
    logError("Documents directory not initialized");
    return false;
  }

  try {
    const cachingDir = documentsDir.resolve(cachingId);
    tizen.filesystem.deleteDirectory(
      cachingDir.fullPath,
      true,
      function () {
        logMessage("Caching directory deleted: " + cachingDir.fullPath);
      },
      function (error) {
        logError(
          "Failed to delete caching directory: " + JSON.stringify(error)
        );
      }
    );
    return true;
  } catch (error) {
    logError("Failed to resolve caching directory: " + JSON.stringify(error));
    return false;
  }
}

// Example usage
function exampleUsage() {
  const cachingId = "videoCache123";
  const file = { name: "example.mp4", moveTo: function () {} }; // Mock file object for demonstration

  // Move file to cache
  const fileURI = moveFileToCache(cachingId, file);
  if (fileURI) {
    logMessage("File successfully moved to cache: " + fileURI);
  }

  // Clear cache
  const cacheCleared = clearCacheById(cachingId);
  if (cacheCleared) {
    logMessage("Cache successfully cleared for ID: " + cachingId);
  }
}

// Convert file path to URI
function getFileURI(path) {
  if (!path || typeof path !== 'string') {
    logError('Invalid path provided for URI conversion');
    return null;
  }

  try {
    return tizen.filesystem.toURI(path);
  } catch (error) {
    logError('Failed to convert path to URI: ' + JSON.stringify(error));
    return null;
  }
}

// Play a video from the playlist
function playVideo(index) {
    const video = playlist[index];

    if (!video) {
        logError("Invalid video index");
        return;
    }

    if (!video.cached) {
        logError("Video is not cached: " + video.title);
        return;
    }

    currentVideoIndex = index;

    // Update the UI
    document.getElementById("currentVideoTitle").textContent = video.title;
    document.getElementById("videoContainer").style.display = "block";

    const videoPlayer = document.getElementById("videoPlayer");

    // Get the cached file URL
    const cachedFileURI = video.url;

    logMessage(
        "Playing cached video: " + video.title + " from " + cachedFileURI
    );
    videoPlayer.src = cachedFileURI;

    // Start playback
    videoPlayer.play().catch((error) => {
        logError("Failed to play video: " + error.message);
    });

    // Play next video when the current one ends
    videoPlayer.onended = function() {
        currentVideoIndex = (currentVideoIndex + 1) % playlist.length;
        playVideo(currentVideoIndex);
    };
}

// Clear the entire video cache
function clearCache() {
  if (!cacheDir) {
    logError("Cache directory not initialized");
    return;
  }

  logMessage("Clearing video cache...");

  cacheDir.listFiles(
    function (files) {
      if (files.length === 0) {
        logMessage("Cache is already empty");
        return;
      }

      let filesDeleted = 0;

      files.forEach((file) => {
        cacheDir.deleteFile(
          cacheDir.fullPath + "/" + file.name,
          function () {
            filesDeleted++;
            logMessage("Deleted file: " + file.name);

            if (filesDeleted === files.length) {
              logMessage("All cache files deleted successfully");

              // Update cache status for all videos
              playlist.forEach((video, index) => {
                playlist[index].cached = false;
              });

              updatePlaylistUI();
            }
          },
          function (error) {
            logError(
              "Failed to delete file " +
                file.name +
                ": " +
                JSON.stringify(error)
            );
          }
        );
      });
    },
    function (error) {
      logError("Failed to list cache files: " + JSON.stringify(error));
    }
  );
}

// Log messages to the console UI
function logMessage(message) {
  const consoleElement = document.getElementById("console");
  const timestamp = new Date().toLocaleTimeString();
  consoleElement.innerHTML += `<div>[${timestamp}] ${message}</div>`;

  // Auto-scroll to bottom
  consoleElement.scrollTop = consoleElement.scrollHeight;

  // Also log to browser console
  console.log("[App] " + message);
}

// Log errors to the console UI with error styling
function logError(message) {
  const consoleElement = document.getElementById("console");
  const timestamp = new Date().toLocaleTimeString();
  consoleElement.innerHTML += `<div style="color: #dc3545;">[${timestamp}] ERROR: ${message}</div>`;

  // Auto-scroll to bottom
  consoleElement.scrollTop = consoleElement.scrollHeight;

  // Also log to browser console
  console.error("[App] " + message);
}
