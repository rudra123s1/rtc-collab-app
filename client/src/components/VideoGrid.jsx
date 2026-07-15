import React, { useRef, useEffect } from 'react';
import { MicOff, VideoOff, User } from 'lucide-react';

function VideoPlayer({ stream, isLocal, muted, username, videoEnabled, audioEnabled }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="video-wrapper">
      {videoEnabled ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal || muted} // Always mute local video to prevent echo feedback loop
          className={`video-element ${isLocal ? '' : 'remote-stream'}`}
        />
      ) : (
        <div className="video-placeholder">
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            border: '2px solid hsl(var(--border-color))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'hsl(var(--text-secondary))',
            fontSize: '2rem',
            fontWeight: '600',
            boxShadow: 'var(--shadow-md)'
          }}>
            {username ? username.charAt(0).toUpperCase() : <User size={32} />}
          </div>
          <span style={{ fontSize: '0.85rem' }}>Camera Switched Off</span>
        </div>
      )}

      {/* Overlays */}
      <div className="video-overlay">
        <span className="video-tag">
          {username} {isLocal && '(You)'}
        </span>
        
        <div className="video-indicators">
          {!audioEnabled && (
            <div className="indicator-icon muted" title="Microphone muted">
              <MicOff size={12} />
            </div>
          )}
          {!videoEnabled && (
            <div className="indicator-icon muted" title="Camera disabled">
              <VideoOff size={12} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VideoGrid({ localStream, peers, localVideoEnabled, localAudioEnabled }) {
  // Calculate total screens in grid
  const totalScreens = 1 + peers.length;
  
  // Calculate grid template columns
  const getGridStyle = () => {
    if (totalScreens === 1) {
      return { gridTemplateColumns: '1fr', maxwidth: '700px' };
    }
    if (totalScreens === 2) {
      return { gridTemplateColumns: 'repeat(2, 1fr)' };
    }
    return { gridTemplateColumns: 'repeat(2, 1fr)' };
  };

  return (
    <div className="video-grid" style={getGridStyle()}>
      {/* Local Video */}
      {localStream && (
        <VideoPlayer
          stream={localStream}
          isLocal={true}
          muted={true}
          username="Self"
          videoEnabled={localVideoEnabled}
          audioEnabled={localAudioEnabled}
        />
      )}

      {/* Remote Videos */}
      {peers.map((peer) => (
        <VideoPlayer
          key={peer.socketId}
          stream={peer.stream}
          isLocal={false}
          muted={false}
          username={peer.username}
          videoEnabled={peer.videoEnabled !== false}
          audioEnabled={peer.audioEnabled !== false}
        />
      ))}
    </div>
  );
}
