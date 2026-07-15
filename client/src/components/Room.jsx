import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, Mic, MicOff, VideoOff, Monitor, PhoneOff, 
  MessageSquare, FileText, Edit, Users, Lock, ChevronRight, Copy, Check 
} from 'lucide-react';
import VideoGrid from './VideoGrid';
import Chat from './Chat';
import Whiteboard from './Whiteboard';
import FileShare from './FileShare';
import { createPeerConnection } from '../utils/webrtc';
import { deriveRoomKey } from '../utils/crypto';

export default function Room({ socket, roomId, roomPassword, user, onLeaveRoom }) {
  const [roomKey, setRoomKey] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [peers, setPeers] = useState([]);
  const [copied, setCopied] = useState(false);

  // Media Controls
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);

  // Layout Panels
  const [activePanel, setActivePanel] = useState('chat'); // 'chat' | 'files' | 'whiteboard' | 'participants' | null

  const localStreamRef = useRef(null);
  const peersRef = useRef([]); // Keeps mutable peer states: [{ socketId, pc, username, stream, videoEnabled, audioEnabled }]
  const screenTrackRef = useRef(null);

  // 1. Initialize local media & derive cryptography key
  useEffect(() => {
    let active = true;

    async function initRoom() {
      try {
        // Derive E2EE Room Key from room password
        const key = await deriveRoomKey(roomPassword, roomId);
        if (!active) return;
        setRoomKey(key);

        // Get video/audio stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        if (!active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        localStreamRef.current = stream;
        setLocalStream(stream);

        // Connect to signaling gateway
        socket.emit('join-room', {
          roomId,
          userId: user.id,
          username: user.username
        });
      } catch (err) {
        console.error('Room initialization failed:', err);
        alert('Could not access media devices or initialize room. Please grant webcam permissions.');
      }
    }

    initRoom();

    return () => {
      active = false;
      // Cleanup streams
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
      }
      // Close all peer connections
      peersRef.current.forEach(peer => {
        peer.pc.close();
      });
    };
  }, [roomId, roomPassword, socket, user]);

  // 2. WebRTC Mesh Signaling Logic
  useEffect(() => {
    if (!localStream) return;

    // A. Receive list of existing users when joining
    socket.on('all-users', (usersInRoom) => {
      console.log('Other users in room:', usersInRoom);
      
      usersInRoom.forEach(async (peerUser) => {
        // Create peer connection
        const pc = createPeerConnection(
          peerUser.socketId,
          localStreamRef.current,
          // Handle candidate sending
          (targetSocketId, candidate) => {
            socket.emit('send-signal', {
              targetSocketId,
              signal: { type: 'candidate', candidate },
              senderUserId: user.id,
              senderUsername: user.username
            });
          },
          // Handle remote track arriving
          (targetSocketId, remoteStream) => {
            updatePeerStream(targetSocketId, remoteStream);
          }
        );

        // Create SDP Offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Emit offer
        socket.emit('send-signal', {
          targetSocketId: peerUser.socketId,
          signal: offer,
          senderUserId: user.id,
          senderUsername: user.username
        });

        // Store peer state
        const peerItem = {
          socketId: peerUser.socketId,
          userId: peerUser.userId,
          username: peerUser.username,
          pc,
          stream: null,
          videoEnabled: true,
          audioEnabled: true
        };
        peersRef.current.push(peerItem);
        setPeers([...peersRef.current]);
      });
    });

    // B. Handle signaling packets (SDP / Candidates)
    socket.on('receive-signal', async ({ senderSocketId, senderUserId, senderUsername, signal }) => {
      let peer = peersRef.current.find(p => p.socketId === senderSocketId);

      // If peer connection does not exist (we are receiving an offer), instantiate it
      if (!peer) {
        const pc = createPeerConnection(
          senderSocketId,
          localStreamRef.current,
          (targetSocketId, candidate) => {
            socket.emit('send-signal', {
              targetSocketId,
              signal: { type: 'candidate', candidate },
              senderUserId: user.id,
              senderUsername: user.username
            });
          },
          (targetSocketId, remoteStream) => {
            updatePeerStream(targetSocketId, remoteStream);
          }
        );

        peer = {
          socketId: senderSocketId,
          userId: senderUserId,
          username: senderUsername,
          pc,
          stream: null,
          videoEnabled: true,
          audioEnabled: true
        };
        peersRef.current.push(peer);
        setPeers([...peersRef.current]);
      }

      // Handle signal payloads
      if (signal.type === 'offer') {
        await peer.pc.setRemoteDescription(new RTCSessionDescription(signal));
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        socket.emit('send-signal', {
          targetSocketId: senderSocketId,
          signal: answer,
          senderUserId: user.id,
          senderUsername: user.username
        });
      } else if (signal.type === 'answer') {
        await peer.pc.setRemoteDescription(new RTCSessionDescription(signal));
      } else if (signal.type === 'candidate') {
        try {
          await peer.pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (e) {
          console.error('Error adding ICE candidate:', e);
        }
      }
    });

    // C. Clean up disconnected peers
    socket.on('user-disconnected', ({ socketId }) => {
      console.log(`Peer disconnected signaling cleanup: ${socketId}`);
      const peer = peersRef.current.find(p => p.socketId === socketId);
      if (peer) {
        peer.pc.close();
      }
      peersRef.current = peersRef.current.filter(p => p.socketId !== socketId);
      setPeers([...peersRef.current]);
    });

    return () => {
      socket.off('all-users');
      socket.off('receive-signal');
      socket.off('user-disconnected');
    };
  }, [localStream, socket, user]);

  // Helper to update remote streams
  const updatePeerStream = (socketId, stream) => {
    peersRef.current = peersRef.current.map(p => {
      if (p.socketId === socketId) {
        return { ...p, stream };
      }
      return p;
    });
    setPeers([...peersRef.current]);
  };

  // Toggle Video Track
  const handleToggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
        
        // Notify other peers if camera is disabled (mock UI state or websocket broadcast)
        // For simplicity, we just toggle tracks
      }
    }
  };

  // Toggle Audio Track
  const handleToggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  };

  // Toggle Screen Share
  const handleToggleScreenShare = async () => {
    if (screenSharing) {
      // Stop screen sharing
      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
        screenTrackRef.current = null;
      }
      // Re-enable camera track
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const cameraTrack = stream.getVideoTracks()[0];
        
        // Replace screen share track back to camera on all connections
        replaceTrackOnPeers(cameraTrack);

        // Update local state
        const currentTracks = localStreamRef.current.getVideoTracks();
        currentTracks.forEach(t => localStreamRef.current.removeTrack(t));
        localStreamRef.current.addTrack(cameraTrack);
        
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        setVideoEnabled(true);
        setScreenSharing(false);
      } catch (err) {
        console.error('Failed to restore webcam:', err);
      }
    } else {
      // Start screen sharing
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        screenTrackRef.current = screenTrack;

        replaceTrackOnPeers(screenTrack);

        // Update local state
        const currentTracks = localStreamRef.current.getVideoTracks();
        currentTracks.forEach(t => localStreamRef.current.removeTrack(t));
        localStreamRef.current.addTrack(screenTrack);
        
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        setScreenSharing(true);

        // Auto restore when user clicks browser stop sharing button
        screenTrack.onended = () => {
          handleToggleScreenShare();
        };
      } catch (err) {
        console.error('Failed to share screen:', err);
      }
    }
  };

  // Helper to swap tracks for screen sharing
  const replaceTrackOnPeers = (newTrack) => {
    peersRef.current.forEach(peer => {
      const senders = peer.pc.getSenders();
      const videoSender = senders.find(s => s.track && s.track.kind === 'video');
      if (videoSender) {
        videoSender.replaceTrack(newTrack);
      }
    });
  };

  const copyRoomDetails = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="meeting-layout">
      {/* Main Conference Content */}
      <div className="main-content">
        {/* Top Header details */}
        <div className="glass" style={{
          height: '60px',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="e2ee-badge">
              <Lock size={12} />
              <span>E2EE Active</span>
            </span>
            <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', fontWeight: '500' }}>
              Room: <span style={{ color: 'white', fontFamily: 'monospace' }}>{roomId}</span>
            </span>
            <button 
              onClick={copyRoomDetails} 
              style={{
                background: 'none',
                border: 'none',
                color: 'hsl(var(--text-secondary))',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Copy Room ID"
            >
              {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setActivePanel(activePanel === 'chat' ? null : 'chat')}
              className={`btn-icon ${activePanel === 'chat' ? 'active' : ''}`}
              title="Secure Chat"
            >
              <MessageSquare size={16} />
            </button>
            <button
              onClick={() => setActivePanel(activePanel === 'files' ? null : 'files')}
              className={`btn-icon ${activePanel === 'files' ? 'active' : ''}`}
              title="Encrypted Files"
            >
              <FileText size={16} />
            </button>
            <button
              onClick={() => setActivePanel(activePanel === 'whiteboard' ? null : 'whiteboard')}
              className={`btn-icon ${activePanel === 'whiteboard' ? 'active' : ''}`}
              title="Whiteboard"
            >
              <Edit size={16} />
            </button>
            <button
              onClick={() => setActivePanel(activePanel === 'participants' ? null : 'participants')}
              className={`btn-icon ${activePanel === 'participants' ? 'active' : ''}`}
              title="Participants"
            >
              <Users size={16} />
            </button>
          </div>
        </div>

        {/* Video Grid Canvas Area */}
        <div className="streams-container">
          {activePanel === 'whiteboard' ? (
            <Whiteboard socket={socket} roomId={roomId} roomKey={roomKey} />
          ) : (
            <VideoGrid
              localStream={localStream}
              peers={peers}
              localVideoEnabled={videoEnabled}
              localAudioEnabled={audioEnabled}
            />
          )}
        </div>

        {/* Control Toolbar */}
        <div className="control-bar glass">
          <div className="controls-group">
            <h4 style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))' }}>
              Host: <span style={{ color: 'white' }}>{user.username}</span>
            </h4>
          </div>

          <div className="controls-group">
            <button
              onClick={handleToggleAudio}
              className={`btn-icon ${!audioEnabled ? 'danger' : ''}`}
              title={audioEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
            >
              {audioEnabled ? <Mic size={18} /> : <MicOff size={18} />}
            </button>

            <button
              onClick={handleToggleVideo}
              className={`btn-icon ${!videoEnabled ? 'danger' : ''}`}
              title={videoEnabled ? 'Stop Video Camera' : 'Start Video Camera'}
            >
              {videoEnabled ? <Video size={18} /> : <VideoOff size={18} />}
            </button>

            <button
              onClick={handleToggleScreenShare}
              className={`btn-icon ${screenSharing ? 'active' : ''}`}
              title={screenSharing ? 'Stop Screen Sharing' : 'Share Desktop Screen'}
            >
              <Monitor size={18} />
            </button>

            <button
              onClick={onLeaveRoom}
              className="btn-icon danger"
              title="Leave Meeting Room"
            >
              <PhoneOff size={18} />
            </button>
          </div>

          <div className="controls-group" style={{ width: '80px' }}>
            {/* spacer */}
          </div>
        </div>
      </div>

      {/* Right Panels (Chat, Files, Participants) */}
      {activePanel && activePanel !== 'whiteboard' && (
        <div className="sidebar-panel glass">
          <div className="panel-header">
            <h3 className="panel-title">
              {activePanel === 'chat' && 'Encrypted Chat'}
              {activePanel === 'files' && 'Secure File Sharing'}
              {activePanel === 'participants' && 'Meeting Participants'}
            </h3>
            <button onClick={() => setActivePanel(null)} className="btn-icon" style={{ width: '30px', height: '30px' }}>
              <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ flex: 1, overflow: 'hidden' }}>
            {activePanel === 'chat' && (
              <Chat socket={socket} roomId={roomId} roomKey={roomKey} username={user.username} />
            )}
            {activePanel === 'files' && (
              <FileShare socket={socket} roomId={roomId} roomKey={roomKey} username={user.username} />
            )}
            {activePanel === 'participants' && (
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                  <span>{user.username} (You)</span>
                </div>
                {peers.map(peer => (
                  <div key={peer.socketId} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                    <span>{peer.username}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
