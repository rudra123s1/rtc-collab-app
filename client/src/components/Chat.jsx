import React, { useState, useEffect, useRef } from 'react';
import { Send, Shield, Lock } from 'lucide-react';
import { encryptText, decryptText } from '../utils/crypto';

export default function Chat({ socket, roomId, roomKey, username }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Scroll to bottom on new message
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleReceiveMessage = async (msg) => {
      if (!roomKey) return;
      
      try {
        const decryptedText = await decryptText(
          { iv: msg.iv, ciphertext: msg.ciphertext },
          roomKey
        );

        setMessages((prev) => [
          ...prev,
          {
            id: msg.id || Date.now(),
            sender: msg.sender,
            text: decryptedText,
            timestamp: msg.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            encrypted: true,
          },
        ]);
      } catch (err) {
        console.error('Failed to decrypt received chat message:', err);
      }
    };

    socket.on('receive-message', handleReceiveMessage);

    return () => {
      socket.off('receive-message', handleReceiveMessage);
    };
  }, [socket, roomKey]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || !roomKey) return;

    const plainText = inputValue.trim();
    setInputValue('');

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const messageId = Date.now();

    // Add to local state immediately
    setMessages((prev) => [
      ...prev,
      {
        id: messageId,
        sender: username,
        text: plainText,
        timestamp: time,
        encrypted: true,
        isSelf: true
      },
    ]);

    try {
      // Encrypt the message text
      const encrypted = await encryptText(plainText, roomKey);
      
      const payload = {
        id: messageId,
        sender: username,
        iv: encrypted.iv,
        ciphertext: encrypted.ciphertext,
        timestamp: time
      };

      // Broadcast to room
      socket.emit('send-message', { roomId, message: payload });
    } catch (err) {
      console.error('Failed to encrypt chat message:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'hsl(var(--bg-surface))' }}>
      {/* Encryption Banner */}
      <div style={{
        padding: '12px 16px',
        background: 'rgba(16, 185, 129, 0.08)',
        borderBottom: '1px solid rgba(16, 185, 129, 0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <Lock size={14} color="#10b981" />
        <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '500' }}>
          End-to-End Encrypted (AES-GCM-256)
        </span>
      </div>

      {/* Messages Window */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        {messages.length === 0 ? (
          <div style={{
            margin: 'auto',
            textAlign: 'center',
            color: 'hsl(var(--text-muted))',
            fontSize: '0.875rem',
            padding: '24px'
          }}>
            <Shield size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
            <p>Secure chat session started.</p>
            <p style={{ fontSize: '0.75rem', marginTop: '4px' }}>Messages are processed entirely in the browser.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                alignSelf: msg.isSelf ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.isSelf ? 'flex-end' : 'flex-start'
              }}
            >
              {/* Sender name */}
              <span style={{
                fontSize: '0.75rem',
                color: 'hsl(var(--text-secondary))',
                marginBottom: '4px',
                padding: '0 4px'
              }}>
                {msg.sender}
              </span>

              {/* Message Bubble */}
              <div style={{
                background: msg.isSelf
                  ? 'linear-gradient(135deg, hsl(var(--accent-primary)) 0%, #1e40af 100%)'
                  : 'hsl(var(--bg-surface-elevated))',
                border: msg.isSelf
                  ? 'none'
                  : '1px solid hsla(var(--border-color) / 0.5)',
                color: 'white',
                padding: '10px 14px',
                borderRadius: '12px',
                borderTopRightRadius: msg.isSelf ? '2px' : '12px',
                borderTopLeftRadius: msg.isSelf ? '12px' : '2px',
                fontSize: '0.9rem',
                lineHeight: '1.4',
                wordBreak: 'break-word',
                boxShadow: 'var(--shadow-sm)'
              }}>
                {msg.text}
              </div>

              {/* Timestamp & E2EE tag */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginTop: '4px',
                fontSize: '0.7rem',
                color: 'hsl(var(--text-muted))',
                padding: '0 4px'
              }}>
                <span>{msg.timestamp}</span>
                {msg.encrypted && <Lock size={9} style={{ opacity: 0.7 }} />}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input form */}
      <form onSubmit={handleSendMessage} style={{
        padding: '16px',
        borderTop: '1px solid hsla(var(--border-color) / 0.5)',
        display: 'flex',
        gap: '8px',
        background: 'rgba(15, 23, 42, 0.4)'
      }}>
        <input
          type="text"
          className="form-input"
          placeholder="Send secure message..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          style={{ padding: '10px 14px' }}
        />
        <button type="submit" className="btn-icon active" style={{ flexShrink: 0 }}>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
