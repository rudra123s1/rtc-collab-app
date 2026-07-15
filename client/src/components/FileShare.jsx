import React, { useState, useEffect, useRef } from 'react';
import { Upload, Download, FileText, Lock, Loader, AlertCircle } from 'lucide-react';
import { encryptFile, decryptFile } from '../utils/crypto';
import { getBackendUrl } from '../config';


export default function FileShare({ socket, roomId, roomKey, username }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [downloadingFileId, setDownloadingFileId] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    const handleFileShared = (fileMeta) => {
      setFiles((prev) => [fileMeta, ...prev]);
    };

    socket.on('file-shared-event', handleFileShared);

    return () => {
      socket.off('file-shared-event', handleFileShared);
    };
  }, [socket]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !roomKey) return;

    setUploading(true);
    setError('');

    try {
      // 1. Read file as ArrayBuffer
      const fileReader = new FileReader();
      
      const fileBufferPromise = new Promise((resolve, reject) => {
        fileReader.onload = () => resolve(fileReader.result);
        fileReader.onerror = () => reject(new Error('Failed to read file'));
      });
      
      fileReader.readAsArrayBuffer(file);
      const fileBuffer = await fileBufferPromise;

      // 2. Encrypt File Buffer Client-Side
      const encryptedBuffer = await encryptFile(fileBuffer, roomKey);

      // 3. Prepare Encrypted Blob for upload
      const encryptedBlob = new Blob([encryptedBuffer], { type: 'application/octet-stream' });
      const formData = new FormData();
      formData.append('file', encryptedBlob, file.name);

      // 4. Upload Encrypted Binary to backend
      const token = localStorage.getItem('token');
      const response = await fetch(getBackendUrl() + '/api/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload encrypted file');
      }

      // 5. Broadcast file share meta via Socket.io
      const fileMeta = {
        fileId: data.fileId,
        originalName: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        uploadedBy: username,
        uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      socket.emit('share-file', { roomId, fileMetadata: fileMeta });
      
      // Add to local list
      setFiles((prev) => [fileMeta, ...prev]);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('File share error:', err);
      setError(err.message || 'Error occurred while securing file');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadFile = async (fileMeta) => {
    if (!roomKey) return;

    setDownloadingFileId(fileMeta.fileId);
    setError('');

    try {
      const token = localStorage.getItem('token');
      // 1. Download encrypted arrayBuffer
      const response = await fetch(getBackendUrl() + `/api/files/download/${fileMeta.fileId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Download failed or file not found');
      }

      const encryptedPackage = await response.arrayBuffer();

      // 2. Decrypt arrayBuffer client-side
      const decryptedBuffer = await decryptFile(encryptedPackage, roomKey);

      // 3. Trigger client browser download
      const decryptedBlob = new Blob([decryptedBuffer], { type: fileMeta.mimeType });
      const downloadUrl = URL.createObjectURL(decryptedBlob);
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileMeta.originalName;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('File download/decrypt error:', err);
      setError('Decryption failed. Please verify Room Password.');
    } finally {
      setDownloadingFileId(null);
    }
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
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
          Zero-Knowledge Uploads (E2EE Client-Side)
        </span>
      </div>

      {/* Upload button wrapper */}
      <div style={{ padding: '16px', borderBottom: '1px solid hsla(var(--border-color) / 0.5)' }}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        
        <button
          onClick={handleUploadClick}
          disabled={uploading}
          className="btn-primary"
        >
          {uploading ? (
            <>
              <Loader className="animate-spin" size={16} />
              <span>Encrypting & Uploading...</span>
            </>
          ) : (
            <>
              <Upload size={16} />
              <span>Secure File Share</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div style={{
          padding: '12px',
          background: 'rgba(239, 68, 68, 0.1)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#f87171',
          fontSize: '0.8rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Files List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {files.length === 0 ? (
          <div style={{
            margin: 'auto',
            textAlign: 'center',
            color: 'hsl(var(--text-muted))',
            fontSize: '0.875rem',
            padding: '24px'
          }}>
            <FileText size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
            <p>No documents shared yet.</p>
            <p style={{ fontSize: '0.75rem', marginTop: '4px' }}>Shared files are stored client-encrypted on disk.</p>
          </div>
        ) : (
          files.map((file) => (
            <div
              key={file.fileId}
              style={{
                background: 'hsl(var(--bg-surface-elevated))',
                border: '1px solid hsla(var(--border-color) / 0.5)',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                <div style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  padding: '8px',
                  borderRadius: '8px',
                  color: 'hsl(var(--accent-primary))',
                  display: 'flex',
                  flexShrink: 0
                }}>
                  <FileText size={16} />
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <h4 style={{
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    color: 'white',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }} title={file.originalName}>
                    {file.originalName}
                  </h4>
                  <p style={{ fontSize: '0.7rem', color: 'hsl(var(--text-secondary))', marginTop: '2px' }}>
                    {formatBytes(file.size)} • By {file.uploadedBy}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleDownloadFile(file)}
                disabled={downloadingFileId !== null}
                className="btn-icon"
                title="Download and Decrypt file"
                style={{ flexShrink: 0, width: '36px', height: '36px' }}
              >
                {downloadingFileId === file.fileId ? (
                  <Loader className="animate-spin" size={14} />
                ) : (
                  <Download size={14} />
                )}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
