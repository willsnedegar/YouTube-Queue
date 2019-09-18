function authenticateList() {
  return gapi.auth2.getAuthInstance()
      .signIn({scope: "https://www.googleapis.com/auth/youtube.readonly"})
      .then(function() { console.log("Sign-in successful"); },
            function(err) { console.error("Error signing in", err); });
}

function authenticate() {
  return gapi.auth2.getAuthInstance()
      .signIn({scope: "https://www.googleapis.com/auth/youtube.force-ssl"})
      .then(function() { console.log("Sign-in successful"); },
            function(err) { console.error("Error signing in", err); });
}
function loadClient() {
  gapi.client.setApiKey("<apiKey>");
  return gapi.client.load("https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest")
      .then(function() { console.log("GAPI client loaded for API"); },
          function(err) { console.error("Error loading GAPI client for API", err); });
}
// Make sure the client is loaded and sign-in is complete before calling this method.
//Lists current playlists
function listPlaylists() {
  return gapi.client.youtube.playlists.list({
    "part": "snippet",
    "maxResults": 50,
    "mine": true
  })
      .then(function(response) {
              // Handle the results here (response.result has the parsed body).
              console.log("Response", response);

              let length = response.result.items.length;
              for(let i=0; i<length; i++){
                if(response.result.items[i].snippet.title === "Queue"){
                  chrome.storage.sync.set({'playlistId': response.result.items[i].id});
                  return;
                }
              }
              insertQueuePlaylist();
            },
            function(err) { console.error("Execute error", err); });
}
//Lists videos in Queue playlist
function listVideos() {
    return gapi.client.youtube.playlistItems.list({
      "part": "snippet",
      "maxResults": 50,
      "playlistId": chrome.storage.sync.get(['playlistId'])
    })
        .then(function(response) {
                // Handle the results here (response.result has the parsed body).
                return response.result.pageInfo.totalResults;
                console.log("Response", response);
              },
              function(err) { console.error("Execute error", err); });
  }

//Inserts video to playlist
function insertVideo(videoId) {
    return gapi.client.youtube.playlistItems.insert({
      "part": "snippet",
      "resource": {
        "snippet": {
          "playlistId": chrome.storage.sync.get(['playlistId']),
          "position": 0,
          "resourceId": {
            "kind": "youtube#video",
            "videoId": videoId
          }
        }
      }
    })
        .then(function(response) {
                // Handle the results here (response.result has the parsed body).
                console.log("Response", response);
              },
              function(err) { console.error("Execute error", err); });
}

//Delete video from playlist
function deleteVideo(videoId) {
    return gapi.client.youtube.playlistItems.delete({
      "id": videoId
    })
        .then(function(response) {
                // Handle the results here (response.result has the parsed body).
                console.log("Response", response);
              },
              function(err) { console.error("Execute error", err); });
  }
//Inserts the playlist
function insertQueuePlaylist() {
  return gapi.client.youtube.playlists.insert({
    "part": "snippet",
    "resource": {
      "snippet": {
        "title": "Queue",
        "description": "The videos queued to play next"
      }
    }
  })
      .then(function(response) {
              // Handle the results here (response.result has the parsed body).
              console.log("Response", response);
              chrome.storage.sync.set({'playlistId': response.result.id});
            },
            function(err) { console.error("Execute error", err); });
}

//gapi load
gapi.load("client:auth2", function() {
  gapi.auth2.init({client_id: "<clientId>" });
});


//add queue link
chrome.runtime.onInstalled.addListener(function() {
    authenticate().then(loadClient);
    insertQueuePlaylist();
    chrome.contextMenus.create({
      "id": "queueContextMenu",
      "title": "Add to Queue",
      "contexts": ["links"]
    });
  });

chrome.contextMenus.onClicked.addListener(function(info) {
  if (info.menuItemId === "queueContextMenu") {
      chrome.storage.sync.get(['playlistId'],function(data){
        if(data.playlistId ==='undefined'){
          authenticateList().then(loadClient);
          listPlaylists();
        }
      });
      authenticate().then(loadClient);
      let url = new URL(info.linkUrl);
      insertVideo(url.searchParams.get("v"));
    }
})

chrome.webNavigation.onBeforeNavigate.addListener(function(details){
  //before Navigate, get the id of the queue playlist if you don't already have it
  console.log(details.url);
  chrome.storage.sync.get(['playlistId'],function(data){
    if(data.playlistId==='undefined'){
      authenticateList().then(loadClient);
      listPlaylists();
    }
  });
  //get the number of videos in the queue
  let numVideos = listVideos();
  if (numVideos!=0){
    authenticate().then(loadClient);
    //if there are videos in the queue, add the current video to the begining of the queue,
    let url = new URL(details.url);
    let videoId = url.searchParams.get("v");
    insertVideo(vidoId);
    //and enter the playlists
    window.location.search = "?v=" + videoId + "&list=" + chrome.storage.sync.get(['playlistId']);
  }

},{url: [{urlContains : '.youtube.com/watch'}]});

chrome.webNavigation.onHistoryStateUpdated.addListener(function(details){
  console.log(details.url);

},{url: [{urlContains : '.youtube.com/watch'}]});

chrome.webNavigation.onCompleted.addListener(function(details){
  authenticate().then(loadClient)
  let url = new URL(details.url);
  let videoId = url.searchParams.get("v");
  deleteVideo(videoId);
},{url: [{queryContains: 'list=' + chrome.storage.sync.get(['playlistId'],function(result) {
          console.log('Value currently is ' + result.key);
        })}]});
