import React, { useState } from 'react';
import { LogOut, Plus, LogIn, Lock, Video, Compass } from 'lucide-react';

export default function Dashboard({ user, onJoinRoom, onLogout }) {
  const [roomId, setRoomId] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  
  const [newRoomPassword, setNewRoomPassword] = useState('');
  const [error, setError] = useState('');

  const generateRoomId = () => {
    // Generate UUID-like format: rtc-xxxx-xxxx-xxxx
    const rand = () => Math.random().toString(36).substring(2, 6);
    return `room-${rand()}-${rand()}-${rand()}`;
  };

  const handleCreateRoom = (e) => {
    e.preventDefault();
    setError('');

    if (!newRoomPassword.trim()) {
      setError('Please set an E2EE Room Password to secure this room.');
      return;
    }

    const generatedId = generateRoomId();
    onJoinRoom(generatedId, newRoomPassword);
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    setError('');

    if (!roomId.trim()) {
      setError('Room ID is required.');
      return;
    }

    if (!roomPassword.trim()) {
      setError('Room Password is required for End-to-End decryption.');
      return;
    }

    onJoinRoom(roomId.trim(), roomPassword.trim());
  };

  return (
    <div style={{ minHeight: '100vh', background: 'hsl(var(--bg-main))' }}>
      {/* Navbar */}
      <header className="glass" style={{
        height: '70px',
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            padding: '8px',
            borderRadius: '10px',
            display: 'flex'
          }}>
            <Video size={20} color="white" />
          </div>
          <span className="display-title" style={{ fontSize: '1.25rem', fontWeight: '700' }}>SyncSphere Portal</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>{user.username}</span>
            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>Authorized User</span>
          </div>
          <button onClick={onLogout} className="btn-icon danger" title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="dashboard-container">
        <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto 16px' }}>
          <h2 className="display-title" style={{ fontSize: '2.5rem', marginBottom: '12px' }}>Welcome back, {user.username}</h2>
          <p style={{ color: 'hsl(var(--text-secondary))', lineHeight: '1.6' }}>
            Create secure meeting rooms with custom passkeys. All text communications, whiteboard logs, and file sharing are end-to-end encrypted in your browser before broadcast.
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#f87171',
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
            maxWidth: '600px',
            margin: '0 auto',
            width: '100%'
          }}>
            {error}
          </div>
        )}

        <div className="room-grid">
          {/* Create Room Card */}
          <div className="room-card glass-interactive">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ background: 'rgba(59, 130, 246, 0.15)', padding: '10px', borderRadius: '12px', color: '#3b82f6' }}>
                <Plus size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Establish Secure Room</h3>
                <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>Generate a unique endpoint and E2EE key</p>
              </div>
            </div>

            <form onSubmit={handleCreateRoom} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">E2EE Room Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="gray" style={{ position: 'absolute', left: '16px', top: '15px' }} />
                  <input
                    type="password"
                    className="form-input"
                    style={{ paddingLeft: '44px' }}
                    placeholder="Enter security key password"
                    value={newRoomPassword}
                    onChange={(e) => setNewRoomPassword(e.target.value)}
                  />
                </div>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>
                  ⚠️ Save this password. Other members MUST input the exact same password to decrypt files, audio, whiteboard strokes, and chat.
                </span>
              </div>

              <button type="submit" className="btn-primary" style={{ marginTop: '8px' }}>
                <Video size={18} />
                <span>Initialize Meeting</span>
              </button>
            </form>
          </div>

          {/* Join Room Card */}
          <div className="room-card glass-interactive">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ background: 'rgba(139, 92, 246, 0.15)', padding: '10px', borderRadius: '12px', color: '#8b5cf6' }}>
                <LogIn size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Join Meeting Portal</h3>
                <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>Enter existing room address and security key</p>
              </div>
            </div>

            <form onSubmit={handleJoinRoom} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Room ID / Link</label>
                <div style={{ position: 'relative' }}>
                  <Compass size={16} color="gray" style={{ position: 'absolute', left: '16px', top: '15px' }} />
                  <input
                    type="text"
                    className="form-input"
                    style={{ paddingLeft: '44px' }}
                    placeholder="e.g. room-xxxx-xxxx-xxxx"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">E2EE Room Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="gray" style={{ position: 'absolute', left: '16px', top: '15px' }} />
                  <input
                    type="password"
                    className="form-input"
                    style={{ paddingLeft: '44px' }}
                    placeholder="Enter security key password"
                    value={roomPassword}
                    onChange={(e) => setRoomPassword(e.target.value)}
                  />
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ marginTop: '8px' }}>
                <LogIn size={18} />
                <span>Enter Room</span>
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
