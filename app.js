const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startCallBtn = document.getElementById('startCall');
const joinCallBtn = document.getElementById('joinCall');

const servers = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

let pc = new RTCPeerConnection(servers);
let localStream;
let isCaller = false;

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localVideo.srcObject = stream;
    localStream = stream;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
  });

pc.ontrack = event => {
  remoteVideo.srcObject = event.streams[0];
};

pc.onicecandidate = event => {
  if (event.candidate) {
    const path = `call/candidates/${isCaller ? 'caller' : 'callee'}`;
    db.ref(path).push().set(JSON.stringify(event.candidate));
  }
};

startCallBtn.onclick = async () => {
  isCaller = true;
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  db.ref('call/offer').set(JSON.stringify(offer));
};

joinCallBtn.onclick = () => {
  db.ref('call/offer').once('value', async snapshot => {
    if (snapshot.exists()) {
      const offer = JSON.parse(snapshot.val());
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      db.ref('call/answer').set(JSON.stringify(answer));
    }
  });
};

// Answer handler
let remoteAnswerSet = false;

db.ref('call/answer').on('value', async snapshot => {
  if (snapshot.exists() && isCaller && !remoteAnswerSet) {
    const answer = JSON.parse(snapshot.val());
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
    remoteAnswerSet = true;
  }
});


// Candidate handler
['caller', 'callee'].forEach(role => {
  db.ref(`call/candidates/${role}`).on('child_added', snapshot => {
    if ((isCaller && role === 'callee') || (!isCaller && role === 'caller')) {
      const candidate = JSON.parse(snapshot.val());
      pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  });
});
