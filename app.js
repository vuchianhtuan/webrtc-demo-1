const localVideo = document.getElementById('localVideo');
const joinBtn = document.getElementById('joinRoom');
const shareBtn = document.getElementById('shareScreen');
const roomInput = document.getElementById('roomInput');

const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessage');
const messagesDiv = document.getElementById('messages');
const videoContainer = document.getElementById('videos');

const servers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

let localStream;
let roomId;
let clientId = crypto.randomUUID();
let peers = {};
let dataChannels = {};

// Get media
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localVideo.srcObject = stream;
    localStream = stream;
  });

joinBtn.onclick = async () => {
  roomId = roomInput.value;
  if (!roomId) return alert("Enter room ID");

  await db.ref(`call/${roomId}/clients/${clientId}`).set(true);

  const snapshot = await db.ref(`call/${roomId}/clients`).once('value');
  const clientList = snapshot.val();

  for (const id in clientList) {
    if (id !== clientId) {
      createConnection(id, true); // caller
    }
  }

  db.ref(`call/${roomId}/clients`).on('child_added', snap => {
    const newClientId = snap.key;
    if (newClientId !== clientId && !peers[newClientId]) {
      createConnection(newClientId, false); // callee
    }
  });
};

function createConnection(remoteId, isCaller) {
  const pc = new RTCPeerConnection(servers);
  peers[remoteId] = pc;

  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  const dc = pc.createDataChannel("chat");
  dataChannels[remoteId] = dc;

  dc.onmessage = e => addMessage(`Peer: ${e.data}`);
  dc.onopen = () => console.log("Data channel open");

  pc.ondatachannel = e => {
    e.channel.onmessage = ev => addMessage(`Peer: ${ev.data}`);
  };

  pc.ontrack = event => {
    let video = document.getElementById(`video-${remoteId}`);
    if (!video) {
      video = document.createElement('video');
      video.autoplay = true;
      video.playsInline = true;
      video.id = `video-${remoteId}`;
      videoContainer.appendChild(video);
    }
    video.srcObject = event.streams[0];
  };

  pc.onicecandidate = e => {
    if (e.candidate) {
      db.ref(`call/${roomId}/signaling/${clientId}_${remoteId}/candidates`).push().set(JSON.stringify(e.candidate));
    }
  };

  if (isCaller) {
    pc.createOffer().then(offer => {
      pc.setLocalDescription(offer);
      db.ref(`call/${roomId}/signaling/${clientId}_${remoteId}/offer`).set(JSON.stringify(offer));
    });
  }

  // Listen to signaling
  db.ref(`call/${roomId}/signaling/${remoteId}_${clientId}/offer`).on('value', async snap => {
    if (snap.exists()) {
      const offer = JSON.parse(snap.val());
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      db.ref(`call/${roomId}/signaling/${clientId}_${remoteId}/answer`).set(JSON.stringify(answer));
    }
  });

  db.ref(`call/${roomId}/signaling/${remoteId}_${clientId}/answer`).on('value', async snap => {
    if (snap.exists()) {
      const answer = JSON.parse(snap.val());
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  });

  db.ref(`call/${roomId}/signaling/${remoteId}_${clientId}/candidates`).on('child_added', snap => {
    const candidate = JSON.parse(snap.val());
    pc.addIceCandidate(new RTCIceCandidate(candidate));
  });
}

sendMessageBtn.onclick = () => {
  const msg = messageInput.value;
  if (!msg) return;
  addMessage(`You: ${msg}`);
  messageInput.value = '';
  Object.values(dataChannels).forEach(dc => {
    if (dc.readyState === 'open') dc.send(msg);
  });
};

function addMessage(msg) {
  const p = document.createElement('p');
  p.innerText = msg;
  messagesDiv.appendChild(p);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

shareBtn.onclick = async () => {
  const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  const screenTrack = screenStream.getVideoTracks()[0];

  Object.values(peers).forEach(pc => {
    const sender = pc.getSenders().find(s => s.track.kind === 'video');
    if (sender) sender.replaceTrack(screenTrack);
  });

  screenTrack.onended = () => {
    Object.values(peers).forEach(pc => {
      const sender = pc.getSenders().find(s => s.track.kind === 'video');
      if (sender) sender.replaceTrack(localStream.getVideoTracks()[0]);
    });
  };
};

const toggleMicBtn = document.getElementById('toggleMic');
const toggleCamBtn = document.getElementById('toggleCam');

toggleMicBtn.onclick = () => {
  const audioTrack = localStream.getAudioTracks()[0];
  if (audioTrack) {
    audioTrack.enabled = !audioTrack.enabled;
    toggleMicBtn.textContent = audioTrack.enabled ? '🔇 Tắt Micro' : '🎤 Bật Micro';
    toggleMicBtn.classList.toggle('active', !audioTrack.enabled);
  }
};

toggleCamBtn.onclick = () => {
  const videoTrack = localStream.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack.enabled = !videoTrack.enabled;
    toggleCamBtn.textContent = videoTrack.enabled ? '📷 Tắt Camera' : '📸 Bật Camera';
    toggleCamBtn.classList.toggle('active', !videoTrack.enabled);
  }
};
