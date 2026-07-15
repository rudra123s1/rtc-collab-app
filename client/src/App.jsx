import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Room from './components/Room';

import { getBackendUrl } from './config';

export default function App() {
  const [user, setUser] = useState(null);
  const [roomDetails, setRoomDetails] = useState(null); // { roomId, roomPassword }
  const [socket, setSocket] = useState(null);

  // Check auth session on load
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleAuthSuccess = (authUser, token) => {
    setUser(authUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
  };

  const handleJoinRoom = (roomId, roomPassword) => {
    // Establish Socket.io connection on room join
    const socketUrl = getBackendUrl();

    const newSocket = io(socketUrl);
    setSocket(newSocket);
    setRoomDetails({ roomId, roomPassword });
  };

  const handleLeaveRoom = () => {
    if (socket) {
      socket.disconnect();
    }
    setSocket(null);
    setRoomDetails(null);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {!user ? (
        <Auth onAuthSuccess={handleAuthSuccess} />
      ) : !roomDetails ? (
        <Dashboard user={user} onJoinRoom={handleJoinRoom} onLogout={handleLogout} />
      ) : (
        <Room
          socket={socket}
          roomId={roomDetails.roomId}
          roomPassword={roomDetails.roomPassword}
          user={user}
          onLeaveRoom={handleLeaveRoom}
        />
      )}
    </div>
  );
}
